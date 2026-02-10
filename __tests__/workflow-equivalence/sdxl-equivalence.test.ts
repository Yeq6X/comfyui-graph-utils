import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ComfyWorkflow, ComfyWorkflowJson } from '../../index';
import { SDXLWorkflowBuilder } from './SDXLWorkflowBuilder';

// ワークフローファイルのベースパス
const WORKFLOW_BASE_PATH = resolve(__dirname, '../../../../../../ComfyRunPodServerless+FramePack/app/workflows');
const FIXTURE_BASE_PATH = resolve(__dirname, './fixtures');

/**
 * ワークフローファイルを読み込む
 */
function loadWorkflow(relativePath: string): ComfyWorkflowJson {
  const fullPath = resolve(WORKFLOW_BASE_PATH, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Workflow file not found: ${fullPath}`);
  }
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

/**
 * フィクスチャを読み込む
 */
function loadFixture(relativePath: string): ComfyWorkflowJson {
  const fullPath = resolve(FIXTURE_BASE_PATH, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Fixture file not found: ${fullPath}`);
  }
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

/**
 * 構造的等価性をアサート（差分があれば表示）
 */
function assertStructurallyEquivalent(
  built: ComfyWorkflow,
  expected: ComfyWorkflow,
  testName: string
): void {
  const diffs = built.getStructuralDiff(expected);
  if (diffs.length > 0) {
    console.log(`\n[${testName}] 構造的差分:`);
    diffs.slice(0, 10).forEach(d => console.log(`  - ${d.details}`));
    if (diffs.length > 10) {
      console.log(`  ... and ${diffs.length - 10} more`);
    }
  }
  expect(built.isStructurallyEquivalentTo(expected)).toBe(true);
}

/**
 * 期待されるワークフローからパラメータを読み取り、ビルダーに設定する
 */
function syncParametersFromExpected(builder: SDXLWorkflowBuilder, expected: ComfyWorkflowJson): void {
  const expectedWf = ComfyWorkflow.fromJson(expected);
  const builtWf = builder.getWorkflow();

  // LoRAパラメータを同期
  const loraNodes = expectedWf.findNodesByType('LoraLoader');
  if (loraNodes.length > 0) {
    const builtLoraNodes = builtWf.findNodesByType('LoraLoader');
    if (builtLoraNodes.length > 0) {
      const loraInput = loraNodes[0].node.inputs;
      builtWf.setInput(builtLoraNodes[0].id, 'lora_name', loraInput.lora_name as string);
      builtWf.setInput(builtLoraNodes[0].id, 'strength_model', loraInput.strength_model as number);
      builtWf.setInput(builtLoraNodes[0].id, 'strength_clip', loraInput.strength_clip as number);
    }
  }

  // KSamplerパラメータを同期
  const expectedSamplers = expectedWf.findNodesByType('KSampler');
  const builtSamplers = builtWf.findNodesByType('KSampler');
  if (expectedSamplers.length > 0 && builtSamplers.length > 0) {
    const inputs = expectedSamplers[0].node.inputs;
    if (inputs.seed !== undefined) {
      builtWf.setInput(builtSamplers[0].id, 'seed', inputs.seed as number);
    }
    if (inputs.denoise !== undefined) {
      builtWf.setInput(builtSamplers[0].id, 'denoise', inputs.denoise as number);
    }
  }

  // LoadImageパラメータを同期
  const expectedLoadImages = expectedWf.findNodesByType('LoadImage');
  const builtLoadImages = builtWf.findNodesByType('LoadImage');
  if (expectedLoadImages.length > 0 && builtLoadImages.length > 0) {
    const expectedImageName = expectedLoadImages[0].node.inputs.image as string;
    builtWf.setInput(builtLoadImages[0].id, 'image', expectedImageName);
  }

  // CheckpointLoaderSimpleパラメータを同期
  const expectedCheckpoints = expectedWf.findNodesByType('CheckpointLoaderSimple');
  const builtCheckpoints = builtWf.findNodesByType('CheckpointLoaderSimple');
  if (expectedCheckpoints.length > 0 && builtCheckpoints.length > 0) {
    const ckptName = expectedCheckpoints[0].node.inputs.ckpt_name as string;
    builtWf.setInput(builtCheckpoints[0].id, 'ckpt_name', ckptName);
  }
}

