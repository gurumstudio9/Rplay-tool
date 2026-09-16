import { lorebookTypeOptions, type LorebookEntry } from "../lorebook/model";
import { groupLabels, type CharacterRecord } from "../settings/model";
import type { PromptState, RplayAchievement, RplayUpdateRule, RplayVariable } from "../prompts/model";
import { inputLabels, inputTypes, type HubRecord } from "../hubs/model";
import {
  addCanvasAchievementWithTrigger, addCanvasCharacter, addCanvasLorebook, addCanvasUpdateRule, addCanvasVariable,
  addCanvasStatusView, addCanvasStory, statusViewNameKey,
  compareCanvasAchievements, compareCanvasCharacters, compareCanvasLorebooks, compareCanvasUpdateRules, compareCanvasVariables,
  compareCanvasStatusViews, compareCanvasStories, deleteCanvasNode, syncCanvasVariableRuleConnections, type CanvasContentStatus, type StatusViewAssetSource
} from "./canvasContent";
import { addRegisteredHub, planHubImport } from "./canvasHubImport";
import { isJsonObject, type JsonObject } from "./model";

export type CanvasBatchTab = "lorebook" | "character" | "variable" | "updateRule" | "statusView" | "story" | "achievement";
export type CanvasBatchItem = {
  id: string; title: string; kind: string; status: "missing" | "legacy" | "blocked"; reason?: string;
  add?: (canvas: JsonObject) => JsonObject; nodeUid?: string; triggerUid?: string;
};
export type CanvasBatchSources = {
  lorebooks: LorebookEntry[]; characters: CharacterRecord[]; variables: RplayVariable[]; rules: RplayUpdateRule[];
  achievements: RplayAchievement[]; assets: StatusViewAssetSource[]; prompts: PromptState | null;
};
const nameKey = (value: unknown) => String(value ?? "").normalize("NFC").trim().toLocaleLowerCase("ko-KR");

export function canvasBatchItems(canvas: JsonObject, tab: CanvasBatchTab, sources: CanvasBatchSources): CanvasBatchItem[] {
  const items: CanvasBatchItem[] = [];
  function push(id: string, title: string, kind: string, status: CanvasContentStatus, nodeUid?: string | null, add?: CanvasBatchItem["add"], triggerUid?: string | null) {
    if (status !== "source-only" && status !== "canvas-only" && status !== "duplicate") return;
    items.push({ id: `${tab}:${id}`, title, kind, status: status === "source-only" ? "missing" : status === "canvas-only" ? "legacy" : "blocked", nodeUid: nodeUid || undefined, add, triggerUid: triggerUid || undefined });
  }
  if (tab === "lorebook") for (const row of compareCanvasLorebooks(canvas, sources.lorebooks)) {
    push(row.id, row.title, lorebookTypeOptions.find(([id]) => id === row.source?.type)?.[1] || row.source?.type || "분류 없음", row.status, row.nodeUid, row.source ? (next) => addCanvasLorebook(next, row.source!) : undefined);
  }
  if (tab === "character") for (const row of compareCanvasCharacters(canvas, sources.characters)) {
    push(row.id, row.name, row.group ? groupLabels[row.group] : "분류 없음", row.status, row.nodeUid, row.source ? (next) => addCanvasCharacter(next, row.source!) : undefined);
  }
  if (tab === "variable") for (const row of compareCanvasVariables(canvas, sources.variables)) {
    push(row.id, row.name, row.source?.variableType || row.canvasType || "분류 없음", row.status, row.nodeUid, row.source ? (next) => syncCanvasVariableRuleConnections(addCanvasVariable(next, row.source!), sources.variables, sources.rules) : undefined);
  }
  if (tab === "updateRule") for (const row of compareCanvasUpdateRules(canvas, sources.rules)) {
    push(row.id, row.title, "업데이트 규칙", row.status, row.nodeUid, row.source ? (next) => syncCanvasVariableRuleConnections(addCanvasUpdateRule(next, row.source!), sources.variables, sources.rules) : undefined);
  }
  if (tab === "achievement") for (const row of compareCanvasAchievements(canvas, sources.achievements, sources.variables)) {
    push(row.id, row.name, row.source ? row.source.isHidden ? "숨김 업적" : "일반 업적" : "분류 없음", row.status, row.achievementNodeUid, row.source ? (next) => addCanvasAchievementWithTrigger(next, row.source!) : undefined, row.triggerNodeUid);
  }
  if (tab === "statusView") {
    const rows = compareCanvasStatusViews(canvas, sources.assets);
    for (const row of rows) push(row.id, row.title, "HTML 상태창", row.status, row.nodeUid);
    const metadata = isJsonObject(canvas.metadataSet) ? canvas.metadataSet : {};
    for (const asset of sources.assets) {
      const key = statusViewNameKey(asset.name);
      const exists = Object.values(metadata).some((entry) => isJsonObject(entry) && entry.type === "statusView" && statusViewNameKey(entry.title || entry.statusTitle) === key);
      if (exists) continue;
      const duplicate = sources.assets.filter((entry) => statusViewNameKey(entry.name) === key).length > 1;
      push(asset.name, asset.name, "HTML 상태창", duplicate ? "duplicate" : "source-only", null, (next) => addCanvasStatusView(next, asset));
    }
  }
  if (tab === "story" && sources.prompts) {
    const prompts = sources.prompts;
    const rows = compareCanvasStories(canvas, prompts);
    for (const row of rows.filter((entry) => !entry.source)) {
      const ambiguous = prompts.versions.some((version) => nameKey(version.id) !== "메인" && nameKey(version.id) && nameKey(row.title).includes(nameKey(version.id)));
      push(row.id, row.title, row.isStart ? "시작 노드" : "일반 노드", ambiguous ? "duplicate" : "canvas-only", row.nodeUid);
    }
    for (const version of prompts.versions) {
      if (rows.some((row) => row.source?.id === version.id)) continue;
      const duplicate = prompts.versions.filter((entry) => nameKey(entry.name) === nameKey(version.name) || entry.id === version.id).length > 1;
      push(version.id, version.name, version.nodeType === "start" ? "시작 노드" : "일반 노드", duplicate ? "duplicate" : "source-only", null, (next) => addCanvasStory(next, prompts, version));
    }
  }
  return items;
}

