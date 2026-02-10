/**
 * SDXL基本ワークフロー生成スクリプト
 * comfyui-graph-utilsを使用してSDXLワークフローを構築
 */

import { ComfyWorkflow } from '../index';

/**
 * SDXLワークフローを作成する
 */
export function createSDXLWorkflow(options: {
  checkpointName?: string;
  positivePrompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  samplerName?: string;
  scheduler?: string;
  filenamePrefix?: string;
} = {}): ComfyWorkflow {
  const {
    checkpointName = 'sd_xl_base_1.0.safetensors',
    positivePrompt = 'a beautiful landscape, masterpiece, best quality, 8k',
    negativePrompt = 'ugly, blurry, low quality, worst quality',
    width = 1024,
    height = 1024,
    seed = Math.floor(Math.random() * 1000000000000),
    steps = 25,
    cfg = 7.0,
    samplerName = 'euler',
    scheduler = 'normal',
    filenamePrefix = 'SDXL',
  } = options;

  const workflow = new ComfyWorkflow();

  // 1. チェックポイントローダー（SDXLモデル）
  const checkpointId = workflow.addNode(
    'CheckpointLoaderSimple',
    { ckpt_name: checkpointName },
    { meta: { title: 'Load SDXL Checkpoint' } }
  );

  // 2. ポジティブプロンプト（CLIP Text Encode）
  const positiveId = workflow.addNode(
    'CLIPTextEncode',
    { text: positivePrompt },
    { meta: { title: 'Positive Prompt' } }
  );

  // 3. ネガティブプロンプト（CLIP Text Encode）
  const negativeId = workflow.addNode(
    'CLIPTextEncode',
    { text: negativePrompt },
    { meta: { title: 'Negative Prompt' } }
  );

  // 4. 空のLatent画像（SDXL推奨解像度: 1024x1024）
  const latentId = workflow.addNode(
    'EmptyLatentImage',
    {
      width,
      height,
      batch_size: 1,
    },
    { meta: { title: 'Empty Latent (SDXL)' } }
  );

  // 5. KSampler
  const samplerId = workflow.addNode(
    'KSampler',
    {
      seed,
      steps,
      cfg,
      sampler_name: samplerName,
      scheduler,
      denoise: 1.0,
    },
    { meta: { title: 'KSampler' } }
  );

  // 6. VAEデコード
  const decodeId = workflow.addNode(
    'VAEDecode',
    {},
    { meta: { title: 'VAE Decode' } }
  );

  // 7. 画像保存
  const saveId = workflow.addNode(
    'SaveImage',
    { filename_prefix: filenamePrefix },
    { meta: { title: 'Save Image' } }
  );

  // エッジ接続
  // チェックポイント -> KSampler (model)
  workflow.addEdge(checkpointId, 0, samplerId, 'model');

  // チェックポイント -> CLIPTextEncode (clip)
  workflow.addEdge(checkpointId, 1, positiveId, 'clip');
  workflow.addEdge(checkpointId, 1, negativeId, 'clip');

  // CLIPTextEncode -> KSampler (conditioning)
  workflow.addEdge(positiveId, 0, samplerId, 'positive');
  workflow.addEdge(negativeId, 0, samplerId, 'negative');

  // EmptyLatentImage -> KSampler
  workflow.addEdge(latentId, 0, samplerId, 'latent_image');

  // KSampler -> VAEDecode
  workflow.addEdge(samplerId, 0, decodeId, 'samples');

  // チェックポイント -> VAEDecode (vae)
  workflow.addEdge(checkpointId, 2, decodeId, 'vae');

  // VAEDecode -> SaveImage
  workflow.addEdge(decodeId, 0, saveId, 'images');

  return workflow;
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('sdxl-workflow.ts')) {
  const workflow = createSDXLWorkflow({
    positivePrompt: 'a majestic mountain landscape at sunset, dramatic lighting, 8k, masterpiece',
    negativePrompt: 'ugly, blurry, low quality, watermark, text',
    seed: 42,
  });

  console.log('=== SDXL Workflow Generated ===\n');
  console.log(workflow.toJsonString(2));

  // ワークフロー情報を表示
  console.log('\n=== Workflow Info ===');
  console.log(`Total nodes: ${workflow.getNodeCount()}`);
  console.log(`Total edges: ${workflow.getEdges().length}`);
  console.log('\nNodes:');
  Object.entries(workflow.getNodes()).forEach(([id, node]) => {
    console.log(`  [${id}] ${node.class_type} - ${node._meta?.title || 'No title'}`);
  });
}
