import type { HubRecord, HubInputType, HubCatalog } from "../hubs/model";
import { inputLabels, inputTypes } from "../hubs/model";
import { isJsonObject, type JsonObject } from "./model";

export type HubImportSources = HubCatalog;
export type HubImportTarget = { type: HubInputType | "story"; id: string; name: string; uid: string | null; error: string | null };
export type HubImportPlan = { hubUid: string | null; hubError: string | null; inputs: HubImportTarget[]; stories: HubImportTarget[]; missingLinks: JsonObject[]; errors: string[] };

const ports = {
  lorebook: { label: "macro-prompts-data", relation: "매크로 프롬프트 항목.", storyPort: "lorebook", storyIndex: 3, storyLabel: "macro-prompts", storyRelation: "매크로 프롬프트 항목." },
  character: { label: "character-port", relation: "캐릭터의 정보.", storyPort: "characters", storyIndex: 1, storyLabel: "characters", storyRelation: "이야기의 등장 인물." },
  updateRule: { label: "update-rule-port", relation: "변수 업데이트 규칙.", storyPort: "updateRule", storyIndex: 4, storyLabel: "update-rule-port", storyRelation: "변수 업데이트 규칙." }
};
const normalized = (value: unknown) => String(value ?? "").normalize("NFC").trim();

function shape(canvas: JsonObject) {
  if (!Array.isArray(canvas.nodes) || !canvas.nodes.every(isJsonObject) || !Array.isArray(canvas.connections) || !canvas.connections.every(isJsonObject) || !isJsonObject(canvas.metadataSet)) throw new Error("캔버스 노드·연결·메타데이터 형식을 확인해 주세요.");
  return { nodes: canvas.nodes as JsonObject[], connections: canvas.connections as JsonObject[], metadata: canvas.metadataSet };
}

function findNode(canvas: JsonObject, type: string, name: string, preferredUid?: string) {
  const { nodes, metadata } = shape(canvas);
  const direct = preferredUid ? nodes.filter((entry) => entry.uid === preferredUid) : [];
  if (direct.length && (direct.length !== 1 || direct[0].type !== type)) throw new Error(`${name}: 노드 ID가 다른 노드와 충돌합니다.`);
  const matches = direct.length ? direct : nodes.filter((entry) => entry.type === type && isJsonObject(metadata[String(entry.uid)]) && normalized((metadata[String(entry.uid)] as JsonObject).title || (metadata[String(entry.uid)] as JsonObject).name) === normalized(name));
  if (matches.length > 1) throw new Error(`${name}: 같은 이름의 ${type === "hub" ? "허브" : "대상"} 노드가 여러 개입니다.`);
  const match = matches[0];
  if (!match) return null;
  const uid = String(match.uid ?? "");
  if (!uid || nodes.filter((entry) => entry.uid === uid).length !== 1 || !isJsonObject(metadata[uid]) || metadata[uid].type !== type) throw new Error(`${name}: 노드 ID 또는 메타데이터가 올바르지 않습니다.`);
  return uid;
}

function target(canvas: JsonObject, type: HubInputType | "story", id: string, choices: Array<{ id: string; name: string }>): HubImportTarget {
  const found = choices.filter((entry) => entry.id === id);
  if (found.length !== 1) return { type, id, name: id, uid: null, error: `${id}: 등록된 원본을 찾을 수 없거나 ID가 중복됩니다.` };
  const source = found[0];
  if (choices.filter((entry) => normalized(entry.name) === normalized(source.name)).length !== 1) return { type, id, name: source.name, uid: null, error: `${source.name}: 원본에 같은 이름이 여러 개라 대상을 구분할 수 없습니다.` };
  try {
    const uid = findNode(canvas, type, source.name);
    return { type, id, name: source.name, uid, error: uid ? null : `${source.name}: 캔버스에 ${type === "story" ? "스토리" : inputLabels[type]} 노드가 없습니다.` };
  } catch (error) { return { type, id, name: source.name, uid: null, error: (error as Error).message }; }
}

