/**
 * ComfyUI Workflow Types
 */

/** ノード接続: [ノードID, ポート番号] */
export type NodeConnection = [string, number];

/** 入力値の型 */
export type InputValue = string | number | boolean | NodeConnection | null;

/** ノードのメタデータ */
export interface NodeMeta {
  title?: string;
}

/** ComfyUIノード */
export interface ComfyNode {
  inputs: { [key: string]: InputValue };
  class_type: string;
  _meta?: NodeMeta;
}

/** ワークフローJSON */
export interface ComfyWorkflowJson {
  [nodeId: string]: ComfyNode;
}

/** エッジ（接続）情報 */
export interface Edge {
  sourceNodeId: string;
  sourcePort: number;
  targetNodeId: string;
  targetInputName: string;
}

/** ノード追加時のオプション */
export interface AddNodeOptions {
  id?: string;
  meta?: NodeMeta;
}

/** 構造的差分の種類 */
export type StructuralDiffType =
  | 'class_type_count_mismatch'
  | 'missing_node_type'
  | 'extra_node_type'
  | 'input_mismatch'
  | 'connection_mismatch';

/** 構造的差分情報（デバッグ用） */
export interface StructuralDiff {
  type: StructuralDiffType;
  classType?: string;
  inputName?: string;
  expected?: unknown;
  actual?: unknown;
  details: string;
}

/**
 * 型ガード: 値がNodeConnectionかどうかを判定
 */
export function isNodeConnection(value: unknown): value is NodeConnection {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'number'
  );
}

/**
 * 型ガード: 値がComfyNodeかどうかを判定
 */
export function isComfyNode(value: unknown): value is ComfyNode {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.class_type === 'string' &&
    typeof obj.inputs === 'object' &&
    obj.inputs !== null
  );
}

/**
 * 型ガード: 値がComfyWorkflowJsonかどうかを判定
 */
export function isComfyWorkflowJson(value: unknown): value is ComfyWorkflowJson {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return Object.values(obj).every(isComfyNode);
}
