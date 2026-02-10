import { describe, it, expect } from 'vitest';
import {
  validateWorkflowStructure,
  validateConnections,
  validateWorkflow,
} from '../validators';
import sampleWorkflow from './fixtures/sample-workflow.json';

describe('バリデーション関数', () => {
  describe('validateWorkflowStructure', () => {
    it('有効なワークフローを検証できる', () => {
      const result = validateWorkflowStructure(sampleWorkflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('無効な構造を検出する', () => {
      const result = validateWorkflowStructure({ '1': 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('nullを検出する', () => {
      const result = validateWorkflowStructure(null);
      expect(result.valid).toBe(false);
    });

    it('空のオブジェクトは有効', () => {
      const result = validateWorkflowStructure({});
      expect(result.valid).toBe(true);
    });
  });

  describe('validateConnections', () => {
    it('有効な接続を検証できる', () => {
      const result = validateConnections(sampleWorkflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('存在しないノードへの参照を検出する', () => {
      const invalidWorkflow = {
        '1': {
          inputs: { input: ['nonexistent', 0] },
          class_type: 'TestNode',
        },
      };
      const result = validateConnections(invalidWorkflow);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('nonexistent');
    });

    it('孤立したノードを警告する', () => {
      const isolatedWorkflow = {
        '1': { inputs: {}, class_type: 'IsolatedNode' },
        '2': { inputs: { input: ['3', 0] }, class_type: 'ConnectedNode' },
        '3': { inputs: {}, class_type: 'SourceNode' },
      };
      const result = validateConnections(isolatedWorkflow);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].nodeId).toBe('1');
    });
  });

  describe('validateWorkflow', () => {
    it('有効なワークフローを検証できる', () => {
      const result = validateWorkflow(sampleWorkflow);
      expect(result.valid).toBe(true);
    });

    it('構造エラーと接続エラーを組み合わせる', () => {
      const result = validateWorkflow(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
