/**
 * ComfyUI Workflow Library
 *
 * ComfyUIのワークフローJSONを操作するためのライブラリ
 * langgraph風のAPIデザインを採用
 *
 * @example
 * ```typescript
 * import { ComfyWorkflow } from './lib/comfyui-workflow';
 *
 * // 新規作成
 * const workflow = new ComfyWorkflow();
 * const vaeId = workflow.addNode('VAELoader', { vae_name: 'model.safetensors' });
 * const samplerId = workflow.addNode('KSampler', { steps: 20 });
 * workflow.addEdge(vaeId, 0, samplerId, 'model');
 * workflow.setInput(samplerId, 'steps', 30);
 * const json = workflow.toJson();
 *
 * // 既存JSONから読み込み
 * const loaded = ComfyWorkflow.fromJson(existingJson);
 * ```
 */

export { ComfyWorkflow } from './ComfyWorkflow';
export {
  type NodeConnection,
  type InputValue,
  type NodeMeta,
  type ComfyNode,
  type ComfyWorkflowJson,
  type Edge,
  type AddNodeOptions,
  type StructuralDiff,
  type StructuralDiffType,
  isNodeConnection,
  isComfyNode,
  isComfyWorkflowJson,
} from './types';
export {
  type ValidationError,
  type ValidationResult,
  validateWorkflowStructure,
  validateConnections,
  validateWorkflow,
} from './validators';
