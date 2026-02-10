import { ComfyWorkflow, ComfyWorkflowJson, InputValue } from '../../index';

/**
 * SDXL用ワークフロー動的構築ヘルパー
 * ベースワークフローからSDXL派生ワークフローを構築する
 */
export class SDXLWorkflowBuilder {
  private workflow: ComfyWorkflow;
  private loraNodeId: string | null = null;

  constructor(baseWorkflow: ComfyWorkflowJson) {
    this.workflow = ComfyWorkflow.fromJson(baseWorkflow);
  }

  // --- モデル設定 ---

  /**
   * CheckpointLoaderSimpleのckpt_nameを設定
   */
  setCheckpoint(ckptName: string): this {
    const checkpoints = this.workflow.findNodesByType('CheckpointLoaderSimple');
    for (const { id } of checkpoints) {
      this.workflow.setInput(id, 'ckpt_name', ckptName);
    }
    return this;
  }

  // --- LoRA追加 ---

  /**
   * LoraLoaderノードを追加し、CheckpointLoaderSimpleとKSampler/CLIPTextEncode間に挿入する
   *
   * 1. CheckpointLoaderSimpleを探す
   * 2. KSamplerを探す
   * 3. 全CLIPTextEncodeを探す
   * 4. LoraLoaderノードを追加 (model<-Checkpoint[0], clip<-Checkpoint[1], lora_name, strength_model, strength_clip)
   * 5. KSampler.modelの接続先をLoraLoader[0]に変更
   * 6. 全CLIPTextEncode.clipの接続先をLoraLoader[1]に変更
   */
  addLora(name: string, strengthModel: number, strengthClip: number): this {
    const checkpoints = this.workflow.findNodesByType('CheckpointLoaderSimple');
    if (checkpoints.length === 0) return this;
    const checkpointId = checkpoints[0].id;

    const samplers = this.workflow.findNodesByType('KSampler');
    if (samplers.length === 0) return this;
    const samplerId = samplers[0].id;

    const clipEncoders = this.workflow.findNodesByType('CLIPTextEncode');

    // LoraLoaderノードを追加
    const loraNodeId = this.workflow.addNode('LoraLoader', {
      lora_name: name,
      strength_model: strengthModel,
      strength_clip: strengthClip,
    }, { meta: { title: 'LoRA Loader' } });

    // Checkpoint -> LoraLoader (model: port 0, clip: port 1)
    this.workflow.addEdge(checkpointId, 0, loraNodeId, 'model');
    this.workflow.addEdge(checkpointId, 1, loraNodeId, 'clip');

    // KSampler.model を LoraLoader[0] に変更
    this.workflow.addEdge(loraNodeId, 0, samplerId, 'model');

    // 全CLIPTextEncode.clip を LoraLoader[1] に変更
    for (const { id } of clipEncoders) {
      this.workflow.addEdge(loraNodeId, 1, id, 'clip');
    }

    this.loraNodeId = loraNodeId;
    return this;
  }

  // --- img2imgモード切替 ---

