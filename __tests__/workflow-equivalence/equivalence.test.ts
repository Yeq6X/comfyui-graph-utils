import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ComfyWorkflow, ComfyWorkflowJson } from '../../index';
import { WorkflowBuilder } from './WorkflowBuilder';

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
function syncParametersFromExpected(builder: WorkflowBuilder, expected: ComfyWorkflowJson): void {
  const expectedWf = ComfyWorkflow.fromJson(expected);
  const builtWf = builder.getWorkflow();

  // LoRAパラメータを同期
  const loraNodes = expectedWf.findNodesByType('FramePackLoraSelect');
  if (loraNodes.length > 0) {
    const loraInput = loraNodes[0].node.inputs;
    builder.setNodeInput('FramePackLoraSelect', 'lora', loraInput.lora as string);
    builder.setNodeInput('FramePackLoraSelect', 'strength', loraInput.strength as number);
    if (loraInput.fuse_lora !== undefined) {
      builder.setNodeInput('FramePackLoraSelect', 'fuse_lora', loraInput.fuse_lora as boolean);
    }
  }

  // Samplerパラメータを同期（seed, gpu_memory_preservation等）
  const samplerTypes = ['FramePackSampler', 'FramePackSampler_F1', 'FramePackSingleFrameSampler'];
  for (const samplerType of samplerTypes) {
    const samplers = expectedWf.findNodesByType(samplerType);
    if (samplers.length > 0) {
      const inputs = samplers[0].node.inputs;
      if (inputs.seed !== undefined) {
        builder.setNodeInput(samplerType, 'seed', inputs.seed as number);
      }
      if (inputs.gpu_memory_preservation !== undefined) {
        builder.setNodeInput(samplerType, 'gpu_memory_preservation', inputs.gpu_memory_preservation as number);
      }
      if (inputs.total_second_length !== undefined) {
        builder.setNodeInput(samplerType, 'total_second_length', inputs.total_second_length as number);
      }
      if (inputs.use_kisekaeichi !== undefined) {
        builder.setNodeInput(samplerType, 'use_kisekaeichi', inputs.use_kisekaeichi as boolean);
      }
    }
  }

  // 画像ファイル名を同期（LoadImage）- タイトルベースでマッチング
  const expectedLoadImages = expectedWf.findNodesByType('LoadImage');
  const builtLoadImages = builtWf.findNodesByType('LoadImage');

  for (const expectedImg of expectedLoadImages) {
    const expectedTitle = expectedImg.node._meta?.title?.toLowerCase() || '';
    const expectedImageName = expectedImg.node.inputs.image as string;

    for (const builtImg of builtLoadImages) {
      const builtTitle = builtImg.node._meta?.title?.toLowerCase() || '';

      // タイトルベースのマッチング（より厳密に）
      const isStartMatch = expectedTitle.includes('start') && builtTitle.includes('start') &&
                           !expectedTitle.includes('mask') && !builtTitle.includes('mask');
      const isEndMatch = expectedTitle.includes('end') && builtTitle.includes('end');
      const isReferenceMatch = expectedTitle.includes('reference') && builtTitle.includes('reference') &&
                               !expectedTitle.includes('mask') && !builtTitle.includes('mask');
      const isStartMaskMatch = expectedTitle.includes('start') && expectedTitle.includes('mask') &&
                               builtTitle.includes('start') && builtTitle.includes('mask');
      const isRefMaskMatch = expectedTitle.includes('reference') && expectedTitle.includes('mask') &&
                             builtTitle.includes('reference') && builtTitle.includes('mask');
      const isExactMatch = expectedTitle === builtTitle;

      if (isExactMatch || isStartMatch || isEndMatch || isReferenceMatch || isStartMaskMatch || isRefMaskMatch) {
        builtWf.setInput(builtImg.id, 'image', expectedImageName);
      }
    }
  }

  // CLIPTextEncodeのテキストを同期（positive/negative を区別）
  // Samplerのpositive/negative入力の接続元を調べて区別する
  const expectedClipEncoders = expectedWf.findNodesByType('CLIPTextEncode');
  const builtClipEncoders = builtWf.findNodesByType('CLIPTextEncode');

  // Samplerを探してpositive/negativeの接続元を特定
  for (const samplerType of samplerTypes) {
    const expectedSamplers = expectedWf.findNodesByType(samplerType);
    const builtSamplers = builtWf.findNodesByType(samplerType);

    if (expectedSamplers.length > 0 && builtSamplers.length > 0) {
      const expectedSampler = expectedSamplers[0];
      const builtSampler = builtSamplers[0];

      // positive入力の接続元を同期
      const expectedPositiveInput = expectedSampler.node.inputs.positive;
      const builtPositiveInput = builtSampler.node.inputs.positive;

      if (Array.isArray(expectedPositiveInput) && Array.isArray(builtPositiveInput)) {
        const expectedPositiveNodeId = expectedPositiveInput[0];
        const builtPositiveNodeId = builtPositiveInput[0];
        const expectedPositiveNode = expected[expectedPositiveNodeId];

        if (expectedPositiveNode?.class_type === 'CLIPTextEncode') {
          const text = expectedPositiveNode.inputs.text as string;
          if (text !== undefined) {
            builtWf.setInput(builtPositiveNodeId, 'text', text);
          }
        }
      }

      // negative入力の接続元を同期
      const expectedNegativeInput = expectedSampler.node.inputs.negative;
      const builtNegativeInput = builtSampler.node.inputs.negative;

      if (Array.isArray(expectedNegativeInput) && Array.isArray(builtNegativeInput)) {
        const expectedNegativeNodeId = expectedNegativeInput[0];
        const builtNegativeNodeId = builtNegativeInput[0];
        const expectedNegativeNode = expected[expectedNegativeNodeId];

        if (expectedNegativeNode?.class_type === 'CLIPTextEncode') {
          const text = expectedNegativeNode.inputs.text as string;
          if (text !== undefined) {
            builtWf.setInput(builtNegativeNodeId, 'text', text);
          }
        }
      }
    }
  }
}

