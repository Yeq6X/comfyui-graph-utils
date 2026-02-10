import { ComfyWorkflow, ComfyWorkflowJson, InputValue } from '../../index';

/**
 * ワークフロー動的構築ヘルパー
 * ベースワークフローから派生ワークフローを構築する
 */
export class WorkflowBuilder {
  private workflow: ComfyWorkflow;

  constructor(baseWorkflow: ComfyWorkflowJson) {
    this.workflow = ComfyWorkflow.fromJson(baseWorkflow);
  }

  /**
   * LoRAノードを追加し、LoadFramePackModelに接続
   */
  addLora(loraName: string, strength: number = 1, fuseLora: boolean = false): this {
    const loraNodeId = this.workflow.addNode('FramePackLoraSelect', {
      lora: loraName,
      strength,
      fuse_lora: fuseLora,
    });

    const modelLoaders = this.workflow.findNodesByType('LoadFramePackModel');
    if (modelLoaders.length > 0) {
      this.workflow.addEdge(loraNodeId, 0, modelLoaders[0].id, 'lora');
    }

    return this;
  }

  /**
   * Negative Promptモードを設定
   * 'zeroout': ConditioningZeroOutを使用（no_negative版）
   * 'clip_encode': CLIPTextEncodeを使用（with_negative版）
   */
  setNegativeMode(mode: 'zeroout' | 'clip_encode'): this {
    const samplers = [
      ...this.workflow.findNodesByType('FramePackSampler'),
      ...this.workflow.findNodesByType('FramePackSampler_F1'),
      ...this.workflow.findNodesByType('FramePackSingleFrameSampler'),
    ];

    if (samplers.length === 0) return this;
    const samplerId = samplers[0].id;

    if (mode === 'clip_encode') {
      // ConditioningZeroOutを削除し、CLIPTextEncodeを追加
      const zeroOuts = this.workflow.findNodesByType('ConditioningZeroOut');

      // DualCLIPLoaderを探す
      const clipLoaders = this.workflow.findNodesByType('DualCLIPLoader');
      if (clipLoaders.length === 0) return this;

      // 新しいCLIPTextEncodeノードを追加
      const negativeEncodeId = this.workflow.addNode('CLIPTextEncode', {
        text: '',
      });
      this.workflow.addEdge(clipLoaders[0].id, 0, negativeEncodeId, 'clip');

      // Samplerのnegative入力を新しいノードに接続
      this.workflow.addEdge(negativeEncodeId, 0, samplerId, 'negative');

      // ConditioningZeroOutを削除
      for (const { id } of zeroOuts) {
        this.workflow.removeNode(id);
      }
    }

    return this;
  }

  /**
   * 終了フレームを追加（FramePackSampler用、start_and_end版）
   */
  addEndFrame(endImageName: string = 'end_image.png'): this {
    const samplers = this.workflow.findNodesByType('FramePackSampler');
    if (samplers.length === 0) return this;
    const samplerId = samplers[0].id;

    // VAELoaderを探す
    const vaeLoaders = this.workflow.findNodesByType('VAELoader');
    if (vaeLoaders.length === 0) return this;

    // CLIPVisionLoaderを探す
    const clipVisionLoaders = this.workflow.findNodesByType('CLIPVisionLoader');
    if (clipVisionLoaders.length === 0) return this;

    // FramePackFindNearestBucketを探す（サイズ参照用）
    const bucketFinders = this.workflow.findNodesByType('FramePackFindNearestBucket');
    if (bucketFinders.length === 0) return this;

    // LoadImage (end)
    const endLoadImageId = this.workflow.addNode('LoadImage', {
      image: endImageName,
      upload: 'image',
    }, { meta: { title: 'Load Image: End' } });

    // ImageResize+ (end)
    const endResizeId = this.workflow.addNode('ImageResize+', {
      interpolation: 'lanczos',
      method: 'stretch',
      condition: 'always',
      multiple_of: 0,
    });
    this.workflow.addEdge(bucketFinders[0].id, 0, endResizeId, 'width');
    this.workflow.addEdge(bucketFinders[0].id, 1, endResizeId, 'height');
    this.workflow.addEdge(endLoadImageId, 0, endResizeId, 'image');

    // GetImageSizeAndCount (end)
    const endSizeCountId = this.workflow.addNode('GetImageSizeAndCount', {});
    this.workflow.addEdge(endResizeId, 0, endSizeCountId, 'image');

    // VAEEncode (end)
    const endVaeEncodeId = this.workflow.addNode('VAEEncode', {});
    this.workflow.addEdge(endSizeCountId, 0, endVaeEncodeId, 'pixels');
    this.workflow.addEdge(vaeLoaders[0].id, 0, endVaeEncodeId, 'vae');

    // CLIPVisionEncode (end)
    const endClipVisionEncodeId = this.workflow.addNode('CLIPVisionEncode', {
      crop: 'center',
    });
    this.workflow.addEdge(clipVisionLoaders[0].id, 0, endClipVisionEncodeId, 'clip_vision');
    this.workflow.addEdge(endSizeCountId, 0, endClipVisionEncodeId, 'image');

    // Samplerに接続
    this.workflow.addEdge(endVaeEncodeId, 0, samplerId, 'end_latent');
    this.workflow.addEdge(endClipVisionEncodeId, 0, samplerId, 'end_image_embeds');

    return this;
  }