describe('SDXL ワークフロー等価性テスト', () => {
  const sdxlBase = () => loadFixture('base-workflows/sdxl_txt2img.json');

  it('sdxl_txt2img.json - ベースワークフロー', () => {
    const base = sdxlBase();
    const expected = loadWorkflow('sdxl_txt2img.json');

    const builtWorkflow = ComfyWorkflow.fromJson(base);
    const expectedWorkflow = ComfyWorkflow.fromJson(expected);

    assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'sdxl_txt2img');
  });

  it('sdxl_txt2img_lora.json - ベース + LoRA', () => {
    const base = sdxlBase();
    const expected = loadWorkflow('sdxl_txt2img_lora.json');

    const builder = new SDXLWorkflowBuilder(base);
    builder.addLora('placeholder.safetensors', 1.0, 1.0);
    syncParametersFromExpected(builder, expected);

    const builtWorkflow = builder.getWorkflow();
    const expectedWorkflow = ComfyWorkflow.fromJson(expected);

    assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'sdxl_txt2img_lora');
  });

  it('sdxl_img2img.json - ベース + img2img', () => {
    const base = sdxlBase();
    const expected = loadWorkflow('sdxl_img2img.json');

    const builder = new SDXLWorkflowBuilder(base);
    builder.setImg2ImgMode('placeholder.png', 0.7);
    syncParametersFromExpected(builder, expected);

    const builtWorkflow = builder.getWorkflow();
    const expectedWorkflow = ComfyWorkflow.fromJson(expected);

    assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'sdxl_img2img');
  });

  it('sdxl_img2img_lora.json - ベース + LoRA + img2img', () => {
    const base = sdxlBase();
    const expected = loadWorkflow('sdxl_img2img_lora.json');

    const builder = new SDXLWorkflowBuilder(base);
    builder
      .addLora('placeholder.safetensors', 1.0, 1.0)
      .setImg2ImgMode('placeholder.png', 0.7);
    syncParametersFromExpected(builder, expected);

    const builtWorkflow = builder.getWorkflow();
    const expectedWorkflow = ComfyWorkflow.fromJson(expected);

    assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'sdxl_img2img_lora');
  });
});

describe('SDXLWorkflowBuilder機能テスト', () => {
  const sdxlBase = () => loadFixture('base-workflows/sdxl_txt2img.json');

  it('メソッドチェーンがすべて機能する', () => {
    const base = sdxlBase();
    const builder = new SDXLWorkflowBuilder(base);

    const result = builder
      .setCheckpoint('illustrious_v1.safetensors')
      .addLora('lora.safetensors', 0.8, 0.8)
      .setPrompt('1girl, masterpiece', 'lowres, bad anatomy')
      .setSize(1024, 1536)
      .setSeed(12345)
      .setSteps(30)
      .setCfg(7.5)
      .setSampler('dpmpp_2m', 'karras');

    expect(result).toBe(builder);

    const workflow = builder.getWorkflow();
    expect(workflow.findNodesByType('LoraLoader').length).toBe(1);
    expect(workflow.findNodesByType('CheckpointLoaderSimple').length).toBe(1);
    expect(workflow.findNodesByType('KSampler').length).toBe(1);
  });

  it('img2imgモードで正しく切り替わる', () => {
    const base = sdxlBase();
    const builder = new SDXLWorkflowBuilder(base);

    builder.setImg2ImgMode('test.png', 0.65);

    const workflow = builder.getWorkflow();
    expect(workflow.findNodesByType('EmptyLatentImage').length).toBe(0);
    expect(workflow.findNodesByType('LoadImage').length).toBe(1);
    expect(workflow.findNodesByType('VAEEncode').length).toBe(1);
  });

  it('build()でJSONを取得できる', () => {
    const base = sdxlBase();
    const builder = new SDXLWorkflowBuilder(base);
    builder.addLora('test.safetensors', 1, 1);

    const json = builder.build();
    expect(json).toBeDefined();
    expect(typeof json).toBe('object');
  });
});
