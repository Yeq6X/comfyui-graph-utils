[English](README.md) | [日本語](README.ja.md)

# comfyui-graph-utils

A TypeScript library specialized for editing and validating ComfyUI workflow JSON.

Unlike direct JSON editing, this library ensures node reference integrity and prevents invalid connections.
Ideal for cases where you want to safely modify JSON, such as workflow manipulation by AI agents.

## Installation

```bash
git clone https://github.com/Yeq6X/comfyui-graph-utils.git
```

```typescript
import { ComfyWorkflow } from './comfyui-graph-utils';
```

## Running Examples

Sample scripts are available in the `examples/` directory. You can run them directly with `npx tsx`.

```bash
# Generate an SDXL workflow and output to a JSON file
npx tsx examples/sdxl-workflow.ts > sdxl-workflow.json

# Output to console (with workflow info)
npx tsx examples/sdxl-workflow.ts
```
<img width="1389" height="720" alt="image" src="https://github.com/user-attachments/assets/e7746925-8d8d-4368-b46c-d31be787a65b" />

## Basic Usage

### Creating a New Workflow

```typescript
import { ComfyWorkflow } from 'comfyui-graph-utils';

const workflow = new ComfyWorkflow();

// Add nodes (IDs are auto-generated)
const vaeId = workflow.addNode('VAELoader', {
  vae_name: 'hunyuan_video_vae_bf16.safetensors'
});

const samplerId = workflow.addNode('KSampler', {
  steps: 20,
  cfg: 7.5,
  seed: 12345
});

// Connect nodes
workflow.addEdge(vaeId, 0, samplerId, 'model');

// Export as JSON
const json = workflow.toJson();
```

### Loading an Existing Workflow

```typescript
// Load from object
const workflow = ComfyWorkflow.fromJson(existingWorkflowJson);

// Load from JSON string
const workflow2 = ComfyWorkflow.fromJson('{"1": {"inputs": {}, "class_type": "TestNode"}}');
```

## API Reference

### Constructor / Factory

#### `new ComfyWorkflow()`
Creates an empty workflow.

```typescript
const workflow = new ComfyWorkflow();
```

#### `ComfyWorkflow.fromJson(json)`
Loads a workflow from existing JSON.

```typescript
const workflow = ComfyWorkflow.fromJson(existingJson);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `json` | `ComfyWorkflowJson \| string` | Workflow JSON (object or string) |

### Node Operations

#### `addNode(classType, inputs?, options?)`
Adds a node and returns the generated ID.

```typescript
// Basic usage
const nodeId = workflow.addNode('VAELoader', { vae_name: 'model.safetensors' });

// With custom ID
const nodeId2 = workflow.addNode('KSampler', { steps: 20 }, { id: 'my_sampler' });

