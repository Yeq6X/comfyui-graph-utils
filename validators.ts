import { ComfyWorkflowJson, isComfyWorkflowJson, isNodeConnection } from './types';

/**
 * バリデーションエラー
 */
export interface ValidationError {
  nodeId?: string;
  inputName?: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * ワークフローの構造をバリデート
 */
export function validateWorkflowStructure(json: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!isComfyWorkflowJson(json)) {
    errors.push({
      message: 'Invalid workflow structure: not a valid ComfyWorkflowJson',
      severity: 'error',
    });
    return { valid: false, errors, warnings };
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * ワークフローの接続をバリデート
 * - 存在しないノードへの参照がないか
 * - 孤立したノードがないか（警告）
 */
export function validateConnections(json: ComfyWorkflowJson): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const nodeIds = new Set(Object.keys(json));
  const referencedNodeIds = new Set<string>();

  // 各ノードの接続をチェック
  for (const [nodeId, node] of Object.entries(json)) {
    for (const [inputName, value] of Object.entries(node.inputs)) {
      if (isNodeConnection(value)) {
        const [sourceNodeId] = value;
        referencedNodeIds.add(sourceNodeId);
        referencedNodeIds.add(nodeId);

        if (!nodeIds.has(sourceNodeId)) {
          errors.push({
            nodeId,
            inputName,
            message: `Node "${nodeId}" references non-existent node "${sourceNodeId}" in input "${inputName}"`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 孤立したノードを警告
  for (const nodeId of nodeIds) {
    if (!referencedNodeIds.has(nodeId)) {
      warnings.push({
        nodeId,
        message: `Node "${nodeId}" is isolated (no incoming or outgoing connections)`,
        severity: 'warning',
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * ワークフロー全体をバリデート
 */
export function validateWorkflow(json: unknown): ValidationResult {
  // 構造チェック
  const structureResult = validateWorkflowStructure(json);
  if (!structureResult.valid) {
    return structureResult;
  }

  // 接続チェック
  const connectionResult = validateConnections(json as ComfyWorkflowJson);

  return {
    valid: connectionResult.valid,
    errors: [...structureResult.errors, ...connectionResult.errors],
    warnings: [...structureResult.warnings, ...connectionResult.warnings],
  };
}
