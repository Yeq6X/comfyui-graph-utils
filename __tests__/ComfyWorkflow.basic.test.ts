import { describe, it, expect } from 'vitest';
import { ComfyWorkflow } from '../ComfyWorkflow';
import { isNodeConnection, isComfyNode, isComfyWorkflowJson } from '../types';
import sampleWorkflow from './fixtures/sample-workflow.json';

describe('型ガード関数', () => {
  describe('isNodeConnection', () => {
    it('有効なNodeConnectionを判定できる', () => {
      expect(isNodeConnection(['12', 0])).toBe(true);
      expect(isNodeConnection(['node1', 5])).toBe(true);
    });

    it('無効な値を拒否する', () => {
      expect(isNodeConnection(null)).toBe(false);
      expect(isNodeConnection(undefined)).toBe(false);
      expect(isNodeConnection('string')).toBe(false);
      expect(isNodeConnection(123)).toBe(false);
      expect(isNodeConnection([])).toBe(false);
      expect(isNodeConnection(['12'])).toBe(false);
      expect(isNodeConnection([12, 0])).toBe(false); // 最初の要素が数値
      expect(isNodeConnection(['12', '0'])).toBe(false); // 2番目の要素が文字列
      expect(isNodeConnection(['12', 0, 'extra'])).toBe(false);
    });
  });

  describe('isComfyNode', () => {
    it('有効なComfyNodeを判定できる', () => {
      const validNode = {
        inputs: { vae_name: 'model.safetensors' },
        class_type: 'VAELoader',
      };
      expect(isComfyNode(validNode)).toBe(true);
    });

    it('_metaを持つノードも有効', () => {
      const nodeWithMeta = {
        inputs: {},
        class_type: 'TestNode',
        _meta: { title: 'テスト' },
      };
      expect(isComfyNode(nodeWithMeta)).toBe(true);
    });

    it('無効な値を拒否する', () => {
      expect(isComfyNode(null)).toBe(false);
      expect(isComfyNode(undefined)).toBe(false);
      expect(isComfyNode({})).toBe(false);
      expect(isComfyNode({ inputs: {} })).toBe(false); // class_type missing
      expect(isComfyNode({ class_type: 'Test' })).toBe(false); // inputs missing
    });
  });

  describe('isComfyWorkflowJson', () => {
    it('有効なワークフローJSONを判定できる', () => {
      expect(isComfyWorkflowJson(sampleWorkflow)).toBe(true);
    });

    it('空のオブジェクトも有効', () => {
      expect(isComfyWorkflowJson({})).toBe(true);
    });

    it('無効な値を拒否する', () => {
      expect(isComfyWorkflowJson(null)).toBe(false);
      expect(isComfyWorkflowJson({ '1': 'invalid' })).toBe(false);
    });
  });
});

describe('ComfyWorkflow', () => {
  describe('constructor', () => {
    it('空のワークフローを作成できる', () => {
      const workflow = new ComfyWorkflow();
      expect(workflow).toBeInstanceOf(ComfyWorkflow);
      expect(workflow.getNodes()).toEqual({});
    });
  });

  describe('fromJson', () => {
    it('JSONからワークフローを読み込める', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      expect(workflow).toBeInstanceOf(ComfyWorkflow);
      expect(workflow.getNode('12')).toBeDefined();
      expect(workflow.getNode('12')?.class_type).toBe('VAELoader');
    });

    it('JSONを文字列として渡しても読み込める', () => {
      const jsonString = JSON.stringify(sampleWorkflow);
      const workflow = ComfyWorkflow.fromJson(jsonString);
      expect(workflow.getNode('12')?.class_type).toBe('VAELoader');
    });

    it('無効なJSONでエラーを投げる', () => {
      expect(() => ComfyWorkflow.fromJson('invalid json')).toThrow();
    });

    it('無効なワークフロー構造でエラーを投げる', () => {
      expect(() => ComfyWorkflow.fromJson({ '1': 'invalid' })).toThrow();
    });
  });

  describe('toJson', () => {
    it('ワークフローをJSONとしてエクスポートできる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const exported = workflow.toJson();
      expect(exported).toEqual(sampleWorkflow);
    });

    it('空のワークフローをエクスポートできる', () => {
      const workflow = new ComfyWorkflow();
      const exported = workflow.toJson();
      expect(exported).toEqual({});
    });

    it('ノード追加後に正しくエクスポートできる', () => {
      const workflow = new ComfyWorkflow();
      const nodeId = workflow.addNode('VAELoader', { vae_name: 'model.safetensors' });
      const exported = workflow.toJson();
      expect(exported[nodeId]).toBeDefined();
      expect(exported[nodeId].class_type).toBe('VAELoader');
      expect(exported[nodeId].inputs.vae_name).toBe('model.safetensors');
    });
  });

  describe('toJsonString', () => {
    it('JSON文字列としてエクスポートできる', () => {
      const workflow = ComfyWorkflow.fromJson(sampleWorkflow);
      const jsonString = workflow.toJsonString();
      expect(typeof jsonString).toBe('string');
      expect(JSON.parse(jsonString)).toEqual(sampleWorkflow);
    });

    it('インデント付きでエクスポートできる', () => {
      const workflow = new ComfyWorkflow();
      workflow.addNode('VAELoader', {});
      const jsonString = workflow.toJsonString(2);
      expect(jsonString).toContain('\n');
    });
  });
});