// With metadata
const nodeId3 = workflow.addNode('LoadImage', {}, {
  meta: { title: 'Start Image' }
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `classType` | `string` | Node class type (e.g., `VAELoader`, `KSampler`) |
| `inputs` | `object` | Input values (optional) |
| `options.id` | `string` | Custom node ID (auto-generated if omitted) |
| `options.meta` | `{ title?: string }` | Metadata (optional) |

#### `removeNode(nodeId)`
Removes a node. Related edges are automatically removed.

```typescript
workflow.removeNode('12');
```

#### `getNode(nodeId)`
Gets a node. Returns `undefined` if not found.

```typescript
const node = workflow.getNode('12');
if (node) {
  console.log(node.class_type); // 'VAELoader'
  console.log(node.inputs);     // { vae_name: '...' }
}
```

#### `getNodes()`
Gets all nodes.

```typescript
const nodes = workflow.getNodes();
// { '12': { inputs: {...}, class_type: 'VAELoader' }, ... }
```

#### `getNodeCount()`
Gets the number of nodes.

```typescript
const count = workflow.getNodeCount(); // 15
```

#### `findNodesByType(classType)`
Searches nodes by class type.

```typescript
const vaeLoaders = workflow.findNodesByType('VAELoader');
// [{ id: '12', node: { inputs: {...}, class_type: 'VAELoader' } }]

const samplers = workflow.findNodesByType('KSampler');
samplers.forEach(({ id, node }) => {
  console.log(`Node ${id}: steps=${node.inputs.steps}`);
});
```

### Edge (Connection) Operations

#### `addEdge(sourceNodeId, sourcePort, targetNodeId, targetInputName)`
Adds a connection between nodes.

```typescript
// Connect VAELoader output port 0 to VAEEncode's vae input
workflow.addEdge('12', 0, '20', 'vae');

// Connect CLIP output port 0 to KSampler's positive input
workflow.addEdge('6', 0, '3', 'positive');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sourceNodeId` | `string` | Source node ID |
| `sourcePort` | `number` | Source output port number (0-based) |
| `targetNodeId` | `string` | Target node ID |
| `targetInputName` | `string` | Target input name |

#### `removeEdge(targetNodeId, inputName)`
Removes an edge.

```typescript
workflow.removeEdge('20', 'vae');
```

#### `getEdges()`
Gets all edges.

```typescript
const edges = workflow.getEdges();
// [
//   { sourceNodeId: '12', sourcePort: 0, targetNodeId: '20', targetInputName: 'vae' },
//   { sourceNodeId: '18', sourcePort: 0, targetNodeId: '17', targetInputName: 'clip_vision' },
//   ...
// ]
```

#### `getEdgesFrom(sourceNodeId)`
Gets output edges from a specific node.

```typescript
const edges = workflow.getEdgesFrom('12');
```

#### `getEdgesTo(targetNodeId)`
Gets input edges to a specific node.

```typescript
const edges = workflow.getEdgesTo('20');
```

#### `hasConnection(sourceNodeId, targetNodeId)`
Checks if a connection exists between two nodes.

```typescript
if (workflow.hasConnection('12', '20')) {
  console.log('Connection exists from node 12 to 20');
}
```

### Input Operations

#### `setInput(nodeId, name, value)`
Sets an input value.

```typescript
workflow.setInput('3', 'steps', 30);
workflow.setInput('3', 'cfg', 7.5);
workflow.setInput('3', 'seed', 999999);
```

#### `getInput(nodeId, name)`
Gets an input value.

```typescript
const steps = workflow.getInput('3', 'steps'); // 30
const connection = workflow.getInput('17', 'clip_vision'); // ['18', 0]
```

#### `getInputs(nodeId)`
Gets all inputs for a node.

```typescript
const inputs = workflow.getInputs('3');
// { steps: 30, cfg: 7.5, seed: 999999, model: ['12', 0], ... }
```

#### `updateInputs(nodeId, inputs)`
Updates multiple inputs at once.

```typescript
workflow.updateInputs('3', {
  steps: 25,
  cfg: 8.0,
  seed: 123456
});
```

#### `clearInput(nodeId, name)`
Removes an input.

```typescript
workflow.clearInput('3', 'seed');
```

### Export

#### `toJson()`
Exports the workflow as a JSON object.

```typescript
const json = workflow.toJson();
```

#### `toJsonString(indent?)`
Exports the workflow as a JSON string.

```typescript
// Compact format
const compact = workflow.toJsonString();

// Pretty-printed (indent 2)
const pretty = workflow.toJsonString(2);
```

## Type Definitions

### NodeConnection
A tuple representing a node connection.

```typescript
type NodeConnection = [string, number]; // [nodeId, portNumber]
```

### InputValue
Input value type.

```typescript
type InputValue = string | number | boolean | NodeConnection | null;
```

### ComfyNode
Node type.

```typescript
interface ComfyNode {
  inputs: { [key: string]: InputValue };
  class_type: string;
  _meta?: { title?: string };
}
```

### Edge
Edge type.

```typescript
interface Edge {
  sourceNodeId: string;
  sourcePort: number;
  targetNodeId: string;
  targetInputName: string;
}
```

## Type Guard Functions

### `isNodeConnection(value)`
Checks if a value is a NodeConnection.

```typescript
import { isNodeConnection } from 'comfyui-graph-utils';

const value = node.inputs.model;
if (isNodeConnection(value)) {
  const [nodeId, port] = value;
  console.log(`Connection: node ${nodeId}, port ${port}`);
} else {
  console.log(`Direct value: ${value}`);
}
```

### `isComfyNode(value)`
Checks if a value is a ComfyNode.

### `isComfyWorkflowJson(value)`
Checks if a value is a ComfyWorkflowJson.

## Validation

### `validateWorkflow(json)`
Validates the entire workflow.

```typescript
import { validateWorkflow } from 'comfyui-graph-utils';

const result = validateWorkflow(json);
if (!result.valid) {
  console.error('Errors:', result.errors);
}
if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

### `validateWorkflowStructure(json)`
Validates only the workflow structure.

### `validateConnections(json)`
Validates workflow connections.
- Detects references to non-existent nodes as errors
- Detects isolated nodes as warnings

## Examples

### Batch Parameter Changes

```typescript
const workflow = ComfyWorkflow.fromJson(existingWorkflow);

// Change steps for all KSamplers
const samplers = workflow.findNodesByType('KSampler');
samplers.forEach(({ id }) => {
  workflow.setInput(id, 'steps', 30);
});

// Randomize seeds for all KSamplers
samplers.forEach(({ id }) => {
  workflow.setInput(id, 'seed', Math.floor(Math.random() * 1000000));
});

const updatedJson = workflow.toJson();
```

### Dynamic Workflow Construction

```typescript
const workflow = new ComfyWorkflow();

// Model loader
const checkpointId = workflow.addNode('CheckpointLoaderSimple', {
  ckpt_name: 'v1-5-pruned.safetensors'
});

// CLIP text encoding
const positiveId = workflow.addNode('CLIPTextEncode', {
  text: 'a beautiful landscape'
});
const negativeId = workflow.addNode('CLIPTextEncode', {
  text: 'ugly, blurry'
});

// Empty latent
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

// VAE decode
const decodeId = workflow.addNode('VAEDecode', {});

// Save image
const saveId = workflow.addNode('SaveImage', {
  filename_prefix: 'output'
});

// Connections
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

### Node Replacement

```typescript
const workflow = ComfyWorkflow.fromJson(existingWorkflow);

// Find old VAELoader
const oldVae = workflow.findNodesByType('VAELoader')[0];
if (oldVae) {
  // Add new VAELoader
  const newVaeId = workflow.addNode('VAELoader', {
    vae_name: 'new_vae_model.safetensors'
  });

  // Rewire edges from old node to new node
  const edgesFromOld = workflow.getEdgesFrom(oldVae.id);
  edgesFromOld.forEach(edge => {
    workflow.removeEdge(edge.targetNodeId, edge.targetInputName);
    workflow.addEdge(newVaeId, edge.sourcePort, edge.targetNodeId, edge.targetInputName);
  });

  // Remove old node
  workflow.removeNode(oldVae.id);
}
```

## Testing

```bash
# Watch mode
npm run test

# Single run
npm run test:run
```