export function hubBatchItems(canvas: JsonObject, hubs: HubRecord[]): CanvasBatchItem[] {
  const empty = { lorebook: [], character: [], updateRule: [], story: [] };
  const items: CanvasBatchItem[] = [];
  for (const hub of hubs) {
    const plan = planHubImport(canvas, hub, empty);
    if (plan.hubUid) continue;
    const duplicate = hubs.filter((entry) => nameKey(entry.name) === nameKey(hub.name)).length > 1;
    items.push({ id: `source:${hub.id}`, title: hub.name, kind: inputTypes.filter((type) => hub.inputs[type].length).map((type) => inputLabels[type]).join(" + ") || "대상 없음", status: plan.hubError || duplicate ? "blocked" : "missing", reason: plan.hubError || undefined, add: (next) => addRegisteredHub(next, hub) });
  }
  const metadata = isJsonObject(canvas.metadataSet) ? canvas.metadataSet : {};
  for (const node of Array.isArray(canvas.nodes) ? canvas.nodes.filter(isJsonObject).filter((entry) => entry.type === "hub") : []) {
    const uid = String(node.uid);
    const data = isJsonObject(metadata[uid]) ? metadata[uid] : {};
    const title = String(data.title || "(제목 없음)");
    if (hubs.some((hub) => hub.id === uid || nameKey(hub.name) === nameKey(title))) continue;
    items.push({ id: `canvas:${uid}`, title, kind: "분류 없음", status: "legacy", nodeUid: uid });
  }
  return items;
}

export function applyCanvasBatch(canvas: JsonObject, items: CanvasBatchItem[], action: "add" | "delete"): JsonObject {
  const expected = action === "add" ? "missing" : "legacy";
  if (items.some((item) => item.status !== expected || (action === "add" ? !item.add : !item.nodeUid))) throw new Error("작업 가능한 항목만 선택해 주세요.");
  let next = canvas;
  for (const item of items) next = action === "add" ? item.add!(next) : deleteCanvasNode(next, item.nodeUid!);
  if (action === "delete") {
    for (const uid of new Set(items.flatMap((item) => item.triggerUid ? [item.triggerUid] : []))) {
      // Shared triggers must stay while another node still uses their output.
      const inUse = Array.isArray(next.connections) && next.connections.some((entry) => isJsonObject(entry) && entry.sourceNodeId === uid);
      if (!inUse) next = deleteCanvasNode(next, uid);
    }
  }
  return next;
}
