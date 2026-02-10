# comfyui-graph-utils

ComfyUIのワークフローJSONを操作するTypeScriptライブラリ。langgraph風のAPIデザインを採用。

## インストール

プロジェクト内のライブラリのため、追加インストール不要。

```typescript
import { ComfyWorkflow } from 'comfyui-graph-utils';
```

## 基本的な使い方

### 新規ワークフローの作成

```typescript
import { ComfyWorkflow } from 'comfyui-graph-utils';

const workflow = new ComfyWorkflow();

// ノードを追加（IDが自動生成される）
const vaeId = workflow.addNode('VAELoader', {
  vae_name: 'hunyuan_video_vae_bf16.safetensors'
});

const samplerId = workflow.addNode('KSampler', {
  steps: 20,
  cfg: 7.5,
  seed: 12345
});

// ノード間を接続
workflow.addEdge(vaeId, 0, samplerId, 'model');

// JSONとしてエクスポート
const json = workflow.toJson();
```

### 既存ワークフローの読み込み

```typescript
// オブジェクトから読み込み
const workflow = ComfyWorkflow.fromJson(existingWorkflowJson);

// JSON文字列から読み込み
const workflow2 = ComfyWorkflow.fromJson('{"1": {"inputs": {}, "class_type": "TestNode"}}');
```

## API リファレンス

### コンストラクタ・ファクトリ

#### `new ComfyWorkflow()`
空のワークフローを作成。

```typescript
const workflow = new ComfyWorkflow();
```

#### `ComfyWorkflow.fromJson(json)`
既存のJSONからワークフローを読み込む。

```typescript
const workflow = ComfyWorkflow.fromJson(existingJson);
```

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `json` | `ComfyWorkflowJson \| string` | ワークフローJSON（オブジェクトまたは文字列） |

### ノード操作

#### `addNode(classType, inputs?, options?)`
ノードを追加し、生成されたIDを返す。

```typescript
// 基本的な使い方
const nodeId = workflow.addNode('VAELoader', { vae_name: 'model.safetensors' });

// カスタムIDを指定
const nodeId2 = workflow.addNode('KSampler', { steps: 20 }, { id: 'my_sampler' });

// メタデータ付き
const nodeId3 = workflow.addNode('LoadImage', {}, {
  meta: { title: 'Start Image' }
});
```

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `classType` | `string` | ノードのクラスタイプ（例: `VAELoader`, `KSampler`） |
| `inputs` | `object` | 入力値（省略可） |
| `options.id` | `string` | カスタムノードID（省略時は自動生成） |
| `options.meta` | `{ title?: string }` | メタデータ（省略可） |

#### `removeNode(nodeId)`
ノードを削除。関連するエッジも自動的に削除される。

```typescript
workflow.removeNode('12');
```

#### `getNode(nodeId)`
ノードを取得。存在しない場合は`undefined`を返す。

```typescript
const node = workflow.getNode('12');
if (node) {
  console.log(node.class_type); // 'VAELoader'
  console.log(node.inputs);     // { vae_name: '...' }
}
```

#### `getNodes()`
全ノードを取得。

```typescript
const nodes = workflow.getNodes();
// { '12': { inputs: {...}, class_type: 'VAELoader' }, ... }
```

#### `getNodeCount()`
ノード数を取得。

```typescript
const count = workflow.getNodeCount(); // 15
```

#### `findNodesByType(classType)`
クラスタイプでノードを検索。

```typescript
const vaeLoaders = workflow.findNodesByType('VAELoader');
// [{ id: '12', node: { inputs: {...}, class_type: 'VAELoader' } }]

const samplers = workflow.findNodesByType('KSampler');
samplers.forEach(({ id, node }) => {
  console.log(`Node ${id}: steps=${node.inputs.steps}`);
});
```

### エッジ（接続）操作

#### `addEdge(sourceNodeId, sourcePort, targetNodeId, targetInputName)`
ノード間の接続を追加。