function sameLink(left: JsonObject, right: JsonObject) {
  return ["sourceNodeId", "sourceOutputPortName", "targetNodeId", "targetInputPortName", "connectionType"].every((key) => left[key] === right[key]);
}

export function planHubImport(canvas: JsonObject, hub: HubRecord, sources: HubImportSources): HubImportPlan {
  const { connections } = shape(canvas);
  let hubUid: string | null = null, hubError: string | null = null;
  try { hubUid = findNode(canvas, "hub", hub.name, hub.id); }
  catch (error) { hubError = (error as Error).message; }
  const inputs = inputTypes.flatMap((type) => hub.inputs[type].map((id) => target(canvas, type, id, sources[type])));
  const stories = hub.outputs.story.map((id) => target(canvas, "story", id, sources.story));
  const errors = [...(hubError ? [hubError] : []), ...inputs.concat(stories).flatMap((entry) => entry.error ? [entry.error] : [])];
  const desired: JsonObject[] = [];
  if (hubUid) {
    for (const entry of inputs) {
      if (!entry.uid || entry.type === "story") continue;
      desired.push({ sourceNodeId: entry.uid, sourceOutputPortName: entry.type, sourceOutputIndex: 0,
        sourceOutputLabel: ports[entry.type].label, sourceOutputRelation: ports[entry.type].relation,
        targetNodeId: hubUid, targetInputPortName: "hubInput", targetInputIndex: 0,
        targetInputLabel: "hub-input", targetInputRelation: "Hub grouping input.", connectionType: entry.type });
    }
    for (const story of stories) {
      if (!story.uid) continue;
      for (const type of inputTypes.filter((kind) => hub.inputs[kind].length)) {
        const port = ports[type];
        desired.push({ sourceNodeId: hubUid, sourceOutputPortName: `hubOutput_${type}`, sourceOutputIndex: 0,
          sourceOutputLabel: `hubOutput_${type}`, sourceOutputRelation: `All ${type} nodes in this hub.`,
          targetNodeId: story.uid, targetInputPortName: port.storyPort, targetInputIndex: port.storyIndex,
          targetInputLabel: port.storyLabel, targetInputRelation: port.storyRelation, connectionType: "hub" });
      }
    }
  }
  return { hubUid, hubError, inputs, stories, errors, missingLinks: desired.filter((link) => !connections.some((existing) => sameLink(existing, link))) };
}

export function addRegisteredHub(canvas: JsonObject, hub: HubRecord): JsonObject {
  if (findNode(canvas, "hub", hub.name, hub.id)) return canvas;
  const next = structuredClone(canvas);
  const { nodes, metadata } = shape(next);
  if (Object.hasOwn(metadata, hub.id)) throw new Error("허브 ID와 같은 메타데이터가 이미 있습니다.");
  const xs = nodes.flatMap((entry) => isJsonObject(entry.coordinates) && Number.isFinite(Number(entry.coordinates.x)) ? [Number(entry.coordinates.x)] : []);
  nodes.push({ uid: hub.id, hash: hub.id.replaceAll("-", "").slice(0, 5), coordinates: { x: Math.max(0, ...xs) + 400, y: 200 }, name: "hub-node", type: "hub" });
  metadata[hub.id] = { nodeUid: hub.id, title: hub.name, type: "hub", text: "", useTokenBlock: true };
  return next;
}

export function connectRegisteredHub(canvas: JsonObject, hub: HubRecord, sources: HubImportSources): { canvas: JsonObject; added: number } {
  const plan = planHubImport(canvas, hub, sources);
  if (!plan.hubUid) throw new Error(plan.hubError || "허브 노드를 먼저 추가해 주세요.");
  if (plan.errors.length) throw new Error(plan.errors.join("\n"));
  if (!plan.missingLinks.length) return { canvas, added: 0 };
  const next = structuredClone(canvas);
  const { connections } = shape(next);
  for (const link of plan.missingLinks) {
    let uid = crypto.randomUUID();
    while (connections.some((entry) => entry.uid === uid)) uid = crypto.randomUUID();
    connections.push({ uid, ...link });
  }
  return { canvas: next, added: plan.missingLinks.length };
}