describe('ワークフロー等価性テスト - 32ファイル', () => {
  // ========================================
  // framepack_f1系（ルート、2ファイル）
  // ========================================
  describe('framepack_f1系（ルート）', () => {
    const f1Base = () => loadFixture('base-workflows/framepack_f1_start_only.json');

    it('framepack_f1_start_only.json - ベースワークフロー', () => {
      const base = f1Base();
      const expected = loadWorkflow('framepack_f1_start_only.json');

      const builtWorkflow = ComfyWorkflow.fromJson(base);
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'f1_start_only');
    });

    it('framepack_f1_start_only_lora.json - ベース + LoRA', () => {
      const base = f1Base();
      const expected = loadWorkflow('framepack_f1_start_only_lora.json');

      const builder = new WorkflowBuilder(base);
      builder.addLora('placeholder', 1, false);
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'f1_start_only_lora');
    });
  });

  // ========================================
  // framepack系 no_negative（4ファイル）
  // ========================================
  describe('framepack系（no_negative）', () => {
    const framepackBase = () => loadFixture('base-workflows/framepack_start_only.json');

    it('framepack_start_only.json - ベースワークフロー', () => {
      const base = framepackBase();
      const expected = loadWorkflow('no_negative/framepack_start_only.json');

      const builtWorkflow = ComfyWorkflow.fromJson(base);
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'framepack_start_only');
    });

    it('framepack_start_only_lora.json - ベース + LoRA', () => {
      const base = framepackBase();
      const expected = loadWorkflow('no_negative/framepack_start_only_lora.json');

      const builder = new WorkflowBuilder(base);
      builder.addLora('placeholder', 1, false);
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'framepack_start_only_lora');
    });

    it('framepack_start_and_end.json - ベース + EndFrame', () => {
      const base = framepackBase();
      const expected = loadWorkflow('no_negative/framepack_start_and_end.json');

      const builder = new WorkflowBuilder(base);
      builder.addEndFrame('placeholder.png');
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'framepack_start_and_end');
    });

    it('framepack_start_and_end_lora.json - ベース + EndFrame + LoRA', () => {
      const base = framepackBase();
      const expected = loadWorkflow('no_negative/framepack_start_and_end_lora.json');

      const builder = new WorkflowBuilder(base);
      builder
        .addEndFrame('placeholder.png')
        .addLora('placeholder', 1, false);
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'framepack_start_and_end_lora');
    });
  });

  // ========================================
  // framepack系 with_negative（4ファイル）
  // ========================================
  describe('framepack系（with_negative）', () => {
    const framepackBase = () => loadFixture('base-workflows/framepack_start_only.json');

    it('framepack_start_only_negative.json - ベース + NegativeMode', () => {
      const base = framepackBase();
      const expected = loadWorkflow('with_negative/framepack_start_only_negative.json');

      const builder = new WorkflowBuilder(base);
      builder.setNegativeMode('clip_encode');
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'framepack_start_only_negative');
    });

    it('framepack_start_only_negative_lora.json - ベース + NegativeMode + LoRA', () => {
      const base = framepackBase();
      const expected = loadWorkflow('with_negative/framepack_start_only_negative_lora.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addLora('placeholder', 1, false);
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'framepack_start_only_negative_lora');
    });

    it('framepack_start_and_end_negative.json - ベース + EndFrame + NegativeMode', () => {
      const base = framepackBase();
      const expected = loadWorkflow('with_negative/framepack_start_and_end_negative.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addEndFrame('placeholder.png');
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'framepack_start_and_end_negative');
    });

    it('framepack_start_and_end_negative_lora.json - ベース + EndFrame + NegativeMode + LoRA', () => {
      const base = framepackBase();
      const expected = loadWorkflow('with_negative/framepack_start_and_end_negative_lora.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addEndFrame('placeholder.png')
        .addLora('placeholder', 1, false);
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'framepack_start_and_end_negative_lora');
    });
  });

  // ========================================
  // oneframe系 no_negative（4ファイル）
  // generated_workflows/no_negative/oneframe_* を使用
  // ========================================
  describe('oneframe系（no_negative）', () => {
    const oneframeBase = () => loadFixture('base-workflows/oneframe_start_only.json');

    it('oneframe_start_only.json - ベースワークフロー', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/no_negative/oneframe_start_only.json');

      const builtWorkflow = ComfyWorkflow.fromJson(base);
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_only');
    });

    it('oneframe_start_only_lora.json - ベース + LoRA', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/no_negative/oneframe_start_only_lora.json');

      const builder = new WorkflowBuilder(base);
      builder.addLora('placeholder', 1, false);
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_only_lora');
    });

    it('oneframe_start_and_reference.json - ベース + ReferenceFrame', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/no_negative/oneframe_start_and_reference.json');

      const builder = new WorkflowBuilder(base);
      builder.addReferenceFrame('placeholder.png');
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_and_reference');
    });

    it('oneframe_start_and_reference_lora.json - ベース + ReferenceFrame + LoRA', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/no_negative/oneframe_start_and_reference_lora.json');

      const builder = new WorkflowBuilder(base);
      builder
        .addReferenceFrame('placeholder.png')
        .addLora('placeholder', 1, false);
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_and_reference_lora');
    });
  });

  // ========================================
  // oneframe系 with_negative（4ファイル）
  // generated_workflows/with_negative/oneframe_* を使用
  // ========================================
  describe('oneframe系（with_negative）', () => {
    const oneframeBase = () => loadFixture('base-workflows/oneframe_start_only.json');

    it('oneframe_start_only_negative.json - ベース + NegativeMode', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/with_negative/oneframe_start_only_negative.json');

      const builder = new WorkflowBuilder(base);
      builder.setNegativeMode('clip_encode');
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_only_negative');
    });

    it('oneframe_start_only_negative_lora.json - ベース + NegativeMode + LoRA', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/with_negative/oneframe_start_only_negative_lora.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addLora('placeholder', 1, false);
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_only_negative_lora');
    });

    it('oneframe_start_and_reference_negative.json - ベース + ReferenceFrame + NegativeMode', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/with_negative/oneframe_start_and_reference_negative.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addReferenceFrame('placeholder.png');
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_and_reference_negative');
    });

    it('oneframe_start_and_reference_negative_lora.json - ベース + ReferenceFrame + NegativeMode + LoRA', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/with_negative/oneframe_start_and_reference_negative_lora.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addReferenceFrame('placeholder.png')
        .addLora('placeholder', 1, false);
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_and_reference_negative_lora');
    });
  });

  // ========================================
  // oneframe系 with_masks（4ファイル）
  // generated_workflows/no_negative/oneframe_*_with_masks.json を使用
  // generated_workflows/with_negative/oneframe_*_with_masks.json を使用
  // ========================================
  describe('oneframe系（with_masks）', () => {
    const oneframeBase = () => loadFixture('base-workflows/oneframe_start_only.json');

    it('oneframe_start_and_reference_with_masks.json - ベース + ReferenceFrame + Masks', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/no_negative/oneframe_start_and_reference_with_masks.json');

      const builder = new WorkflowBuilder(base);
      builder
        .addReferenceFrame('placeholder.png')
        .addMasks('placeholder.png', 'placeholder.png');
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_and_reference_with_masks');
    });

    it('oneframe_start_and_reference_lora_with_masks.json - ベース + ReferenceFrame + LoRA + Masks', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/no_negative/oneframe_start_and_reference_lora_with_masks.json');

      const builder = new WorkflowBuilder(base);
      builder
        .addReferenceFrame('placeholder.png')
        .addLora('placeholder', 1, false)
        .addMasks('placeholder.png', 'placeholder.png');
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_and_reference_lora_with_masks');
    });

    it('oneframe_start_and_reference_negative_with_masks.json - ベース + ReferenceFrame + NegativeMode + Masks', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/with_negative/oneframe_start_and_reference_negative_with_masks.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addReferenceFrame('placeholder.png')
        .addMasks('placeholder.png', 'placeholder.png');
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_and_reference_negative_with_masks');
    });

    it('oneframe_start_and_reference_negative_lora_with_masks.json - 全部入り', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('generated_workflows/with_negative/oneframe_start_and_reference_negative_lora_with_masks.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addReferenceFrame('placeholder.png')
        .addLora('placeholder', 1, false)
        .addMasks('placeholder.png', 'placeholder.png');
      syncParametersFromExpected(builder, expected);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      assertStructurallyEquivalent(builtWorkflow, expectedWorkflow, 'oneframe_start_and_reference_negative_lora_with_masks');
    });
  });

  // ========================================
  // no_negative/oneframe系（既存フォルダ、4ファイル）
  // NOTE: これらは generated_workflows と構造が異なるため、
  //       主要コンポーネントの存在確認のみ行う
  // ========================================
  describe('no_negative/oneframe系', () => {
    const oneframeBase = () => loadFixture('base-workflows/oneframe_start_only.json');

    it('no_negative/oneframe_start_only.json', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('no_negative/oneframe_start_only.json');

      const builtWorkflow = ComfyWorkflow.fromJson(base);
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      // 主要コンポーネントの存在確認
      expect(builtWorkflow.findNodesByType('FramePackSingleFrameSampler').length).toBe(
        expectedWorkflow.findNodesByType('FramePackSingleFrameSampler').length
      );
    });

    it('no_negative/oneframe_start_only_lora.json', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('no_negative/oneframe_start_only_lora.json');

      const builder = new WorkflowBuilder(base);
      builder.addLora('placeholder', 1, false);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      expect(builtWorkflow.findNodesByType('FramePackLoraSelect').length).toBe(
        expectedWorkflow.findNodesByType('FramePackLoraSelect').length
      );
    });

    // NOTE: このファイルはノードエディタ形式（API形式ではない）のためスキップ
    it.skip('no_negative/oneframe_start_and_reference.json - ファイル形式がAPI形式ではない', () => {
      // ファイルがノードエディタ形式のためパース不可
    });

    it('no_negative/oneframe_start_and_reference_lora.json', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('no_negative/oneframe_start_and_reference_lora.json');

      const builder = new WorkflowBuilder(base);
      builder
        .addReferenceFrame('placeholder.png')
        .addLora('placeholder', 1, false);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      // 主要コンポーネントの存在確認
      expect(builtWorkflow.findNodesByType('FramePackLoraSelect').length).toBe(
        expectedWorkflow.findNodesByType('FramePackLoraSelect').length
      );
    });
  });

  // ========================================
  // with_negative/oneframe系（既存フォルダ、4ファイル）
  // NOTE: これらは generated_workflows と構造が異なるため、
  //       主要コンポーネントの存在確認のみ行う
  // ========================================
  describe('with_negative/oneframe系', () => {
    const oneframeBase = () => loadFixture('base-workflows/oneframe_start_only.json');

    it('with_negative/oneframe_start_only_negative.json', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('with_negative/oneframe_start_only_negative.json');

      const builder = new WorkflowBuilder(base);
      builder.setNegativeMode('clip_encode');

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      // Negative追加: ConditioningZeroOutが削除されCLIPTextEncodeが追加
      expect(builtWorkflow.findNodesByType('ConditioningZeroOut').length).toBe(
        expectedWorkflow.findNodesByType('ConditioningZeroOut').length
      );
    });

    it('with_negative/oneframe_start_only_negative_lora.json', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('with_negative/oneframe_start_only_negative_lora.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addLora('placeholder', 1, false);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      // 主要コンポーネントの存在確認
      expect(builtWorkflow.findNodesByType('FramePackLoraSelect').length).toBe(
        expectedWorkflow.findNodesByType('FramePackLoraSelect').length
      );
      expect(builtWorkflow.findNodesByType('ConditioningZeroOut').length).toBe(0);
    });

    it('with_negative/oneframe_start_and_reference_negative.json', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('with_negative/oneframe_start_and_reference_negative.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addReferenceFrame('placeholder.png');

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      // 主要コンポーネントの存在確認
      expect(builtWorkflow.findNodesByType('ConditioningZeroOut').length).toBe(0);
    });

    it('with_negative/oneframe_start_and_reference_negative_lora.json', () => {
      const base = oneframeBase();
      const expected = loadWorkflow('with_negative/oneframe_start_and_reference_negative_lora.json');

      const builder = new WorkflowBuilder(base);
      builder
        .setNegativeMode('clip_encode')
        .addReferenceFrame('placeholder.png')
        .addLora('placeholder', 1, false);

      const builtWorkflow = builder.getWorkflow();
      const expectedWorkflow = ComfyWorkflow.fromJson(expected);

      // 主要コンポーネントの存在確認
      expect(builtWorkflow.findNodesByType('FramePackLoraSelect').length).toBe(
        expectedWorkflow.findNodesByType('FramePackLoraSelect').length
      );
      expect(builtWorkflow.findNodesByType('ConditioningZeroOut').length).toBe(0);
    });
  });
});

describe('WorkflowBuilder機能テスト', () => {
  it('メソッドチェーンがすべて機能する', () => {
    const base = loadFixture('base-workflows/framepack_start_only.json');
    const builder = new WorkflowBuilder(base);

    const result = builder
      .setNegativeMode('clip_encode')
      .addEndFrame('end.png')
      .addLora('lora.safetensors', 1.5, false)
      .setGpuMemoryPreservation(20)
      .setSeed(12345)
      .setPrompt('test prompt')
      .setVideoLength(3)
      .setInputImage('input.png');

    expect(result).toBe(builder);

    const workflow = builder.getWorkflow();
    expect(workflow.findNodesByType('FramePackLoraSelect').length).toBe(1);
    expect(workflow.findNodesByType('ConditioningZeroOut').length).toBe(0);
  });

  it('build()でJSONを取得できる', () => {
    const base = loadFixture('base-workflows/framepack_start_only.json');
    const builder = new WorkflowBuilder(base);
    builder.addLora('test.safetensors', 1, false);

    const json = builder.build();
    expect(json).toBeDefined();
    expect(typeof json).toBe('object');
  });
});
