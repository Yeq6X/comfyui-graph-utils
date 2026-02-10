import {
  ComfyNode,
  ComfyWorkflowJson,
  Edge,
  InputValue,
  AddNodeOptions,
  StructuralDiff,
  isComfyWorkflowJson,
  isNodeConnection,
} from './types';

/**
 * ComfyUIワークフローを操作するクラス
 * langgraph風のAPIデザインを採用
 */
export class ComfyWorkflow {
  private nodes: ComfyWorkflowJson = {};

  /**
   * 空のワークフローを作成
   */
  constructor() {
    this.nodes = {};
  }

  /**
   * JSONからワークフローを読み込む
   * @param json ワークフローJSON（オブジェクトまたは文字列）
   */
  static fromJson(json: ComfyWorkflowJson | string): ComfyWorkflow {
    const workflow = new ComfyWorkflow();

    let parsed: unknown;
    if (typeof json === 'string') {
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error('Invalid JSON string');
      }
    } else {
      parsed = json;
    }

    if (!isComfyWorkflowJson(parsed)) {
      throw new Error('Invalid workflow JSON structure');
    }

    // ディープコピーを作成
    workflow.nodes = JSON.parse(JSON.stringify(parsed));
    return workflow;
  }

  /**
   * ワークフローをJSONとしてエクスポート
   */
  toJson(): ComfyWorkflowJson {
    return JSON.parse(JSON.stringify(this.nodes));
  }

  /**
   * ワークフローをJSON文字列としてエクスポート
   * @param indent インデント（オプション）
   */
  toJsonString(indent?: number): string {
    return JSON.stringify(this.nodes, null, indent);
  }

  // ============================================
  // ノード操作
  // ============================================

  /**
   * ノードを追加
   * @param classType ノードのクラスタイプ
   * @param inputs 入力値（オプション）
   * @param options オプション（ID、メタデータなど）
   * @returns 追加されたノードのID
   */
  addNode(
    classType: string,
    inputs: { [key: string]: InputValue } = {},
    options: AddNodeOptions = {}
  ): string {
    const nodeId = options.id ?? this.generateNodeId();

    if (this.nodes[nodeId]) {
      throw new Error(`Node with ID "${nodeId}" already exists`);
    }

    const node: ComfyNode = {
      inputs: { ...inputs },
      class_type: classType,
    };

    if (options.meta) {
      node._meta = { ...options.meta };
    }

    this.nodes[nodeId] = node;
    return nodeId;
  }

  /**
   * ノードを削除
   * @param nodeId 削除するノードのID
   */
  removeNode(nodeId: string): void {
    if (!this.nodes[nodeId]) {
      return;
    }

    // 関連するエッジを削除
    for (const [id, node] of Object.entries(this.nodes)) {
      for (const [inputName, value] of Object.entries(node.inputs)) {
        if (isNodeConnection(value) && value[0] === nodeId) {
          delete this.nodes[id].inputs[inputName];
        }
      }
    }

    delete this.nodes[nodeId];
  }

  /**
   * ノードを取得
   * @param nodeId ノードID
   */
  getNode(nodeId: string): ComfyNode | undefined {
    const node = this.nodes[nodeId];
    if (!node) return undefined;
    return JSON.parse(JSON.stringify(node));
  }

  /**
   * 全ノードを取得
   */
  getNodes(): ComfyWorkflowJson {
    return JSON.parse(JSON.stringify(this.nodes));
  }

  /**
   * ノード数を取得
   */
  getNodeCount(): number {
    return Object.keys(this.nodes).length;
  }

  /**
   * タイプでノードを検索
   * @param classType 検索するクラスタイプ
   */
  findNodesByType(classType: string): { id: string; node: ComfyNode }[] {
    const results: { id: string; node: ComfyNode }[] = [];
    for (const [id, node] of Object.entries(this.nodes)) {
      if (node.class_type === classType) {
        results.push({ id, node: JSON.parse(JSON.stringify(node)) });
      }
    }
    return results;
  }

  // ============================================
  // エッジ操作
  // ============================================

  /**
   * エッジを追加
   * @param sourceNodeId ソースノードID
   * @param sourcePort ソースポート番号
   * @param targetNodeId ターゲットノードID
   * @param targetInputName ターゲット入力名
   */
  addEdge(
    sourceNodeId: string,
    sourcePort: number,
    targetNodeId: string,
    targetInputName: string
  ): void {
    if (!this.nodes[sourceNodeId]) {
      throw new Error(`Source node "${sourceNodeId}" does not exist`);
    }
    if (!this.nodes[targetNodeId]) {
      throw new Error(`Target node "${targetNodeId}" does not exist`);
    }

    this.nodes[targetNodeId].inputs[targetInputName] = [sourceNodeId, sourcePort];
  }

  /**
   * エッジを削除
   * @param targetNodeId ターゲットノードID
   * @param inputName 入力名
   */
  removeEdge(targetNodeId: string, inputName: string): void {
    const node = this.nodes[targetNodeId];
    if (!node) return;

    if (isNodeConnection(node.inputs[inputName])) {
      delete node.inputs[inputName];
    }
  }

  /**
   * 全エッジを取得
   */
  getEdges(): Edge[] {
    const edges: Edge[] = [];

    for (const [targetNodeId, node] of Object.entries(this.nodes)) {
      for (const [inputName, value] of Object.entries(node.inputs)) {
        if (isNodeConnection(value)) {
          edges.push({
            sourceNodeId: value[0],
            sourcePort: value[1],
            targetNodeId,
            targetInputName: inputName,
          });
        }
      }
    }

    return edges;
  }

  /**
   * 特定ノードからのエッジを取得
   * @param sourceNodeId ソースノードID
   */
  getEdgesFrom(sourceNodeId: string): Edge[] {
    return this.getEdges().filter(edge => edge.sourceNodeId === sourceNodeId);
  }

  /**
   * 特定ノードへのエッジを取得
   * @param targetNodeId ターゲットノードID
   */
  getEdgesTo(targetNodeId: string): Edge[] {
    return this.getEdges().filter(edge => edge.targetNodeId === targetNodeId);
  }

  /**
   * 2つのノード間に接続があるか確認
   * @param sourceNodeId ソースノードID
   * @param targetNodeId ターゲットノードID
   */
  hasConnection(sourceNodeId: string, targetNodeId: string): boolean {
    return this.getEdges().some(
      edge => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId
    );
  }

  // ============================================
  // 入力操作
  // ============================================

  /**
   * 入力値を設定
   * @param nodeId ノードID
   * @param name 入力名
   * @param value 値
   */
  setInput(nodeId: string, name: string, value: InputValue): void {
    const node = this.nodes[nodeId];
    if (!node) {
      throw new Error(`Node "${nodeId}" does not exist`);
    }
    node.inputs[name] = value;
  }

  /**
   * 入力値を取得
   * @param nodeId ノードID
   * @param name 入力名
   */
  getInput(nodeId: string, name: string): InputValue | undefined {
    const node = this.nodes[nodeId];
    if (!node) return undefined;
    return node.inputs[name];
  }

  /**
   * ノードの全入力を取得
   * @param nodeId ノードID
   */
  getInputs(nodeId: string): { [key: string]: InputValue } | undefined {
    const node = this.nodes[nodeId];
    if (!node) return undefined;
    return { ...node.inputs };
  }

  /**
   * 複数の入力を一度に更新
   * @param nodeId ノードID
   * @param inputs 入力値のオブジェクト
   */
  updateInputs(nodeId: string, inputs: { [key: string]: InputValue }): void {
    const node = this.nodes[nodeId];
    if (!node) {
      throw new Error(`Node "${nodeId}" does not exist`);
    }
    Object.assign(node.inputs, inputs);
  }

  /**
   * 入力を削除
   * @param nodeId ノードID
   * @param name 入力名
   */
  clearInput(nodeId: string, name: string): void {
    const node = this.nodes[nodeId];
    if (!node) return;
    delete node.inputs[name];
  }

  // ============================================
  // 等価性比較
  // ============================================

  /**
   * 構造的等価性を比較（IDを無視し、class_typeと入力値で比較）
   * @param other 比較対象のワークフロー
   * @returns 構造的に等価ならtrue
   */
  isStructurallyEquivalentTo(other: ComfyWorkflow): boolean {
    return this.getStructuralDiff(other).length === 0;
  }

  /**
   * 構造的差分を取得（デバッグ用）
   * @param other 比較対象のワークフロー
   * @returns 差分情報の配列（空配列なら等価）
   */
  getStructuralDiff(other: ComfyWorkflow): StructuralDiff[] {
    const diffs: StructuralDiff[] = [];

    const thisGrouped = this.groupNodesByType();
    const otherGrouped = other.groupNodesByType();

    const allClassTypes = new Set([
      ...Object.keys(thisGrouped),
      ...Object.keys(otherGrouped),
    ]);

    for (const classType of allClassTypes) {
      const thisNodes = thisGrouped[classType] || [];
      const otherNodes = otherGrouped[classType] || [];

      // ノード数の比較
      if (thisNodes.length !== otherNodes.length) {
        diffs.push({
          type: 'class_type_count_mismatch',
          classType,
          expected: otherNodes.length,
          actual: thisNodes.length,
          details: `${classType}: expected ${otherNodes.length} nodes, got ${thisNodes.length}`,
        });
        continue;
      }

      // 同じclass_typeのノード同士で入力値を比較
      // ノードが1つだけの場合は直接比較、複数の場合はマッチングを試みる
      if (thisNodes.length === 1) {
        const inputDiffs = this.compareNodeInputs(
          thisNodes[0].node,
          otherNodes[0].node,
          other
        );
        diffs.push(...inputDiffs.map(d => ({ ...d, classType })));
      } else if (thisNodes.length > 1) {
        // 複数ノードの場合、最適なマッチングを探す
        const matchResult = this.findBestNodeMatching(thisNodes, otherNodes, other);
        diffs.push(...matchResult.map(d => ({ ...d, classType })));
      }
    }

    return diffs;
  }

  /**
   * ノードをclass_typeでグループ化
   */
  private groupNodesByType(): { [classType: string]: { id: string; node: ComfyNode }[] } {
    const grouped: { [classType: string]: { id: string; node: ComfyNode }[] } = {};
    for (const [id, node] of Object.entries(this.nodes)) {
      if (!grouped[node.class_type]) {
        grouped[node.class_type] = [];
      }
      grouped[node.class_type].push({ id, node });
    }
    return grouped;
  }

  /**
   * 2つのノードの入力値を比較
   */
  private compareNodeInputs(
    thisNode: ComfyNode,
    otherNode: ComfyNode,
    otherWorkflow: ComfyWorkflow
  ): StructuralDiff[] {
    const diffs: StructuralDiff[] = [];

    const allInputNames = new Set([
      ...Object.keys(thisNode.inputs),
      ...Object.keys(otherNode.inputs),
    ]);

    for (const inputName of allInputNames) {
      const thisValue = thisNode.inputs[inputName];
      const otherValue = otherNode.inputs[inputName];

      // 両方とも接続の場合
      if (isNodeConnection(thisValue) && isNodeConnection(otherValue)) {
        const thisNormalized = this.normalizeConnection(thisValue);
        const otherNormalized = otherWorkflow.normalizeConnection(otherValue);

        if (thisNormalized !== otherNormalized) {
          diffs.push({
            type: 'connection_mismatch',
            inputName,
            expected: otherNormalized,
            actual: thisNormalized,
            details: `Input "${inputName}": connection mismatch - expected ${otherNormalized}, got ${thisNormalized}`,
          });
        }
      }
      // 片方だけ接続の場合
      else if (isNodeConnection(thisValue) !== isNodeConnection(otherValue)) {
        diffs.push({
          type: 'input_mismatch',
          inputName,
          expected: otherValue,
          actual: thisValue,
          details: `Input "${inputName}": type mismatch - one is connection, other is value`,
        });
      }
      // 両方とも値の場合
      else if (thisValue !== otherValue) {
        // undefinedとの比較（片方にだけ存在する入力）
        if (thisValue === undefined) {
          diffs.push({
            type: 'input_mismatch',
            inputName,
            expected: otherValue,
            actual: undefined,
            details: `Input "${inputName}": missing in this workflow`,
          });
        } else if (otherValue === undefined) {
          diffs.push({
            type: 'input_mismatch',
            inputName,
            expected: undefined,
            actual: thisValue,
            details: `Input "${inputName}": extra in this workflow`,
          });
        } else {
          diffs.push({
            type: 'input_mismatch',
            inputName,
            expected: otherValue,
            actual: thisValue,
            details: `Input "${inputName}": expected ${JSON.stringify(otherValue)}, got ${JSON.stringify(thisValue)}`,
          });
        }
      }
    }

    return diffs;
  }

  /**
   * 接続を正規化（ノードIDではなくclass_type:portで表現）
   */
  private normalizeConnection(connection: [string, number]): string {
    const [nodeId, port] = connection;
    const node = this.nodes[nodeId];
    if (!node) {
      return `UNKNOWN:${port}`;
    }
    return `${node.class_type}:${port}`;
  }

  /**
   * 複数ノードの最適なマッチングを探す
   */
  private findBestNodeMatching(
    thisNodes: { id: string; node: ComfyNode }[],
    otherNodes: { id: string; node: ComfyNode }[],
    otherWorkflow: ComfyWorkflow
  ): StructuralDiff[] {
    // 簡易実装: 入力値のハッシュでマッチングを試みる
    const thisHashes = thisNodes.map(n => this.hashNodeInputs(n.node));
    const otherHashes = otherNodes.map(n => otherWorkflow.hashNodeInputs(n.node));

    const unmatchedThis: number[] = [];
    const unmatchedOther = new Set(otherHashes.map((_, i) => i));

    for (let i = 0; i < thisHashes.length; i++) {
      let matched = false;
      for (const j of unmatchedOther) {
        if (thisHashes[i] === otherHashes[j]) {
          unmatchedOther.delete(j);
          matched = true;
          break;
        }
      }
      if (!matched) {
        unmatchedThis.push(i);
      }
    }

    const diffs: StructuralDiff[] = [];

    // マッチしなかったノードがある場合、詳細比較
    if (unmatchedThis.length > 0 || unmatchedOther.size > 0) {
      // 最初のunmatchedペアで詳細比較
      if (unmatchedThis.length > 0 && unmatchedOther.size > 0) {
        const thisIdx = unmatchedThis[0];
        const otherIdx = [...unmatchedOther][0];
        diffs.push(
          ...this.compareNodeInputs(
            thisNodes[thisIdx].node,
            otherNodes[otherIdx].node,
            otherWorkflow
          )
        );
      }
    }

    return diffs;
  }

  /**
   * ノードの入力値をハッシュ化（マッチング用）
   */
  private hashNodeInputs(node: ComfyNode): string {
    const normalized: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(node.inputs)) {
      if (isNodeConnection(value)) {
        normalized[key] = this.normalizeConnection(value);
      } else {
        normalized[key] = JSON.stringify(value);
      }
    }
    // キーでソートして文字列化
    const sortedKeys = Object.keys(normalized).sort();
    return sortedKeys.map(k => `${k}:${normalized[k]}`).join('|');
  }

  // ============================================
  // プライベートメソッド
  // ============================================

  /**
   * 新しいノードIDを生成（既存の最大ID + 1）
   */
  private generateNodeId(): string {
    const ids = Object.keys(this.nodes).map(id => parseInt(id)).filter(id => !isNaN(id));
    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
    return String(maxId + 1);
  }
}
