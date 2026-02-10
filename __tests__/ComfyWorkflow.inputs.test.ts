import { describe, it, expect } from 'vitest';
import { ComfyWorkflow } from '../ComfyWorkflow';
import sampleWorkflow from './fixtures/sample-workflow.json';

describe('ComfyWorkflow - 入力操作', () => {
  describe('setInput', () => {
    it('入力値を設定できる', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('KSampler', { steps: 20 });

      workflow.setInput(nodeId, 'steps', 30);

      expect(workflow.getNode(nodeId)?.inputs.steps).toBe(30);
    });

    it('新しい入力を追加できる', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('KSampler', {});

      workflow.setInput(nodeId, 'cfg', 7.5);

      expect(workflow.getNode(nodeId)?.inputs.cfg).toBe(7.5);
    });

    it('存在しないノードでエラーを投げる', () => {
      const workflow = new ComfyWorkflow();
      expect(() => workflow.setInput('nonexistent', 'steps', 20)).toThrow();
    });

    it('文字列、数値、真偽値を設定できる', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('TestNode', {});

      workflow.setInput(nodeId, 'stringValue', 'test');
      workflow.setInput(nodeId, 'numberValue', 42);
      workflow.setInput(nodeId, 'boolValue', true);

      const node = workflow.getNode(nodeId);
      expect(node?.inputs.stringValue).toBe('test');
      expect(node?.inputs.numberValue).toBe(42);
      expect(node?.inputs.boolValue).toBe(true);
    });

    it('nullを設定して入力を削除できる', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('KSampler', { steps: 20 });

      workflow.setInput(nodeId, 'steps', null);

      expect(workflow.getNode(nodeId)?.inputs.steps).toBeNull();
    });
  });

  describe('getInput', () => {
    it('入力値を取得できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const value = workflow.getInput('12', 'vae_name');
      expect(value).toBe('hunyuan_video_vae_bf16.safetensors');
    });

    it('存在しない入力はundefinedを返す', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      expect(workflow.getInput('12', 'nonexistent')).toBeUndefined();
    });

    it('存在しないノードはundefinedを返す', () => {
      const workflow = new ComfyWorkflow();
      expect(workflow.getInput('nonexistent', 'input')).toBeUndefined();
    });

    it('接続（NodeConnection）も取得できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const connection = workflow.getInput('17', 'clip_vision');
      expect(connection).toEqual(['18', 0]);
    });
  });

  describe('getInputs', () => {
    it('ノードの全入力を取得できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const inputs = workflow.getInputs('12');
      expect(inputs).toEqual({ vae_name: 'hunyuan_video_vae_bf16.safetensors' });
    });

    it('存在しないノードはundefinedを返す', () => {
      const workflow = new ComfyWorkflow();
      expect(workflow.getInputs('nonexistent')).toBeUndefined();
    });
  });

  describe('updateInputs', () => {
    it('複数の入力を一度に更新できる', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('KSampler', { steps: 20 });

      workflow.updateInputs(nodeId, { steps: 30, cfg: 7.5, seed: 12345 });

      const node = workflow.getNode(nodeId);
      expect(node?.inputs.steps).toBe(30);
      expect(node?.inputs.cfg).toBe(7.5);
      expect(node?.inputs.seed).toBe(12345);
    });

    it('存在しないノードでエラーを投げる', () => {
      const workflow = new ComfyWorkflow();
      expect(() => workflow.updateInputs('nonexistent', { steps: 20 })).toThrow();
    });
  });

  describe('clearInput', () => {
    it('入力を削除できる', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('KSampler', { steps: 20, cfg: 7.5 });

      workflow.clearInput(nodeId, 'steps');

      const inputs = workflow.getInputs(nodeId);
      expect(inputs?.steps).toBeUndefined();
      expect(inputs?.cfg).toBe(7.5);
    });

    it('存在しないノードでもエラーにならない', () => {
      const workflow = new ComfyWorkflow();
      expect(() => workflow.clearInput('nonexistent', 'input')).not.toThrow();
    });
  });
});