  /**
   * img2imgモードに切り替える
   *
   * 1. EmptyLatentImageを削除
   * 2. LoadImageノードを追加
   * 3. VAEEncodeノードを追加
   * 4. LoadImage -> VAEEncode.pixels を接続
   * 5. CheckpointLoaderSimple[2](VAE) -> VAEEncode.vae を接続
   * 6. KSampler.latent_image を VAEEncode[0] に変更
   * 7. KSampler.denoise を denoise 値に設定
   */
  setImg2ImgMode(imageName: string, denoise: number): this {
    // EmptyLatentImageを探して削除
    const emptyLatents = this.workflow.findNodesByType('EmptyLatentImage');
    for (const { id } of emptyLatents) {
      this.workflow.removeNode(id);
    }

    // CheckpointLoaderSimpleを探す（VAE出力: port 2）
    const checkpoints = this.workflow.findNodesByType('CheckpointLoaderSimple');
    if (checkpoints.length === 0) return this;
    const checkpointId = checkpoints[0].id;

    // KSamplerを探す
    const samplers = this.workflow.findNodesByType('KSampler');
    if (samplers.length === 0) return this;
    const samplerId = samplers[0].id;

    // LoadImageノードを追加
    const loadImageId = this.workflow.addNode('LoadImage', {
      image: imageName,
      upload: 'image',
    }, { meta: { title: 'Input Image' } });

    // VAEEncodeノードを追加
    const vaeEncodeId = this.workflow.addNode('VAEEncode', {}, {
      meta: { title: 'VAE Encode' },
    });

    // LoadImage -> VAEEncode.pixels
    this.workflow.addEdge(loadImageId, 0, vaeEncodeId, 'pixels');

    // CheckpointLoaderSimple[2](VAE) -> VAEEncode.vae
    this.workflow.addEdge(checkpointId, 2, vaeEncodeId, 'vae');

    // KSampler.latent_image を VAEEncode[0] に変更
    this.workflow.addEdge(vaeEncodeId, 0, samplerId, 'latent_image');

    // KSampler.denoise を設定
    this.workflow.setInput(samplerId, 'denoise', denoise);

    return this;
  }

  // --- プロンプト設定 ---

  /**
   * CLIPTextEncodeのテキストを設定
   * _meta.title で "Positive Prompt" / "Negative Prompt" を判別
   */
  setPrompt(positive: string, negative: string): this {
    const clipEncoders = this.workflow.findNodesByType('CLIPTextEncode');
    for (const { id, node } of clipEncoders) {
      const title = node._meta?.title || '';
      if (title === 'Positive Prompt') {
        this.workflow.setInput(id, 'text', positive);
      } else if (title === 'Negative Prompt') {
        this.workflow.setInput(id, 'text', negative);
      }
    }
    return this;
  }

  // --- 解像度設定（txt2imgのみ） ---

  /**
   * EmptyLatentImageのwidth, heightを設定
   */
  setSize(width: number, height: number): this {
    const emptyLatents = this.workflow.findNodesByType('EmptyLatentImage');
    for (const { id } of emptyLatents) {
      this.workflow.setInput(id, 'width', width);
      this.workflow.setInput(id, 'height', height);
    }
    return this;
  }

  // --- サンプリングパラメータ ---

  /**
   * KSamplerのseedを設定
   */
  setSeed(seed: number): this {
    const samplers = this.workflow.findNodesByType('KSampler');
    for (const { id } of samplers) {
      this.workflow.setInput(id, 'seed', seed);
    }
    return this;
  }

  /**
   * KSamplerのstepsを設定
   */
  setSteps(steps: number): this {
    const samplers = this.workflow.findNodesByType('KSampler');
    for (const { id } of samplers) {
      this.workflow.setInput(id, 'steps', steps);
    }
    return this;
  }

  /**
   * KSamplerのcfgを設定
   */
  setCfg(cfg: number): this {
    const samplers = this.workflow.findNodesByType('KSampler');
    for (const { id } of samplers) {
      this.workflow.setInput(id, 'cfg', cfg);
    }
    return this;
  }

  /**
   * KSamplerのsampler_name, schedulerを設定
   */
  setSampler(samplerName: string, scheduler: string): this {
    const samplers = this.workflow.findNodesByType('KSampler');
    for (const { id } of samplers) {
      this.workflow.setInput(id, 'sampler_name', samplerName);
      this.workflow.setInput(id, 'scheduler', scheduler);
    }
    return this;
  }

  // --- ビルド ---

  /**
   * 現在のワークフローを取得
   */
  getWorkflow(): ComfyWorkflow {
    return this.workflow;
  }

  /**
   * ワークフローをJSONとしてビルド
   */
  build(): ComfyWorkflowJson {
    return this.workflow.toJson();
  }
}