  /**
   * 参照フレームを追加（FramePackSingleFrameSampler用、start_and_reference版）
   */
  addReferenceFrame(referenceImageName: string = 'reference_image.png'): this {
    const samplers = this.workflow.findNodesByType('FramePackSingleFrameSampler');
    if (samplers.length === 0) return this;
    const samplerId = samplers[0].id;

    // VAELoaderを探す
    const vaeLoaders = this.workflow.findNodesByType('VAELoader');
    if (vaeLoaders.length === 0) return this;

    // CLIPVisionLoaderを探す
    const clipVisionLoaders = this.workflow.findNodesByType('CLIPVisionLoader');
    if (clipVisionLoaders.length === 0) return this;

    // FramePackFindNearestBucketを探す（サイズ参照用）
    const bucketFinders = this.workflow.findNodesByType('FramePackFindNearestBucket');
    if (bucketFinders.length === 0) return this;

    // LoadImage (reference)
    const refLoadImageId = this.workflow.addNode('LoadImage', {
      image: referenceImageName,
      upload: 'image',
    }, { meta: { title: 'reference image' } });

    // ImageResize+ (reference)
    const refResizeId = this.workflow.addNode('ImageResize+', {
      interpolation: 'nearest',
      method: 'stretch',
      condition: 'always',
      multiple_of: 0,
    });
    this.workflow.addEdge(bucketFinders[0].id, 0, refResizeId, 'width');
    this.workflow.addEdge(bucketFinders[0].id, 1, refResizeId, 'height');
    this.workflow.addEdge(refLoadImageId, 0, refResizeId, 'image');

    // VAEEncode (reference)
    const refVaeEncodeId = this.workflow.addNode('VAEEncode', {});
    this.workflow.addEdge(refResizeId, 0, refVaeEncodeId, 'pixels');
    this.workflow.addEdge(vaeLoaders[0].id, 0, refVaeEncodeId, 'vae');

    // CLIPVisionEncode (reference)
    const refClipVisionEncodeId = this.workflow.addNode('CLIPVisionEncode', {
      crop: 'none',
    });
    this.workflow.addEdge(clipVisionLoaders[0].id, 0, refClipVisionEncodeId, 'clip_vision');
    this.workflow.addEdge(refResizeId, 0, refClipVisionEncodeId, 'image');

    // Samplerに接続
    this.workflow.addEdge(refVaeEncodeId, 0, samplerId, 'reference_latent');
    this.workflow.addEdge(refClipVisionEncodeId, 0, samplerId, 'reference_image_embeds');

    return this;
  }

