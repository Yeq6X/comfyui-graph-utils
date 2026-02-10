import { describe, it, expect } from 'vitest';
import { ComfyWorkflow } from '../ComfyWorkflow';
import sampleWorkflow from './fixtures/sample-workflow.json';

describe('ComfyWorkflow - エッジ操作', () => {
  describe('addEdge', () => {
    it('エッジを追加できる', () => {
      const workflow = new ComfyWorkflow();
      const vaeId = workflow.addNode('VAELoader', { vae_name: 'model.safetensors' });
      const encodeId = workflow.addNode('VAEEncode', {});

      workflow.addEdge(vaeId, 0, encodeId, 'vae');

      const node = workflow.getNode(encodeId);
      expect(node?.inputs.vae).toEqual([vaeId, 0]);
    });

    it('存在しないソースノードでエラーを投げる', () => {
      const workflow = new ComfyWorkflow();
      const encodeId = workflow.addNode('VAEEncode', {});
      expect(() => workflow.addEdge('nonexistent', 0, encodeId, 'vae')).toThrow();
    });

    it('存在しないターゲットノードでエラーを投げる', () => {
      const workflow = new ComfyWorkflow();
      const vaeId = workflow.addNode('VAELoader', {});
      expect(() => workflow.addEdge(vaeId, 0, 'nonexistent', 'vae')).toThrow();
    });
  });

  describe('removeEdge', () => {
    it('エッジを削除できる', () => {
      const workflow = new ComfyWorkflow();
      const vaeId = workflow.addNode('VAELoader', {});
      const encodeId = workflow.addNode('VAEEncode', {});
      workflow.addEdge(vaeId, 0, encodeId, 'vae');

      expect(workflow.getNode(encodeId)?.inputs.vae).toBeDefined();

      workflow.removeEdge(encodeId, 'vae');

      expect(workflow.getNode(encodeId)?.inputs.vae).toBeUndefined();
    });

    it('存在しないエッジを削除してもエラーにならない', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('TestNode', {});
      expect(() => workflow.removeEdge(nodeId, 'nonexistent')).not.toThrow();
    });

    it('存在しないノードを指定してもエラーにならない', () => {
      const workflow = new ComfyWorkflow();
      expect(() => workflow.removeEdge('nonexistent', 'input')).not.toThrow();
    });
  });

  describe('getEdges', () => {
    it('全エッジを取得できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const edges = workflow.getEdges();

      // sampleWorkflowの接続を確認
      // ノード17は ["18", 0] と ["48", 0] の接続を持つ
      expect(edges.length).toBeGreaterThan(0);

      const edgeFrom18 = edges.find(e => e.sourceNodeId === '18');
      expect(edgeFrom18).toBeDefined();
      expect(edgeFrom18?.targetNodeId).toBe('17');
      expect(edgeFrom18?.targetInputName).toBe('clip_vision');
    });

    it('空のワークフローでは空配列を返す', () => {
      const workflow = new ComfyWorkflow();
      expect(workflow.getEdges()).toEqual([]);
    });

    it('接続のないノードのみのワークフローでは空配列を返す', () => {
      const workflow = new ComfyWorkflow();
      workflow.addNode('VAELoader', { vae_name: 'model.safetensors' });
      workflow.addNode('KSampler', { steps: 20 });
      expect(workflow.getEdges()).toEqual([]);
    });
  });

  describe('getEdgesFrom', () => {
    it('特定ノードからのエッジを取得できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const edges = workflow.getEdgesFrom('18');
      expect(edges.length).toBe(1);
      expect(edges[0].targetNodeId).toBe('17');
    });

    it('出力エッジのないノードでは空配列を返す', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('TestNode', {});
      expect(workflow.getEdgesFrom(nodeId)).toEqual([]);
    });
  });

  describe('getEdgesTo', () => {
    it('特定ノードへのエッジを取得できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const edges = workflow.getEdgesTo('17');
      expect(edges.length).toBe(2); // clip_visionとimageの2つの接続
    });

    it('入力エッジのないノードでは空配列を返す', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('TestNode', {});
      expect(workflow.getEdgesTo(nodeId)).toEqual([]);
    });
  });

  describe('hasConnection', () => {
    it('接続が存在するかチェックできる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      expect(workflow.hasConnection('18', '17')).toBe(true);
      expect(workflow.hasConnection('12', '17')).toBe(false);
    });
  });
});