```typescript
// VAELoaderの出力ポート0をVAEEncodeのvae入力に接続
workflow.addEdge('12', 0, '20', 'vae');

// CLIPの出力ポート0をKSamplerのpositive入力に接続
workflow.addEdge('6', 0, '3', 'positive');
```

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `sourceNodeId` | `string` | ソースノードID |
| `sourcePort` | `number` | ソースの出力ポート番号（0から始まる） |
| `targetNodeId` | `string` | ターゲットノードID |
| `targetInputName` | `string` | ターゲットの入力名 |

#### `removeEdge(targetNodeId, inputName)`
エッジを削除。

```typescript
workflow.removeEdge('20', 'vae');
```

#### `getEdges()`
全エッジを取得。

```typescript
const edges = workflow.getEdges();
// [
//   { sourceNodeId: '12', sourcePort: 0, targetNodeId: '20', targetInputName: 'vae' },
//   { sourceNodeId: '18', sourcePort: 0, targetNodeId: '17', targetInputName: 'clip_vision' },
//   ...
// ]
```

#### `getEdgesFrom(sourceNodeId)`
特定ノードからの出力エッジを取得。

```typescript
const edges = workflow.getEdgesFrom('12');
```

#### `getEdgesTo(targetNodeId)`
特定ノードへの入力エッジを取得。

```typescript
const edges = workflow.getEdgesTo('20');
```

#### `hasConnection(sourceNodeId, targetNodeId)`
2つのノード間に接続があるか確認。

```typescript
if (workflow.hasConnection('12', '20')) {
  console.log('ノード12から20への接続あり');
}
```

### 入力値操作

#### `setInput(nodeId, name, value)`
入力値を設定。

```typescript
workflow.setInput('3', 'steps', 30);
workflow.setInput('3', 'cfg', 7.5);
workflow.setInput('3', 'seed', 999999);
```

#### `getInput(nodeId, name)`
入力値を取得。

```typescript
const steps = workflow.getInput('3', 'steps'); // 30
const connection = workflow.getInput('17', 'clip_vision'); // ['18', 0]
```

#### `getInputs(nodeId)`
ノードの全入力を取得。

```typescript
const inputs = workflow.getInputs('3');
// { steps: 30, cfg: 7.5, seed: 999999, model: ['12', 0], ... }
```

#### `updateInputs(nodeId, inputs)`
複数の入力を一度に更新。

```typescript
workflow.updateInputs('3', {
  steps: 25,
  cfg: 8.0,
  seed: 123456
});
```

#### `clearInput(nodeId, name)`
入力を削除。

```typescript
workflow.clearInput('3', 'seed');
```

### エクスポート

#### `toJson()`
ワークフローをJSONオブジェクトとしてエクスポート。

```typescript
const json = workflow.toJson();
```

#### `toJsonString(indent?)`
ワークフローをJSON文字列としてエクスポート。

```typescript
// 圧縮形式
const compact = workflow.toJsonString();

// 整形済み（インデント2）
const pretty = workflow.toJsonString(2);
```

## 型定義

### NodeConnection
ノード接続を表すタプル。

```typescript
type NodeConnection = [string, number]; // [ノードID, ポート番号]
```

### InputValue
入力値の型。

```typescript
type InputValue = string | number | boolean | NodeConnection | null;
```

### ComfyNode
ノードの型。

```typescript
interface ComfyNode {
  inputs: { [key: string]: InputValue };
  class_type: string;
  _meta?: { title?: string };
}
```

### Edge
エッジの型。

```typescript
interface Edge {
  sourceNodeId: string;
  sourcePort: number;
  targetNodeId: string;
  targetInputName: string;
}
```

## 型ガード関数

### `isNodeConnection(value)`
値がNodeConnectionかどうかを判定。

```typescript
import { isNodeConnection } from 'comfyui-graph-utils';

const value = node.inputs.model;
if (isNodeConnection(value)) {
  const [nodeId, port] = value;
  console.log(`接続: ノード${nodeId}のポート${port}`);
} else {
  console.log(`直接値: ${value}`);
}
```

### `isComfyNode(value)`
値がComfyNodeかどうかを判定。