  /**
   * マスクを追加（FramePackSingleFrameSampler用、with_masks版）
   */
  addMasks(startMaskName: string = 'start_mask.png', refMaskName: string = 'ref_mask.png'): this {
    const samplers = this.workflow.findNodesByType('FramePackSingleFrameSampler');
    if (samplers.length === 0) return this;
    const samplerId = samplers[0].id;

    // FramePackFindNearestBucketを探す（サイズ参照用）
    const bucketFinders = this.workflow.findNodesByType('FramePackFindNearestBucket');
    if (bucketFinders.length === 0) return this;

    // Start Mask
    const startMaskLoadId = this.workflow.addNode('LoadImage', {
      image: startMaskName,
      upload: 'image',
    }, { meta: { title: 'start mask' } });

    const startMaskResizeId = this.workflow.addNode('ImageResize+', {
      interpolation: 'nearest',
      method: 'stretch',
      condition: 'always',
      multiple_of: 0,
    });
    this.workflow.addEdge(bucketFinders[0].id, 0, startMaskResizeId, 'width');
    this.workflow.addEdge(bucketFinders[0].id, 1, startMaskResizeId, 'height');
    this.workflow.addEdge(startMaskLoadId, 0, startMaskResizeId, 'image');

    const startMaskFromColorId = this.workflow.addNode('MaskFromColor+', {
      red: 255,
      green: 255,
      blue: 255,
      threshold: 125,
    });
    this.workflow.addEdge(startMaskResizeId, 0, startMaskFromColorId, 'image');

    // Reference Mask
    const refMaskLoadId = this.workflow.addNode('LoadImage', {
      image: refMaskName,
      upload: 'image',
    }, { meta: { title: 'reference mask' } });

    const refMaskResizeId = this.workflow.addNode('ImageResize+', {
      interpolation: 'nearest',
      method: 'stretch',
      condition: 'always',
      multiple_of: 0,
    });
    this.workflow.addEdge(bucketFinders[0].id, 0, refMaskResizeId, 'width');
    this.workflow.addEdge(bucketFinders[0].id, 1, refMaskResizeId, 'height');
    this.workflow.addEdge(refMaskLoadId, 0, refMaskResizeId, 'image');

    const refMaskFromColorId = this.workflow.addNode('MaskFromColor+', {
      red: 255,
      green: 255,
      blue: 255,
      threshold: 125,
    });
    this.workflow.addEdge(refMaskResizeId, 0, refMaskFromColorId, 'image');

    // Samplerに接続
    this.workflow.addEdge(startMaskFromColorId, 0, samplerId, 'input_mask');
    this.workflow.addEdge(refMaskFromColorId, 0, samplerId, 'reference_mask');

    return this;
  }

  /**
   * Samplerのgpu_memory_preservationを設定
   */
  setGpuMemoryPreservation(value: number): this {
    const samplers = [
      ...this.workflow.findNodesByType('FramePackSampler_F1'),
      ...this.workflow.findNodesByType('FramePackSampler'),
      ...this.workflow.findNodesByType('FramePackSingleFrameSampler'),
    ];

    for (const { id } of samplers) {
      this.workflow.setInput(id, 'gpu_memory_preservation', value);
    }

    return this;
  }

  /**
   * Samplerのseedを設定
   */
  setSeed(seed: number): this {
    const samplers = [
      ...this.workflow.findNodesByType('FramePackSampler_F1'),
      ...this.workflow.findNodesByType('FramePackSampler'),
      ...this.workflow.findNodesByType('FramePackSingleFrameSampler'),
    ];

    for (const { id } of samplers) {
      this.workflow.setInput(id, 'seed', seed);
    }

    return this;
  }

  /**
   * 任意の入力値を設定
   */
  setNodeInput(classType: string, inputName: string, value: InputValue): this {
    const nodes = this.workflow.findNodesByType(classType);
    for (const { id } of nodes) {
      this.workflow.setInput(id, inputName, value);
    }
    return this;
  }

  /**
   * テキストプロンプトを設定（FramePackTimestampedTextEncode用）
   */
  setPrompt(text: string, negativeText: string = ''): this {
    const encoders = this.workflow.findNodesByType('FramePackTimestampedTextEncode');
    for (const { id } of encoders) {
      this.workflow.setInput(id, 'text', text);
      this.workflow.setInput(id, 'negative_text', negativeText);
    }

    // CLIPTextEncode用（framepack系）
    const clipEncoders = this.workflow.findNodesByType('CLIPTextEncode');
    for (const { id, node } of clipEncoders) {
      // positiveプロンプト用のノードのみ更新（negativeは空文字のまま）
      if (node._meta?.title?.includes('プロンプト') && !node._meta?.title?.includes('ネガティブ')) {
        this.workflow.setInput(id, 'text', text);
      }
    }

    return this;
  }

  /**
   * 動画の長さを設定
   */
  setVideoLength(seconds: number): this {
    const encoders = this.workflow.findNodesByType('FramePackTimestampedTextEncode');
    for (const { id } of encoders) {
      this.workflow.setInput(id, 'total_second_length', seconds);
    }

    // FramePackSamplerにもtotal_second_lengthがある場合
    const samplers = this.workflow.findNodesByType('FramePackSampler');
    for (const { id } of samplers) {
      this.workflow.setInput(id, 'total_second_length', seconds);
    }

    return this;
  }

  /**
   * 入力画像を設定
   */
  setInputImage(imageName: string): this {
    const loaders = this.workflow.findNodesByType('LoadImage');
    for (const { id, node } of loaders) {
      if (node._meta?.title?.includes('Start') || node._meta?.title?.toLowerCase().includes('start')) {
        this.workflow.setInput(id, 'image', imageName);
        return this;
      }
    }
    // Startが見つからない場合は最初のLoadImageを使用
    if (loaders.length > 0) {
      this.workflow.setInput(loaders[0].id, 'image', imageName);
    }
    return this;
  }

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
