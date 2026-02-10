import { describe, it, expect } from 'vitest';
import { ComfyWorkflow } from '../ComfyWorkflow';
import sampleWorkflow from './fixtures/sample-workflow.json';

describe('ComfyWorkflow - ノード操作', () => {
  describe('addNode', () => {
    it('ノードを追加してIDを返す', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('VAELoader', { vae_name: 'model.safetensors' });
      expect(typeof nodeId).toBe('string');
      expect(workflow.getNode(nodeId)).toBeDefined();
    });

    it('空の入力でノードを追加できる', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('EmptyNode');
      const node = workflow.getNode(nodeId);
      expect(node?.class_type).toBe('EmptyNode');
      expect(node?.inputs).toEqual({});
    });

    it('既存のワークフローに追加すると最大ID+1が使われる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      // sampleWorkflowの最大IDは50
      const nodeId = workflow.addNode('NewNode', {});
      expect(parseInt(nodeId)).toBeGreaterThan(50);
    });

    it('カスタムIDを指定できる', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('VAELoader', {}, { id: 'custom_id' });
      expect(nodeId).toBe('custom_id');
      expect(workflow.getNode('custom_id')).toBeDefined();
    });

    it('既存のIDを指定するとエラーを投げる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      expect(() => workflow.addNode('VAELoader', {}, { id: '12' })).toThrow();
    });

    it('メタデータ付きでノードを追加できる', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('VAELoader', {}, { meta: { title: 'My VAE' } });
      const node = workflow.getNode(nodeId);
      expect(node?._meta?.title).toBe('My VAE');
    });
  });

  describe('removeNode', () => {
    it('ノードを削除できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      expect(workflow.getNode('12')).toBeDefined();
      workflow.removeNode('12');
      expect(workflow.getNode('12')).toBeUndefined();
    });

    it('存在しないノードを削除してもエラーにならない', () => {
      const workflow = new ComfyWorkflow();
      expect(() => workflow.removeNode('nonexistent')).not.toThrow();
    });

    it('ノード削除時に関連するエッジも削除される', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      // ノード17はノード18からの接続を持つ
      const edgesBefore = workflow.getEdges();
      const hasEdgeFrom18 = edgesBefore.some(e => e.sourceNodeId === '18');
      expect(hasEdgeFrom18).toBe(true);

      workflow.removeNode('18');
      const edgesAfter = workflow.getEdges();
      const stillHasEdgeFrom18 = edgesAfter.some(e => e.sourceNodeId === '18');
      expect(stillHasEdgeFrom18).toBe(false);
    });
  });

  describe('getNode', () => {
    it('存在するノードを取得できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const node = workflow.getNode('12');
      expect(node).toBeDefined();
      expect(node?.class_type).toBe('VAELoader');
    });

    it('存在しないノードはundefinedを返す', () => {
      const workflow = new ComfyWorkflow();
      expect(workflow.getNode('nonexistent')).toBeUndefined();
    });
  });

  describe('getNodes', () => {
    it('全ノードを取得できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const nodes = workflow.getNodes();
      expect(Object.keys(nodes).length).toBe(6);
      expect(nodes['12']).toBeDefined();
      expect(nodes['13']).toBeDefined();
    });

    it('空のワークフローでは空オブジェクトを返す', () => {
      const workflow = new ComfyWorkflow();
      expect(workflow.getNodes()).toEqual({});
    });
  });

  describe('findNodesByType', () => {
    it('タイプでノードを検索できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const vaeLoaders = workflow.findNodesByType('VAELoader');
      expect(vaeLoaders.length).toBe(1);
      expect(vaeLoaders[0].id).toBe('12');
      expect(vaeLoaders[0].node.class_type).toBe('VAELoader');
    });

    it('存在しないタイプでは空配列を返す', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const results = workflow.findNodesByType('NonExistentType');
      expect(results).toEqual([]);
    });

    it('複数のノードがマッチする場合は全て返す', () => {
      const workflow = new ComfyWorkflow();
      workflow.addNode('KSampler', { steps: 20 });
      workflow.addNode('KSampler', { steps: 30 });
      workflow.addNode('VAELoader', {});
      const samplers = workflow.findNodesByType('KSampler');
      expect(samplers.length).toBe(2);
    });
  });

  describe('getNodeCount', () => {
    it('ノード数を取得できる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      expect(workflow.getNodeCount()).toBe(6);
    });

    it('空のワークフローでは0を返す', () => {
      const workflow = new ComfyWorkflow();
      expect(workflow.getNodeCount()).toBe(0);
    });
  });
});
