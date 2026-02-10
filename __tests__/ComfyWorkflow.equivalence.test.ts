import { describe, it, expect } from 'vitest';
import { ComfyWorkflow } from '../ComfyWorkflow';

describe('ComfyWorkflow - 構造的等価性', () => {
  describe('isStructurallyEquivalentTo', () => {
    it('同一のワークフローは等価', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('VAELoader', { vae_name: 'model.safetensors' }, { id: '1' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('VAELoader', { vae_name: 'model.safetensors' }, { id: '1' });

      expect(workflow1.isStructurallyEquivalentTo(workflow2)).toBe(true);
    });

    it('IDが異なっても構造が同じなら等価', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('VAELoader', { vae_name: 'model.safetensors' }, { id: '1' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('VAELoader', { vae_name: 'model.safetensors' }, { id: '99' });

      expect(workflow1.isStructurallyEquivalentTo(workflow2)).toBe(true);
    });

    it('入力値が異なると非等価', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('VAELoader', { vae_name: 'model1.safetensors' }, { id: '1' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('VAELoader', { vae_name: 'model2.safetensors' }, { id: '1' });

      expect(workflow1.isStructurallyEquivalentTo(workflow2)).toBe(false);
    });

    it('ノード数が異なると非等価', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('VAELoader', {}, { id: '1' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('VAELoader', {}, { id: '1' });
      workflow2.addNode('VAELoader', {}, { id: '2' });

      expect(workflow1.isStructurallyEquivalentTo(workflow2)).toBe(false);
    });

    it('class_typeが異なると非等価', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('VAELoader', {}, { id: '1' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('KSampler', {}, { id: '1' });

      expect(workflow1.isStructurallyEquivalentTo(workflow2)).toBe(false);
    });

    it('接続先のclass_typeが同じなら等価（IDが違っても）', () => {
      // workflow1: VAELoader(1) -> VAEEncode(2)
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('VAELoader', {}, { id: '1' });
      workflow1.addNode('VAEEncode', {}, { id: '2' });
      workflow1.addEdge('1', 0, '2', 'vae');

      // workflow2: VAELoader(99) -> VAEEncode(100)
      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('VAELoader', {}, { id: '99' });
      workflow2.addNode('VAEEncode', {}, { id: '100' });
      workflow2.addEdge('99', 0, '100', 'vae');

      expect(workflow1.isStructurallyEquivalentTo(workflow2)).toBe(true);
    });

    it('接続先のclass_typeが異なると非等価', () => {
      // workflow1: VAELoader -> VAEEncode
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('VAELoader', {}, { id: '1' });
      workflow1.addNode('VAEEncode', {}, { id: '2' });
      workflow1.addEdge('1', 0, '2', 'vae');

      // workflow2: KSampler -> VAEEncode
      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('KSampler', {}, { id: '1' });
      workflow2.addNode('VAEEncode', {}, { id: '2' });
      workflow2.addEdge('1', 0, '2', 'vae');

      expect(workflow1.isStructurallyEquivalentTo(workflow2)).toBe(false);
    });

    it('空のワークフロー同士は等価', () => {
      const workflow1 = new ComfyWorkflow();
      const workflow2 = new ComfyWorkflow();

      expect(workflow1.isStructurallyEquivalentTo(workflow2)).toBe(true);
    });

    it('複数の同じclass_typeのノードがある場合も正しく比較', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('LoadImage', { image: 'a.png' }, { id: '1' });
      workflow1.addNode('LoadImage', { image: 'b.png' }, { id: '2' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('LoadImage', { image: 'a.png' }, { id: '10' });
      workflow2.addNode('LoadImage', { image: 'b.png' }, { id: '20' });

      expect(workflow1.isStructurallyEquivalentTo(workflow2)).toBe(true);
    });
  });

  describe('getStructuralDiff', () => {
    it('等価なワークフローは空の差分を返す', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('VAELoader', { vae_name: 'model.safetensors' }, { id: '1' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('VAELoader', { vae_name: 'model.safetensors' }, { id: '99' });

      const diffs = workflow1.getStructuralDiff(workflow2);
      expect(diffs).toEqual([]);
    });

    it('ノード数の差異を検出', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('VAELoader', {}, { id: '1' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('VAELoader', {}, { id: '1' });
      workflow2.addNode('VAELoader', {}, { id: '2' });

      const diffs = workflow1.getStructuralDiff(workflow2);
      expect(diffs.length).toBe(1);
      expect(diffs[0].type).toBe('class_type_count_mismatch');
      expect(diffs[0].classType).toBe('VAELoader');
    });

    it('入力値の差異を検出', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('KSampler', { steps: 20 }, { id: '1' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('KSampler', { steps: 30 }, { id: '1' });

      const diffs = workflow1.getStructuralDiff(workflow2);
      expect(diffs.length).toBe(1);
      expect(diffs[0].type).toBe('input_mismatch');
      expect(diffs[0].inputName).toBe('steps');
      expect(diffs[0].expected).toBe(30);
      expect(diffs[0].actual).toBe(20);
    });

    it('接続の差異を検出', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('VAELoader', {}, { id: '1' });
      workflow1.addNode('KSampler', {}, { id: '2' });
      workflow1.addNode('VAEEncode', {}, { id: '3' });
      workflow1.addEdge('1', 0, '3', 'vae');

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('VAELoader', {}, { id: '1' });
      workflow2.addNode('KSampler', {}, { id: '2' });
      workflow2.addNode('VAEEncode', {}, { id: '3' });
      workflow2.addEdge('2', 0, '3', 'vae'); // KSamplerから接続（間違い）

      const diffs = workflow1.getStructuralDiff(workflow2);
      expect(diffs.length).toBe(1);
      expect(diffs[0].type).toBe('connection_mismatch');
    });

    it('不足している入力を検出', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('KSampler', {}, { id: '1' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('KSampler', { steps: 20 }, { id: '1' });

      const diffs = workflow1.getStructuralDiff(workflow2);
      expect(diffs.length).toBe(1);
      expect(diffs[0].type).toBe('input_mismatch');
      expect(diffs[0].details).toContain('missing');
    });

    it('余分な入力を検出', () => {
      const workflow1 = new ComfyWorkflow();
      workflow1.addNode('KSampler', { steps: 20, extra: 'value' }, { id: '1' });

      const workflow2 = new ComfyWorkflow();
      workflow2.addNode('KSampler', { steps: 20 }, { id: '1' });

      const diffs = workflow1.getStructuralDiff(workflow2);
      expect(diffs.length).toBe(1);
      expect(diffs[0].type).toBe('input_mismatch');
      expect(diffs[0].details).toContain('extra');
    });
  });

  describe('実際のワークフローパターン', () => {
    it('LoRA追加パターンで等価性を確認', () => {
      // ベースワークフロー
      const base = new ComfyWorkflow();
      const modelId = base.addNode('LoadFramePackModel', { model: 'model.safetensors' });
      const samplerId = base.addNode('FramePackSampler', { steps: 20 });
      base.addEdge(modelId, 0, samplerId, 'model');

      // LoRA追加版
      const withLora = new ComfyWorkflow();
      const loraId = withLora.addNode('FramePackLoraSelect', { lora: 'lora.safetensors' });
      const modelId2 = withLora.addNode('LoadFramePackModel', { model: 'model.safetensors' });
      const samplerId2 = withLora.addNode('FramePackSampler', { steps: 20 });
      withLora.addEdge(loraId, 0, modelId2, 'lora');
      withLora.addEdge(modelId2, 0, samplerId2, 'model');

      // ベースとLoRA版は構造が異なる
      expect(base.isStructurallyEquivalentTo(withLora)).toBe(false);

      // 同じLoRA版同士は等価（IDが異なっても）
      const withLora2 = new ComfyWorkflow();
      const loraId2 = withLora2.addNode('FramePackLoraSelect', { lora: 'lora.safetensors' });
      const modelId3 = withLora2.addNode('LoadFramePackModel', { model: 'model.safetensors' });
      const samplerId3 = withLora2.addNode('FramePackSampler', { steps: 20 });
      withLora2.addEdge(loraId2, 0, modelId3, 'lora');
      withLora2.addEdge(modelId3, 0, samplerId3, 'model');

      expect(withLora.isStructurallyEquivalentTo(withLora2)).toBe(true);
    });
  });
});
