import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ComfyWorkflow } from '../ComfyWorkflow';

// 実際のワークフローJSONファイルのパス
const WORKFLOW_DIR = resolve(__dirname, '../../../../../ComfyRunPodServerless+FramePack/app/workflows');

describe('ComfyWorkflow - 統合テスト', () => {
  describe('実際のワークフローファイル', () => {
    it('framepack_f1_start_only.jsonを読み込んでパース・再出力できる', () => {
      const filePath = resolve(WORKFLOW_DIR, 'framepack_f1_start_only.json');
      const originalJson = JSON.parse(readFileSync(filePath, 'utf-8'));

      const workflow = ComfyWorkflow.fromJson(originalJson);
      const exported = workflow.toJson();

      // 再出力が元のJSONと一致することを確認
      expect(exported).toEqual(originalJson);
    });

    it('framepack_f1_start_only_lora.jsonを読み込んでパース・再出力できる', () => {
      const filePath = resolve(WORKFLOW_DIR, 'framepack_f1_start_only_lora.json');
      const originalJson = JSON.parse(readFileSync(filePath, 'utf-8'));

      const workflow = ComfyWorkflow.fromJson(originalJson);
      const exported = workflow.toJson();

      // 再出力が元のJSONと一致することを確認
      expect(exported).toEqual(originalJson);
    });
  });

  describe('ワークフロー操作', () => {
    it('既存ワークフローにノードを追加できる', () => {
      const filePath = resolve(WORKFLOW_DIR, 'framepack_f1_start_only.json');
      const originalJson = JSON.parse(readFileSync(filePath, 'utf-8'));

      const workflow = ComfyWorkflow.fromJson(originalJson);
      const originalNodeCount = workflow.getNodeCount();

      const newNodeId = workflow.addNode('CustomNode', { value: 'test' });

      expect(workflow.getNodeCount()).toBe(originalNodeCount + 1);
      expect(workflow.getNode(newNodeId)?.class_type).toBe('CustomNode');
    });

    it('ノード間の接続を変更できる', () => {
      const filePath = resolve(WORKFLOW_DIR, 'framepack_f1_start_only.json');
      const originalJson = JSON.parse(readFileSync(filePath, 'utf-8'));

      const workflow = ComfyWorkflow.fromJson(originalJson);

      // 既存のエッジを確認
      const edgesBefore = workflow.getEdges();
      expect(edgesBefore.length).toBeGreaterThan(0);

      // 新しいノードを追加して接続
      const newNodeId = workflow.addNode('IntermediateNode', {});
      const vaeLoaders = workflow.findNodesByType('VAELoader');
      expect(vaeLoaders.length).toBeGreaterThan(0);

      workflow.addEdge(vaeLoaders[0].id, 0, newNodeId, 'vae_input');

      // 新しいエッジが追加されたことを確認
      const edgesAfter = workflow.getEdges();
      expect(edgesAfter.length).toBe(edgesBefore.length + 1);
    });

    it('ノードの入力値を変更できる', () => {
      const filePath = resolve(WORKFLOW_DIR, 'framepack_f1_start_only.json');
      const originalJson = JSON.parse(readFileSync(filePath, 'utf-8'));

      const workflow = ComfyWorkflow.fromJson(originalJson);

      // VAELoaderのvae_nameを変更
      const vaeLoaders = workflow.findNodesByType('VAELoader');
      expect(vaeLoaders.length).toBeGreaterThan(0);

      const originalValue = workflow.getInput(vaeLoaders[0].id, 'vae_name');
      workflow.setInput(vaeLoaders[0].id, 'vae_name', 'new_model.safetensors');

      expect(workflow.getInput(vaeLoaders[0].id, 'vae_name')).toBe('new_model.safetensors');
      expect(workflow.getInput(vaeLoaders[0].id, 'vae_name')).not.toBe(originalValue);
    });

    it('KSamplerのパラメータを一括更新できる', () => {
      const filePath = resolve(WORKFLOW_DIR, 'framepack_f1_start_only.json');
      const originalJson = JSON.parse(readFileSync(filePath, 'utf-8'));

      const workflow = ComfyWorkflow.fromJson(originalJson);

      // FramePackSampler_F1を探す（KSamplerの代わり）
      const samplers = workflow.findNodesByType('FramePackSampler_F1');
      expect(samplers.length).toBeGreaterThan(0);

      workflow.updateInputs(samplers[0].id, {
        steps: 25,
        cfg: 2,
        seed: 999999,
      });

      const node = workflow.getNode(samplers[0].id);
      expect(node?.inputs.steps).toBe(25);
      expect(node?.inputs.cfg).toBe(2);
      expect(node?.inputs.seed).toBe(999999);
    });
  });

  describe('エッジケース', () => {
    it('空のワークフローからビルドアップできる', () => {
      const workflow = new ComfyWorkflow();

      // ノード追加
      const loaderId = workflow.addNode('CLIPLoader', { clip_name: 'model.safetensors' });
      const encoderId = workflow.addNode('CLIPTextEncode', { text: 'a beautiful landscape' });
      const samplerId = workflow.addNode('KSampler', { steps: 20, cfg: 7.5 });

      // 接続
      workflow.addEdge(loaderId, 0, encoderId, 'clip');
      workflow.addEdge(encoderId, 0, samplerId, 'positive');

      // 検証
      expect(workflow.getNodeCount()).toBe(3);
      expect(workflow.getEdges().length).toBe(2);
      expect(workflow.hasConnection(loaderId, encoderId)).toBe(true);
      expect(workflow.hasConnection(encoderId, samplerId)).toBe(true);
    });

    it('複雑な接続グラフを構築できる', () => {
      const workflow = new ComfyWorkflow();

      // 複数の入力ノード
      const image1 = workflow.addNode('LoadImage', { image: 'img1.png' });
      const image2 = workflow.addNode('LoadImage', { image: 'img2.png' });

      // 共有ノード
      const blender = workflow.addNode('ImageBlend', { blend_factor: 0.5 });

      // 両方から接続
      workflow.addEdge(image1, 0, blender, 'image1');
      workflow.addEdge(image2, 0, blender, 'image2');

      // 検証
      const edgesToBlender = workflow.getEdgesTo(blender);
      expect(edgesToBlender.length).toBe(2);

      const edgesFromImage1 = workflow.getEdgesFrom(image1);
      expect(edgesFromImage1.length).toBe(1);
    });

    it('ノード削除でカスケード削除が正しく動作する', () => {
      const workflow = new ComfyWorkflow();

      const node1 = workflow.addNode('Node1', {});
      const node2 = workflow.addNode('Node2', {});
      const node3 = workflow.addNode('Node3', {});

      workflow.addEdge(node1, 0, node2, 'input');
      workflow.addEdge(node2, 0, node3, 'input');

      expect(workflow.getEdges().length).toBe(2);

      // node2を削除すると、node1->node2のエッジも削除される
      workflow.removeNode(node2);

      expect(workflow.getNodeCount()).toBe(2);
      expect(workflow.getEdges().length).toBe(0); // node2への接続もnode2からの接続も削除
    });
  });
});