### `isComfyWorkflowJson(value)`
値がComfyWorkflowJsonかどうかを判定。

## バリデーション

### `validateWorkflow(json)`
ワークフロー全体をバリデート。

```typescript
import { validateWorkflow } from 'comfyui-graph-utils';

const result = validateWorkflow(json);
if (!result.valid) {
  console.error('エラー:', result.errors);
}
if (result.warnings.length > 0) {
  console.warn('警告:', result.warnings);
}
```

### `validateWorkflowStructure(json)`
ワークフローの構造のみをバリデート。

### `validateConnections(json)`
ワークフローの接続をバリデート。
- 存在しないノードへの参照をエラーとして検出
- 孤立したノードを警告として検出

## 実用例

### ワークフローのパラメータを一括変更

```typescript
const workflow = ComfyWorkflow.fromJson(existingWorkflow);

// 全てのKSamplerのstepsを変更
const samplers = workflow.findNodesByType('KSampler');
samplers.forEach(({ id }) => {
  workflow.setInput(id, 'steps', 30);
});

// 全てのKSamplerのseedをランダムに変更
samplers.forEach(({ id }) => {
  workflow.setInput(id, 'seed', Math.floor(Math.random() * 1000000));
});

const updatedJson = workflow.toJson();
```

### 動的なワークフロー構築

```typescript
const workflow = new ComfyWorkflow();

// モデルローダー
const checkpointId = workflow.addNode('CheckpointLoaderSimple', {
  ckpt_name: 'v1-5-pruned.safetensors'
});

// CLIPテキストエンコード
const positiveId = workflow.addNode('CLIPTextEncode', {
  text: 'a beautiful landscape'
});
const negativeId = workflow.addNode('CLIPTextEncode', {
  text: 'ugly, blurry'
});

// 空のLatent
const latentId = workflow.addNode('EmptyLatentImage', {
  width: 512,
  height: 512,
  batch_size: 1
});

// KSampler
const samplerId = workflow.addNode('KSampler', {
  seed: 12345,
  steps: 20,
  cfg: 7.5,
  sampler_name: 'euler',
  scheduler: 'normal',
  denoise: 1.0
});

// VAEデコード
const decodeId = workflow.addNode('VAEDecode', {});

// 画像保存
const saveId = workflow.addNode('SaveImage', {
  filename_prefix: 'output'
});

// 接続
workflow.addEdge(checkpointId, 0, samplerId, 'model');
workflow.addEdge(checkpointId, 1, positiveId, 'clip');
workflow.addEdge(checkpointId, 1, negativeId, 'clip');
workflow.addEdge(checkpointId, 2, decodeId, 'vae');
workflow.addEdge(positiveId, 0, samplerId, 'positive');
workflow.addEdge(negativeId, 0, samplerId, 'negative');
workflow.addEdge(latentId, 0, samplerId, 'latent_image');
workflow.addEdge(samplerId, 0, decodeId, 'samples');
workflow.addEdge(decodeId, 0, saveId, 'images');

const json = workflow.toJson();
```

### 既存ワークフローのノード置換

```typescript
const workflow = ComfyWorkflow.fromJson(existingWorkflow);

// 古いVAELoaderを探す
const oldVae = workflow.findNodesByType('VAELoader')[0];
if (oldVae) {
  // 新しいVAELoaderを追加
  const newVaeId = workflow.addNode('VAELoader', {
    vae_name: 'new_vae_model.safetensors'
  });

  // 古いノードからのエッジを新しいノードに付け替え
  const edgesFromOld = workflow.getEdgesFrom(oldVae.id);
  edgesFromOld.forEach(edge => {
    workflow.removeEdge(edge.targetNodeId, edge.targetInputName);
    workflow.addEdge(newVaeId, edge.sourcePort, edge.targetNodeId, edge.targetInputName);
  });

  // 古いノードを削除
  workflow.removeNode(oldVae.id);
}
```

## テスト

```bash
# ウォッチモードで実行
npm run test

# 単発実行
npm run test:run
```
