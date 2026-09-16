import type { LorebookEntry } from "../lorebook/model";
import type {
  PromptState,
  PromptVersion,
  RplayAchievement,
  RplayUpdateRule,
  RplayVariable
} from "../prompts/model";
import type { CharacterGroup, CharacterRecord } from "../settings/model";
import type { JsonObject } from "./model";

export type CanvasContentStatus =
  | "exact"
  | "changed"
  | "source-only"
  | "canvas-only"
  | "duplicate";

export type CanvasLorebookRow = {
  id: string;
  title: string;
  status: CanvasContentStatus;
  source: LorebookEntry | null;
  nodeUid: string | null;
  canvasTextLength: number;
  sourceTextLength: number;
  bodyMatches: boolean;
  keyMatches: boolean;
  patternsMatch: boolean;
  priorityMatches: boolean;
  canvasBody: string;
  canvasKey: string;
  canvasPatterns: string[];
  canvasPriority: number | undefined;
  sourcePriority: number;
};

export type CanvasCharacterRow = {
  id: string;
  name: string;
  group?: CharacterGroup;
  status: CanvasContentStatus;
  promptMatches: boolean;
  backgroundMatches: boolean;
  canvasPrompt: string;
  canvasBackground: string;
  source: CharacterRecord | null;
  nodeUid: string | null;
  imageNodeCount: number;
  missingImageNodeCount: number;
};

export type CanvasStoryRow = {
  id: string;
  title: string;
  titleMatches: boolean;
  isStart: boolean;
  nodeUid: string;
  source: PromptVersion | null;
  status: "included" | "exact" | "different" | "empty-source" | "unmatched";
  canvasText: string;
  sourceText: string;
  canvasBackgroundText: string;
  sourceBackgroundText: string;
  canvasPrologueText: string;
  sourcePrologueText: string;
  canvasPrologueGuideText: string;
  sourcePrologueGuideText: string;
  coreContextDiff: CanvasTextDiff;
  backgroundDiff: CanvasTextDiff;
  prologueDiff: CanvasTextDiff;
  prologueGuideDiff: CanvasTextDiff;
};

export type CanvasTextDiffPart = {
  type: "same" | "add" | "remove";
  text: string;
};

export type CanvasTextDiff = {
  parts: CanvasTextDiffPart[];
  addedChars: number;
  removedChars: number;
  unchangedChars: number;
  changeRatio: number;
};

export type CanvasUpdateRuleRow = {
  id: string;
  title: string;
  status: CanvasContentStatus;
  source: RplayUpdateRule | null;
  nodeUid: string | null;
  canvasTextLength: number;
  sourceTextLength: number;
  canvasText: string;
};

export type CanvasVariableRow = {
  id: string;
  name: string;
  status: CanvasContentStatus;
  typeMatches: boolean;
  initialValueMatches: boolean;
  titleMatches: boolean;
  canvasTitle: string;
  canvasType: string;
  canvasInitialValue: unknown;
  source: RplayVariable | null;
  nodeUid: string | null;
};

export type StatusViewAssetSource = {
  name: string;
  content: string;
};

export type CanvasStatusViewRow = {
  id: string;
  title: string;
  assetName: string;
  status: CanvasContentStatus;
  source: StatusViewAssetSource | null;
  nodeUid: string;
  canvasHtmlLength: number;
  sourceHtmlLength: number;
  canvasHtml: string;
};

type CanvasNodeEntry = {
  uid: string;
  node: JsonObject;
  metadata: JsonObject;
};

type CanvasNodeCreationOptions = {
  hubUid?: string;
  nodeUid?: string;
  connectionUid?: string;
  imageNodeUids?: string[];
  imageConnectionUids?: string[];
  createdAt?: string;
};

const characterImageLabels = ["감정", "성", "특수"] as const;
const expectedCharacterImageCount = characterImageLabels.length;

const contentLayout = {
  storyX: 0,
  lorebookX: 700,
  variableX: 3000,
  updateRuleX: 3550,
  statusViewX: 4200,
  imageX: 5000,
  characterX: 6200
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return String(value ?? "");
}

function normalizedText(value: unknown) {
  return text(value)
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function normalizedTitle(value: unknown) {
  return normalizedText(value)
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ko-KR");
}

export function statusViewNameKey(value: unknown) {
  const basename = normalizedText(value).replace(/\.html$/i, "");
  const withoutLabel = basename.replace(/상태\s*창/gu, "");
  const compact = withoutLabel
    .replace(/[\s()[\]{}_-]+/g, "")
    .toLocaleLowerCase("ko-KR");
  return compact || "__status_view__";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => normalizedText(item)).filter(Boolean)
    : [];
}

function objectArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isJsonObject) : [];
}

function metadataSet(canvas: JsonObject) {
  return isJsonObject(canvas.metadataSet) ? canvas.metadataSet : {};
}

function canvasNodeEntries(canvas: JsonObject, type: string): CanvasNodeEntry[] {
  const metadata = metadataSet(canvas);
  return objectArray(canvas.nodes)
    .filter((node) => node.type === type && typeof node.uid === "string")
    .map((node) => {
      const uid = String(node.uid);
      const nodeMetadata = metadata[uid];
      return isJsonObject(nodeMetadata)
        ? { uid, node, metadata: nodeMetadata }
        : null;
    })
    .filter((entry): entry is CanvasNodeEntry => Boolean(entry));
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const key = keyFor(item);
    const values = grouped.get(key) ?? [];
    values.push(item);
    grouped.set(key, values);
  });
  return grouped;
}

function lorebookPriority(type: string) {
  const priorities: Record<string, number> = {
    command: 100,
    person: 90,
    "person-sub": 80,
    "person-gimmick": 70,
    region: 85,
    "region-sub": 55,
    setting: 50,
    gimmick: 45,
    general: 40
  };
  return priorities[type] ?? 10;
}

function estimateTokenCount(value: string) {
  return value ? Math.ceil(value.length / 1.5) : 0;
}

function generatedUid() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return randomUuid;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    return (value === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function shortHash(uid: string) {
  return uid.replace(/-/g, "").slice(0, 5);
}

function numericCoordinate(node: JsonObject, axis: "x" | "y") {
  const coordinates = isJsonObject(node.coordinates) ? node.coordinates : {};
  const value = Number(coordinates[axis]);
  return Number.isFinite(value) ? value : 0;
}

function sortedByCoordinates(nodes: JsonObject[]) {
  return [...nodes].sort((left, right) =>
    numericCoordinate(left, "y") - numericCoordinate(right, "y")
    || numericCoordinate(left, "x") - numericCoordinate(right, "x")
  );
}

function connectedCharacterImageNodes(canvas: JsonObject, characterUid: string) {
  const imageUids = new Set(
    objectArray(canvas.connections)
      .filter((connection) =>
        connection.connectionType === "image"
        && connection.targetNodeId === characterUid
      )
      .map((connection) => text(connection.sourceNodeId))
      .filter(Boolean)
  );
  return objectArray(canvas.nodes).filter(
    (node) => node.type === "image" && imageUids.has(text(node.uid))
  );
}

function contentLayoutOrigin(canvas: JsonObject) {
  const managedTypes = new Set([
    "story",
    "lorebook",
    "variable",
    "updateRule",
    "statusView",
    "character"
  ]);
  const managedNodes = objectArray(canvas.nodes).filter(
    (node) => managedTypes.has(text(node.type))
  );
  if (!managedNodes.length) return { x: 0, y: 200 };
  return {
    x: Math.min(...managedNodes.map((node) => numericCoordinate(node, "x"))),
    y: Math.min(...managedNodes.map((node) => numericCoordinate(node, "y")))
  };
}

function nextNodeCoordinates(
  canvas: JsonObject,
  type: "lorebook" | "character" | "variable" | "updateRule" | "story" | "statusView"
) {
  const nodes = objectArray(canvas.nodes).filter((node) => node.type === type);
  const origin = contentLayoutOrigin(canvas);
  const layouts = {
    character: { x: origin.x + contentLayout.characterX, y: origin.y, columnGap: 0, rowGap: 460, columns: 1 },
    lorebook: { x: origin.x + contentLayout.lorebookX, y: origin.y, columnGap: 400, rowGap: 300, columns: 5 },
    variable: { x: origin.x + contentLayout.variableX, y: origin.y, columnGap: 0, rowGap: 220, columns: 1 },
    updateRule: { x: origin.x + contentLayout.updateRuleX, y: origin.y, columnGap: 0, rowGap: 320, columns: 1 },
    story: { x: origin.x + contentLayout.storyX, y: origin.y, columnGap: 0, rowGap: 500, columns: 1 },
    statusView: { x: origin.x + contentLayout.statusViewX, y: origin.y, columnGap: 0, rowGap: 500, columns: 1 }
  } satisfies Record<typeof type, {
    x: number;
    y: number;
    columnGap: number;
    rowGap: number;
    columns: number;
  }>;
  const layout = layouts[type];
  if (!nodes.length && (type === "variable" || type === "updateRule")) {
    const siblingType = type === "variable" ? "updateRule" : "variable";
    const siblingNodes = objectArray(canvas.nodes).filter((node) => node.type === siblingType);
    if (siblingNodes.length) {
      const siblingX = type === "variable"
        ? Math.min(...siblingNodes.map((node) => numericCoordinate(node, "x")))
        : Math.max(...siblingNodes.map((node) => numericCoordinate(node, "x")));
      return { x: siblingX + (type === "variable" ? -550 : 550), y: layout.y };
    }
    return { x: layout.x, y: layout.y };
  }
  if (!nodes.length) return { x: layout.x, y: layout.y };

  const bottomY = Math.max(...nodes.map((node) => numericCoordinate(node, "y")));
  const bottomNodes = nodes
    .filter((node) => Math.abs(numericCoordinate(node, "y") - bottomY) < 1)
    .sort((left, right) => numericCoordinate(left, "x") - numericCoordinate(right, "x"));
  const rowStartX = numericCoordinate(bottomNodes[0], "x");
  const nextX = numericCoordinate(bottomNodes.at(-1) ?? bottomNodes[0], "x") + layout.columnGap;
  if (bottomNodes.length < layout.columns
    && nextX <= rowStartX + layout.columnGap * (layout.columns - 1)) {
    return { x: nextX, y: bottomY };
  }
  return { x: rowStartX, y: bottomY + layout.rowGap };
}

function selectedHubUid(canvas: JsonObject, uid?: string) {
  if (!uid) return "";
  const matches = canvasNodeEntries(canvas, "hub").filter((entry) => entry.uid === uid);
  if (matches.length !== 1 || matches[0].metadata.type !== "hub") {
    throw new Error("선택한 허브가 올바르지 않습니다. 허브 관리에서 다시 선택해 주세요.");
  }
  return uid;
}

function lorebookMatches(source: LorebookEntry, metadata: JsonObject) {
  const entries = objectArray(metadata.entries);
  const entry = entries[0] ?? {};
  const sourceTriggers = source.triggers.map(normalizedText).filter(Boolean);
  const canvasPatterns = stringArray(entry.patterns);
  const rawPriority = Number(entry.priority);
  const sourcePriority = lorebookPriority(source.type);
  const details = {
    bodyMatches: normalizedText(entry.text) === normalizedText(source.body),
    keyMatches: normalizedText(entry.key) === sourceTriggers.join("|"),
    patternsMatch: JSON.stringify(canvasPatterns) === JSON.stringify(sourceTriggers),
    priorityMatches: rawPriority === sourcePriority,
    canvasBody: normalizedText(entry.text),
    canvasKey: normalizedText(entry.key),
    canvasPatterns,
    canvasPriority: Number.isFinite(rawPriority) ? rawPriority : undefined,
    sourcePriority
  };
  return {
    ...details,
    exact: details.bodyMatches
      && details.keyMatches
      && details.patternsMatch
      && details.priorityMatches
  };
}

export function assertEditableCanvas(canvas: JsonObject) {
  if (!Array.isArray(canvas.nodes)) {
    throw new Error("캔버스 JSON에 nodes 배열이 없습니다.");
  }
  if (!Array.isArray(canvas.connections)) {
    throw new Error("캔버스 JSON에 connections 배열이 없습니다.");
  }
  if (!isJsonObject(canvas.metadataSet)) {
    throw new Error("캔버스 JSON에 metadataSet 객체가 없습니다.");
  }
}

export function arrangeCanvasContentNodes(canvas: JsonObject) {
  const next = structuredClone(canvas);
  const nodes = objectArray(next.nodes);
  const origin = contentLayoutOrigin(next);
  const place = (node: JsonObject, x: number, y: number) => {
    node.coordinates = { x, y };
  };
  const nodesOfType = (type: string) => sortedByCoordinates(
    nodes.filter((node) => node.type === type)
  );

  nodesOfType("story").forEach((node, index) => {
    place(node, origin.x + contentLayout.storyX, origin.y + index * 520);
  });
  nodesOfType("lorebook").forEach((node, index) => {
    place(
      node,
      origin.x + contentLayout.lorebookX + (index % 5) * 400,
      origin.y + Math.floor(index / 5) * 300
    );
  });
  nodesOfType("variable").forEach((node, index) => {
    place(node, origin.x + contentLayout.variableX, origin.y + index * 220);
  });
  nodesOfType("updateRule").forEach((node, index) => {
    place(node, origin.x + contentLayout.updateRuleX, origin.y + index * 320);
  });
  nodesOfType("statusView").forEach((node, index) => {
    place(node, origin.x + contentLayout.statusViewX, origin.y + index * 460);
  });

  let characterY = origin.y;
  nodesOfType("character").forEach((characterNode) => {
    const characterUid = text(characterNode.uid);
    const imageNodes = sortedByCoordinates(
      connectedCharacterImageNodes(next, characterUid)
    );
    imageNodes.forEach((imageNode, imageIndex) => {
      place(
        imageNode,
        origin.x + contentLayout.imageX + (imageIndex % 3) * 340,
        characterY + Math.floor(imageIndex / 3) * 300
      );
    });
    place(characterNode, origin.x + contentLayout.characterX, characterY);
    const imageRowCount = Math.max(1, Math.ceil(imageNodes.length / 3));
    characterY += Math.max(460, imageRowCount * 300 + 160);
  });

  next.nodes = nodes;
  return next;
}

export function compareCanvasLorebooks(
  canvas: JsonObject,
  sources: LorebookEntry[]
): CanvasLorebookRow[] {
  const canvasEntries = canvasNodeEntries(canvas, "lorebook");
  const sourceGroups = groupBy(sources, (entry) => normalizedTitle(entry.title));
  const canvasGroups = groupBy(
    canvasEntries,
    (entry) => normalizedTitle(entry.metadata.title)
  );
  const keys = new Set([...sourceGroups.keys(), ...canvasGroups.keys()]);

  return [...keys].map((key) => {
    const sourceMatches = sourceGroups.get(key) ?? [];
    const canvasMatches = canvasGroups.get(key) ?? [];
    const source = sourceMatches[0] ?? null;
    const canvasEntry = canvasMatches[0] ?? null;
    const loreEntry = canvasEntry
      ? objectArray(canvasEntry.metadata.entries)[0] ?? null
      : null;
    const match = source && canvasEntry
      ? lorebookMatches(source, canvasEntry.metadata)
      : {
          exact: false,
          bodyMatches: false,
          keyMatches: false,
          patternsMatch: false,
          priorityMatches: false,
          canvasBody: normalizedText(loreEntry?.text),
          canvasKey: normalizedText(loreEntry?.key),
          canvasPatterns: stringArray(loreEntry?.patterns),
          canvasPriority: undefined,
          sourcePriority: source ? lorebookPriority(source.type) : 0
        };
    let status: CanvasContentStatus;
    if (sourceMatches.length > 1 || canvasMatches.length > 1) status = "duplicate";
    else if (!source) status = "canvas-only";
    else if (!canvasEntry) status = "source-only";
    else status = match.exact ? "exact" : "changed";

    return {
      id: canvasEntry?.uid ?? source?.id ?? key,
      title: source?.title || normalizedText(canvasEntry?.metadata.title) || "(제목 없음)",
      status,
      source,
      nodeUid: canvasEntry?.uid ?? null,
      canvasTextLength: normalizedText(loreEntry?.text).length,
      sourceTextLength: normalizedText(source?.body).length,
      ...match
    };
  }).sort((left, right) =>
    left.status.localeCompare(right.status)
    || left.title.localeCompare(right.title, "ko")
  );
}

export function updateCanvasLorebook(
  canvas: JsonObject,
  nodeUid: string,
  source: LorebookEntry,
  updatedAt = new Date().toISOString()
) {
  const next = structuredClone(canvas);
  const metadata = metadataSet(next);
  const nodeMetadata = metadata[nodeUid];
  if (!isJsonObject(nodeMetadata) || nodeMetadata.type !== "lorebook") {
    throw new Error(`로어북 노드를 찾을 수 없습니다: ${nodeUid}`);
  }
  const entries = objectArray(nodeMetadata.entries);
  const currentEntry = entries[0] ?? {};
  const triggers = source.triggers.map(normalizedText).filter(Boolean);
  nodeMetadata.title = source.title;
  nodeMetadata.entries = [
    {
      ...currentEntry,
      key: triggers.join("|"),
      patterns: triggers,
      text: source.body,
      tokenCount: estimateTokenCount(source.body),
      priority: lorebookPriority(source.type)
    },
    ...entries.slice(1)
  ];
  nodeMetadata.updatedAt = updatedAt;
  metadata[nodeUid] = nodeMetadata;
  next.metadataSet = metadata;
  return next;
}

export function addCanvasLorebook(
  canvas: JsonObject,
  source: LorebookEntry,
  options: CanvasNodeCreationOptions = {}
) {
  const next = structuredClone(canvas);
  const nodeUid = options.nodeUid ?? generatedUid();
  const connectionUid = options.connectionUid ?? generatedUid();
  const createdAt = options.createdAt ?? new Date().toISOString();
  const hubUid = selectedHubUid(next, options.hubUid);
  const triggers = source.triggers.map(normalizedText).filter(Boolean);
  next.nodes = [
    ...objectArray(next.nodes),
    {
      uid: nodeUid,
      hash: shortHash(nodeUid),
      coordinates: nextNodeCoordinates(next, "lorebook"),
      name: "macro-prompts-node",
      type: "lorebook"
    }
  ];
  if (hubUid) next.connections = [
    ...objectArray(next.connections),
    {
      uid: connectionUid,
      sourceNodeId: nodeUid,
      sourceOutputPortName: "lorebook",
      sourceOutputIndex: 0,
      sourceOutputLabel: "macro-prompts-data",
      sourceOutputRelation: "매크로 프롬프트 항목.",
      targetNodeId: hubUid,
      targetInputPortName: "hubInput",
      targetInputIndex: 0,
      targetInputLabel: "hub-input",
      targetInputRelation: "Hub grouping input.",
      connectionType: "lorebook"
    }
  ];
  const metadata = metadataSet(next);
  metadata[nodeUid] = {
    entries: [{
      key: triggers.join("|"),
      patterns: triggers,
      text: source.body,
      tokenCount: estimateTokenCount(source.body),
      priority: lorebookPriority(source.type),
      durationTurns: 1,
      activationMode: "keyword"
    }],
    nodeUid,
    type: "lorebook",
    title: source.title,
    text: "",
    useTokenBlock: true,
    createdAt,
    updatedAt: createdAt
  };
  next.metadataSet = metadata;
  return next;
}

export function deleteCanvasNode(canvas: JsonObject, nodeUid: string) {
  const next = structuredClone(canvas);
  next.nodes = objectArray(next.nodes).filter((node) => node.uid !== nodeUid);
  next.connections = objectArray(next.connections).filter(
    (connection) => connection.sourceNodeId !== nodeUid
      && connection.targetNodeId !== nodeUid
  );
  const metadata = metadataSet(next);
  delete metadata[nodeUid];
  next.metadataSet = metadata;
  return next;
}

function characterMatches(source: CharacterRecord, metadata: JsonObject) {
  return {
    promptMatches: normalizedText(metadata.coreContext) === normalizedText(source.prompt),
    backgroundMatches: normalizedText(metadata.text) === normalizedText(source.background)
  };
}

export function compareCanvasCharacters(
  canvas: JsonObject,
  sources: CharacterRecord[]
): CanvasCharacterRow[] {
  const canvasEntries = canvasNodeEntries(canvas, "character");
  const sourceGroups = groupBy(sources, (entry) => normalizedTitle(entry.name));
  const canvasGroups = groupBy(
    canvasEntries,
    (entry) => normalizedTitle(entry.metadata.name || entry.metadata.title)
  );
  const keys = new Set([...sourceGroups.keys(), ...canvasGroups.keys()]);

  return [...keys].map((key) => {
    const sourceMatches = sourceGroups.get(key) ?? [];
    const canvasMatches = canvasGroups.get(key) ?? [];
    const source = sourceMatches[0] ?? null;
    const canvasEntry = canvasMatches[0] ?? null;
    const matches = source && canvasEntry
      ? characterMatches(source, canvasEntry.metadata)
      : { promptMatches: false, backgroundMatches: false };
    let status: CanvasContentStatus;
    if (sourceMatches.length > 1 || canvasMatches.length > 1) status = "duplicate";
    else if (!source) status = "canvas-only";
    else if (!canvasEntry) status = "source-only";
    else status = matches.promptMatches && matches.backgroundMatches ? "exact" : "changed";
    const imageNodeCount = canvasEntry
      ? connectedCharacterImageNodes(canvas, canvasEntry.uid).length
      : 0;

    return {
      id: canvasEntry?.uid ?? source?.id ?? key,
      name: source?.name
        || normalizedText(canvasEntry?.metadata.name || canvasEntry?.metadata.title)
        || "(이름 없음)",
      group: source?.group ?? "other",
      status,
      ...matches,
      canvasPrompt: normalizedText(canvasEntry?.metadata.coreContext),
      canvasBackground: normalizedText(canvasEntry?.metadata.text),
      source,
      nodeUid: canvasEntry?.uid ?? null,
      imageNodeCount,
      missingImageNodeCount: Math.max(0, expectedCharacterImageCount - imageNodeCount)
    };
  }).sort((left, right) =>
    left.status.localeCompare(right.status)
    || left.name.localeCompare(right.name, "ko")
  );
}

export function updateCanvasCharacter(
  canvas: JsonObject,
  nodeUid: string,
  source: CharacterRecord,
  updatedAt = new Date().toISOString()
) {
  const next = structuredClone(canvas);
  const metadata = metadataSet(next);
  const nodeMetadata = metadata[nodeUid];
  if (!isJsonObject(nodeMetadata) || nodeMetadata.type !== "character") {
    throw new Error(`인물 노드를 찾을 수 없습니다: ${nodeUid}`);
  }
  nodeMetadata.name = source.name;
  nodeMetadata.title = source.name;
  nodeMetadata.coreContext = source.prompt;
  nodeMetadata.coreContextTokenCount = estimateTokenCount(source.prompt);
  nodeMetadata.text = source.background;
  nodeMetadata.updatedAt = updatedAt;
  metadata[nodeUid] = nodeMetadata;
  next.metadataSet = metadata;
  return next;
}

export function addCanvasCharacter(
  canvas: JsonObject,
  source: CharacterRecord,
  options: CanvasNodeCreationOptions = {}
) {
  const next = structuredClone(canvas);
  const nodeUid = options.nodeUid ?? generatedUid();
  const connectionUid = options.connectionUid ?? generatedUid();
  const createdAt = options.createdAt ?? new Date().toISOString();
  const hubUid = selectedHubUid(next, options.hubUid);
  next.nodes = [
    ...objectArray(next.nodes),
    {
      uid: nodeUid,
      hash: shortHash(nodeUid),
      coordinates: nextNodeCoordinates(next, "character"),
      name: "character-node",
      type: "character"
    }
  ];
  if (hubUid) next.connections = [
    ...objectArray(next.connections),
    {
      uid: connectionUid,
      sourceNodeId: nodeUid,
      sourceOutputPortName: "character",
      sourceOutputIndex: 0,
      sourceOutputLabel: "character-port",
      sourceOutputRelation: "캐릭터의 정보.",
      targetNodeId: hubUid,
      targetInputPortName: "hubInput",
      targetInputIndex: 0,
      targetInputLabel: "hub-input",
      targetInputRelation: "Hub grouping input.",
      connectionType: "character"
    }
  ];
  const metadata = metadataSet(next);
  metadata[nodeUid] = {
    name: source.name,
    coreContext: source.prompt,
    coreContextTokenCount: estimateTokenCount(source.prompt),
    priority: 0,
    simplifiedIntro: "",
    startingDialogue: source.introduction,
    hiddenInPreview: false,
    hoverDescription: source.role,
    nodeUid,
    type: "character",
    title: source.name,
    text: source.background,
    useTokenBlock: true,
    createdAt,
    updatedAt: createdAt
  };
  next.metadataSet = metadata;
  return addCanvasCharacterImages(next, nodeUid, source.name, {
    nodeUids: options.imageNodeUids,
    connectionUids: options.imageConnectionUids,
    createdAt
  });
}

export function addCanvasCharacterImages(
  canvas: JsonObject,
  characterUid: string,
  characterName: string,
  options: {
    nodeUids?: string[];
    connectionUids?: string[];
    createdAt?: string;
  } = {}
) {
  const next = structuredClone(canvas);
  const characterNode = objectArray(next.nodes).find(
    (node) => node.uid === characterUid && node.type === "character"
  );
  if (!characterNode) {
    throw new Error(`인물 노드를 찾을 수 없습니다: ${characterUid}`);
  }
  const existingImages = connectedCharacterImageNodes(next, characterUid);
  const missingCount = Math.max(0, expectedCharacterImageCount - existingImages.length);
  if (!missingCount) return next;

  const createdAt = options.createdAt ?? new Date().toISOString();
  const characterX = numericCoordinate(characterNode, "x");
  const characterY = numericCoordinate(characterNode, "y");
  const metadata = metadataSet(next);
  const usedLabels = new Set(
    existingImages.map((node) => normalizedText(metadata[text(node.uid)] && isJsonObject(metadata[text(node.uid)])
      ? (metadata[text(node.uid)] as JsonObject).title
      : ""))
  );
  const availableLabels = characterImageLabels.filter(
    (label) => ![...usedLabels].some((title) => title.endsWith(label))
  );

  for (let index = 0; index < missingCount; index += 1) {
    const imageIndex = existingImages.length + index;
    const label = availableLabels[index] ?? `이미지 ${imageIndex + 1}`;
    const imageUid = options.nodeUids?.[index] ?? generatedUid();
    const connectionUid = options.connectionUids?.[index] ?? generatedUid();
    const imageNode = {
      uid: imageUid,
      hash: shortHash(imageUid),
      coordinates: {
        x: characterX - 1200 + (imageIndex % 3) * 340,
        y: characterY + Math.floor(imageIndex / 3) * 300
      },
      name: "image-node",
      type: "image"
    };
    next.nodes = [...objectArray(next.nodes), imageNode];
    next.connections = [
      ...objectArray(next.connections),
      {
        uid: connectionUid,
        sourceNodeId: imageUid,
        sourceOutputPortName: "imageSet",
        sourceOutputIndex: 0,
        sourceOutputLabel: "image-set-port",
        sourceOutputRelation: "이미지 묶음.",
        targetNodeId: characterUid,
        targetInputPortName: "situationImageSet",
        targetInputIndex: 1,
        targetInputLabel: "situation-image-port",
        targetInputRelation: "인물 상황과 관련된 이미지 세트.",
        connectionType: "image"
      }
    ];
    metadata[imageUid] = {
      images: [],
      isProfile: false,
      unlockSettings: {
        enableManualUnlock: true,
        manualUnlockPrice: 50,
        allowAutoUnlock: true
      },
      nodeUid: imageUid,
      type: "image",
      title: `${characterName} ${label}`,
      text: "",
      useTokenBlock: true,
      createdAt,
      updatedAt: createdAt
    };
  }
  next.metadataSet = metadata;
  return next;
}

export function compareCanvasUpdateRules(
  canvas: JsonObject,
  sources: RplayUpdateRule[]
): CanvasUpdateRuleRow[] {
  const canvasEntries = canvasNodeEntries(canvas, "updateRule");
  const sourceGroups = groupBy(sources, (entry) => normalizedTitle(entry.title));
  const canvasGroups = groupBy(
    canvasEntries,
    (entry) => normalizedTitle(entry.metadata.title)
  );
  const keys = new Set([...sourceGroups.keys(), ...canvasGroups.keys()]);

  return [...keys].map((key) => {
    const sourceMatches = sourceGroups.get(key) ?? [];
    const canvasMatches = canvasGroups.get(key) ?? [];
    const source = sourceMatches[0] ?? null;
    const canvasEntry = canvasMatches[0] ?? null;
    let status: CanvasContentStatus;
    if (sourceMatches.length > 1 || canvasMatches.length > 1) status = "duplicate";
    else if (!source) status = "canvas-only";
    else if (!canvasEntry) status = "source-only";
    else {
      status = normalizedText(canvasEntry.metadata.text) === normalizedText(source.text)
        ? "exact"
        : "changed";
    }

    return {
      id: canvasEntry?.uid ?? source?.id ?? key,
      title: source?.title || normalizedText(canvasEntry?.metadata.title) || "(제목 없음)",
      status,
      source,
      nodeUid: canvasEntry?.uid ?? null,
      canvasTextLength: normalizedText(canvasEntry?.metadata.text).length,
      sourceTextLength: normalizedText(source?.text).length,
      canvasText: normalizedText(canvasEntry?.metadata.text)
    };
  }).sort((left, right) =>
    left.status.localeCompare(right.status)
    || left.title.localeCompare(right.title, "ko")
  );
}

export function updateCanvasUpdateRule(
  canvas: JsonObject,
  nodeUid: string,
  source: RplayUpdateRule,
  updatedAt = new Date().toISOString()
) {
  const next = structuredClone(canvas);
  const metadata = metadataSet(next);
  const nodeMetadata = metadata[nodeUid];
  if (!isJsonObject(nodeMetadata) || nodeMetadata.type !== "updateRule") {
    throw new Error(`업데이트 규칙 노드를 찾을 수 없습니다: ${nodeUid}`);
  }
  nodeMetadata.title = source.title;
  nodeMetadata.text = source.text;
  nodeMetadata.updatedAt = updatedAt;
  metadata[nodeUid] = nodeMetadata;
  next.metadataSet = metadata;
  return next;
}

export function addCanvasUpdateRule(
  canvas: JsonObject,
  source: RplayUpdateRule,
  options: CanvasNodeCreationOptions = {}
) {
  const next = structuredClone(canvas);
  const nodeUid = options.nodeUid ?? generatedUid();
  const createdAt = options.createdAt ?? new Date().toISOString();
  next.nodes = [
    ...objectArray(next.nodes),
    {
      uid: nodeUid,
      hash: shortHash(nodeUid),
      coordinates: nextNodeCoordinates(next, "updateRule"),
      name: "update-rule-node",
      type: "updateRule"
    }
  ];
  const metadata = metadataSet(next);
  metadata[nodeUid] = {
    nodeUid,
    type: "updateRule",
    title: source.title,
    text: source.text,
    useTokenBlock: true,
    createdAt,
    updatedAt: createdAt
  };
  next.metadataSet = metadata;
  return next;
}

export function compareCanvasVariables(
  canvas: JsonObject,
  sources: RplayVariable[]
): CanvasVariableRow[] {
  const canvasEntries = canvasNodeEntries(canvas, "variable");
  const sourceGroups = groupBy(
    sources,
    (entry) => normalizedText(entry.variableName)
  );
  const canvasGroups = groupBy(
    canvasEntries,
    (entry) => normalizedText(entry.metadata.variableName)
  );
  const keys = new Set([...sourceGroups.keys(), ...canvasGroups.keys()]);

  return [...keys].map((key) => {
    const sourceMatches = sourceGroups.get(key) ?? [];
    const canvasMatches = canvasGroups.get(key) ?? [];
    const source = sourceMatches[0] ?? null;
    const canvasEntry = canvasMatches[0] ?? null;
    const typeMatches = Boolean(source && canvasEntry)
      && normalizedText(canvasEntry!.metadata.variableType) === source!.variableType;
    const initialValueMatches = Boolean(source && canvasEntry)
      && JSON.stringify(canvasEntry!.metadata.initValue) === JSON.stringify(source!.initValue);
    const titleMatches = Boolean(source && canvasEntry)
      && normalizedText(canvasEntry!.metadata.title) === normalizedText(source!.title);
    let status: CanvasContentStatus;
    if (sourceMatches.length > 1 || canvasMatches.length > 1) status = "duplicate";
    else if (!source) status = "canvas-only";
    else if (!canvasEntry) status = "source-only";
    else status = typeMatches && initialValueMatches && titleMatches ? "exact" : "changed";

    return {
      id: canvasEntry?.uid ?? source?.id ?? key,
      name: source?.variableName
        || normalizedText(canvasEntry?.metadata.variableName)
        || "(변수명 없음)",
      status,
      typeMatches,
      initialValueMatches,
      titleMatches,
      canvasTitle: normalizedText(canvasEntry?.metadata.title),
      canvasType: normalizedText(canvasEntry?.metadata.variableType),
      canvasInitialValue: canvasEntry?.metadata.initValue,
      source,
      nodeUid: canvasEntry?.uid ?? null
    };
  }).sort((left, right) =>
    left.status.localeCompare(right.status)
    || left.name.localeCompare(right.name, "ko")
  );
}

export function updateCanvasVariable(
  canvas: JsonObject,
  nodeUid: string,
  source: RplayVariable,
  updatedAt = new Date().toISOString()
) {
  const next = structuredClone(canvas);
  const metadata = metadataSet(next);
  const nodeMetadata = metadata[nodeUid];
  if (!isJsonObject(nodeMetadata) || nodeMetadata.type !== "variable") {
    throw new Error(`변수 노드를 찾을 수 없습니다: ${nodeUid}`);
  }
  nodeMetadata.title = source.title;
  nodeMetadata.variableName = source.variableName;
  nodeMetadata.variableType = source.variableType;
  nodeMetadata.initValue = source.initValue;
  delete nodeMetadata.rules;
  nodeMetadata.updatedAt = updatedAt;
  metadata[nodeUid] = nodeMetadata;
  next.metadataSet = metadata;
  return next;
}

export function addCanvasVariable(
  canvas: JsonObject,
  source: RplayVariable,
  options: CanvasNodeCreationOptions = {}
) {
  const next = structuredClone(canvas);
  const nodeUid = options.nodeUid ?? generatedUid();
  const createdAt = options.createdAt ?? new Date().toISOString();
  next.nodes = [
    ...objectArray(next.nodes),
    {
      uid: nodeUid,
      hash: shortHash(nodeUid),
      coordinates: nextNodeCoordinates(next, "variable"),
      name: "variable-node",
      type: "variable"
    }
  ];
  const metadata = metadataSet(next);
  metadata[nodeUid] = {
    variableName: source.variableName,
    variableType: source.variableType,
    initValue: source.initValue,
    nodeUid,
    type: "variable",
    title: source.title,
    text: "",
    useTokenBlock: true,
    createdAt,
    updatedAt: createdAt
  };
  next.metadataSet = metadata;
  return next;
}

export function syncCanvasVariableRuleConnections(
  canvas: JsonObject,
  variables: RplayVariable[],
  rules: RplayUpdateRule[]
) {
  const next = structuredClone(canvas);
  const variableEntries = canvasNodeEntries(next, "variable");
  const ruleEntries = canvasNodeEntries(next, "updateRule");
  const variableUidByName = new Map(
    variableEntries.map((entry) => [normalizedText(entry.metadata.variableName), entry.uid])
  );
  const ruleUidByTitle = new Map(
    ruleEntries.map((entry) => [normalizedTitle(entry.metadata.title), entry.uid])
  );
  const managedVariableUids = new Set(
    variables
      .map((variable) => variableUidByName.get(normalizedText(variable.variableName)))
      .filter((uid): uid is string => Boolean(uid))
  );
  const metadata = metadataSet(next);
  managedVariableUids.forEach((uid) => {
    const variableMetadata = metadata[uid];
    if (!isJsonObject(variableMetadata)) return;
    delete variableMetadata.rules;
    metadata[uid] = variableMetadata;
  });
  next.metadataSet = metadata;
  const ruleUids = new Set(ruleEntries.map((entry) => entry.uid));
  const desiredPairs = new Map<string, { variableUid: string; ruleUid: string }>();

  rules.forEach((rule) => {
    const ruleUid = ruleUidByTitle.get(normalizedTitle(rule.title));
    if (!ruleUid) return;
    [...new Set(rule.variables ?? [])].forEach((variableName) => {
      const variableUid = variableUidByName.get(normalizedText(variableName));
      if (!variableUid) return;
      desiredPairs.set(`${variableUid}:${ruleUid}`, { variableUid, ruleUid });
    });
  });

  const satisfiedPairs = new Set<string>();
  const preservedConnections = objectArray(next.connections).filter((connection) => {
    const variableUid = normalizedText(connection.sourceNodeId);
    const ruleUid = normalizedText(connection.targetNodeId);
    if (!managedVariableUids.has(variableUid) || !ruleUids.has(ruleUid)) return true;
    const pair = `${variableUid}:${ruleUid}`;
    if (!desiredPairs.has(pair) || satisfiedPairs.has(pair)) return false;
    satisfiedPairs.add(pair);
    return true;
  });
  const variableRuleConnections = [...desiredPairs.entries()]
    .filter(([pair]) => !satisfiedPairs.has(pair))
    .map(([, { variableUid, ruleUid }]) => ({
    uid: generatedUid(),
    sourceNodeId: variableUid,
    sourceOutputPortName: "variable",
    sourceOutputIndex: 0,
    sourceOutputLabel: "variable-port",
    sourceOutputRelation: "변수 데이터.",
    targetNodeId: ruleUid,
    targetInputPortName: "variable",
    targetInputIndex: 0,
    targetInputLabel: "variable-port",
    targetInputRelation: "업데이트 규칙이 갱신할 변수.",
      connectionType: "variable"
    }));

  next.connections = [...preservedConnections, ...variableRuleConnections];
  return next;
}

export function compareCanvasStatusViews(
  canvas: JsonObject,
  sources: StatusViewAssetSource[]
): CanvasStatusViewRow[] {
  const canvasEntries = canvasNodeEntries(canvas, "statusView");
  const sourceGroups = groupBy(sources, (source) => statusViewNameKey(source.name));
  const canvasGroups = groupBy(
    canvasEntries,
    (entry) => statusViewNameKey(entry.metadata.title || entry.metadata.statusTitle)
  );

  return [...canvasGroups.entries()].flatMap(([key, canvasMatches]) => {
    const sourceMatches = sourceGroups.get(key) ?? [];
    return canvasMatches.map((canvasEntry) => {
      const source = sourceMatches[0] ?? null;
      const canvasHtml = normalizedText(canvasEntry.metadata.htmlContent);
      let status: CanvasContentStatus;
      if (canvasMatches.length > 1 || sourceMatches.length > 1) status = "duplicate";
      else if (!source) status = "canvas-only";
      else status = canvasHtml === normalizedText(source.content) ? "exact" : "changed";

      return {
        id: canvasEntry.uid,
        title: normalizedText(canvasEntry.metadata.title || canvasEntry.metadata.statusTitle) || "(제목 없음)",
        assetName: source?.name ?? "",
        status,
        source,
        nodeUid: canvasEntry.uid,
        canvasHtmlLength: canvasHtml.length,
        sourceHtmlLength: normalizedText(source?.content).length,
        canvasHtml
      };
    });
  }).sort((left, right) =>
    left.status.localeCompare(right.status)
    || left.title.localeCompare(right.title, "ko")
  );
}

export function addCanvasStatusView(canvas: JsonObject, source: StatusViewAssetSource) {
  const next = structuredClone(canvas);
  const uid = generatedUid();
  const title = source.name.replace(/\.html$/i, "");
  next.nodes = [...objectArray(next.nodes), { uid, hash: shortHash(uid), coordinates: nextNodeCoordinates(next, "statusView"), name: "status-view-node", type: "statusView" }];
  const metadata = metadataSet(next);
  metadata[uid] = { nodeUid: uid, type: "statusView", title, text: "", useTokenBlock: true,
    statusMode: "advanced", statusTitle: title, htmlContent: source.content,
    viewWidth: 500, viewHeight: 1000, autoSizeToContent: true, displayStates: [] };
  next.metadataSet = metadata;
  return next;
}

export function addCanvasStory(canvas: JsonObject, prompts: PromptState, source: PromptVersion) {
  const next = structuredClone(canvas);
  const uid = generatedUid();
  next.nodes = [...objectArray(next.nodes), { uid, hash: shortHash(uid), coordinates: nextNodeCoordinates(next, "story"), name: "story-node", type: "story" }];
  const metadata = metadataSet(next);
  metadata[uid] = { nodeUid: uid, type: "story", title: source.name, text: "", useTokenBlock: true,
    isStart: source.nodeType === "start", sort: 0, creatorNotice: "", plotSummary: "", presetNoteNodes: [], achievements: [], characterImageTagMap: {},
    advancedSettings: { disableDynamicMemory: false, disableAutoPlotCompression: false, disableMacroPromptInjections: false,
      disableDefaultContentPolicy: false, disableNarrativeInstructions: false, disableEmotionImageCue: false, disableSituationImageCue: false } };
  next.metadataSet = metadata;
  return updateCanvasStory(next, uid, prompts, source);
}

export function updateCanvasStatusView(
  canvas: JsonObject,
  nodeUid: string,
  source: StatusViewAssetSource,
  updatedAt = new Date().toISOString()
) {
  const next = structuredClone(canvas);
  const metadata = metadataSet(next);
  const nodeMetadata = metadata[nodeUid];
  if (!isJsonObject(nodeMetadata) || nodeMetadata.type !== "statusView") {
    throw new Error(`상태창 노드를 찾을 수 없습니다: ${nodeUid}`);
  }
  nodeMetadata.htmlContent = source.content;
  nodeMetadata.updatedAt = updatedAt;
  metadata[nodeUid] = nodeMetadata;
  next.metadataSet = metadata;
  return next;
}

function storySourceFor(
  metadata: JsonObject,
  versions: PromptVersion[]
) {
  const title = normalizedTitle(metadata.title);
  const exactNameMatch = versions.find(
    (version) => normalizedTitle(version.name) === title
  );
  if (exactNameMatch) return exactNameMatch;

  const idMatches = versions.filter((version) => {
    const id = normalizedTitle(version.id);
    return id && id !== "메인" && title.includes(id);
  });
  return idMatches.length === 1 ? idMatches[0] : null;
}

function compactForInclusion(value: unknown) {
  return normalizedText(value).replace(/\s+/g, " ");
}

export function storyPromptText(mainPrompt: unknown, additionalPrompt: unknown) {
  return [normalizedText(mainPrompt), normalizedText(additionalPrompt)]
    .filter(Boolean)
    .join("\n\n");
}

function diffTokens(value: string) {
  return value.match(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]+|\s+/gu) ?? [];
}

function mergeDiffParts(parts: CanvasTextDiffPart[]) {
  return parts.reduce<CanvasTextDiffPart[]>((merged, part) => {
    if (!part.text) return merged;
    const previous = merged.at(-1);
    if (previous?.type === part.type) previous.text += part.text;
    else merged.push({ ...part });
    return merged;
  }, []);
}

function backtrackDiff(
  canvasTokens: string[],
  sourceTokens: string[],
  trace: Map<number, number>[]
) {
  let canvasIndex = canvasTokens.length;
  let sourceIndex = sourceTokens.length;
  const reversed: CanvasTextDiffPart[] = [];

  for (let depth = trace.length - 1; depth >= 0; depth -= 1) {
    const frontier = trace[depth];
    const diagonal = canvasIndex - sourceIndex;
    const cameFromInsertion = diagonal === -depth || (
      diagonal !== depth
      && (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY)
        < (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY)
    );
    const previousDiagonal = cameFromInsertion ? diagonal + 1 : diagonal - 1;
    const previousCanvasIndex = frontier.get(previousDiagonal) ?? 0;
    const previousSourceIndex = previousCanvasIndex - previousDiagonal;

    while (canvasIndex > previousCanvasIndex && sourceIndex > previousSourceIndex) {
      canvasIndex -= 1;
      sourceIndex -= 1;
      reversed.push({ type: "same", text: canvasTokens[canvasIndex] });
    }
    if (depth === 0) break;
    if (cameFromInsertion) {
      sourceIndex -= 1;
      reversed.push({ type: "add", text: sourceTokens[sourceIndex] });
    } else {
      canvasIndex -= 1;
      reversed.push({ type: "remove", text: canvasTokens[canvasIndex] });
    }
  }

  return mergeDiffParts(reversed.reverse());
}

function buildTokenDiff(canvasTokens: string[], sourceTokens: string[]) {
  const maxDepth = canvasTokens.length + sourceTokens.length;
  const traceDepthLimit = Math.min(maxDepth, 600);
  const frontier = new Map<number, number>([[1, 0]]);
  const trace: Map<number, number>[] = [];

  for (let depth = 0; depth <= traceDepthLimit; depth += 1) {
    trace.push(new Map(frontier));
    for (let diagonal = -depth; diagonal <= depth; diagonal += 2) {
      const insertion = diagonal === -depth || (
        diagonal !== depth
        && (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY)
          < (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY)
      );
      let canvasIndex = insertion
        ? frontier.get(diagonal + 1) ?? 0
        : (frontier.get(diagonal - 1) ?? 0) + 1;
      let sourceIndex = canvasIndex - diagonal;

      while (
        canvasIndex < canvasTokens.length
        && sourceIndex < sourceTokens.length
        && canvasTokens[canvasIndex] === sourceTokens[sourceIndex]
      ) {
        canvasIndex += 1;
        sourceIndex += 1;
      }
      frontier.set(diagonal, canvasIndex);
      if (canvasIndex >= canvasTokens.length && sourceIndex >= sourceTokens.length) {
        return backtrackDiff(canvasTokens, sourceTokens, trace);
      }
    }
  }

  return mergeDiffParts([
    { type: "remove", text: canvasTokens.join("") },
    { type: "add", text: sourceTokens.join("") }
  ]);
}

function characterCount(value: string) {
  return Array.from(value).length;
}

export function buildCanvasTextDiff(canvasText: string, sourceText: string): CanvasTextDiff {
  const canvasTokens = diffTokens(canvasText);
  const sourceTokens = diffTokens(sourceText);
  let prefixLength = 0;
  while (
    prefixLength < canvasTokens.length
    && prefixLength < sourceTokens.length
    && canvasTokens[prefixLength] === sourceTokens[prefixLength]
  ) prefixLength += 1;

  let suffixLength = 0;
  while (
    suffixLength < canvasTokens.length - prefixLength
    && suffixLength < sourceTokens.length - prefixLength
    && canvasTokens[canvasTokens.length - suffixLength - 1]
      === sourceTokens[sourceTokens.length - suffixLength - 1]
  ) suffixLength += 1;

  const prefix = canvasTokens.slice(0, prefixLength).join("");
  const suffix = suffixLength ? canvasTokens.slice(-suffixLength).join("") : "";
  const canvasMiddle = canvasTokens.slice(prefixLength, canvasTokens.length - suffixLength);
  const sourceMiddle = sourceTokens.slice(prefixLength, sourceTokens.length - suffixLength);
  const parts = mergeDiffParts([
    { type: "same", text: prefix },
    ...buildTokenDiff(canvasMiddle, sourceMiddle),
    { type: "same", text: suffix }
  ]);
  const addedChars = parts
    .filter((part) => part.type === "add")
    .reduce((sum, part) => sum + characterCount(part.text), 0);
  const removedChars = parts
    .filter((part) => part.type === "remove")
    .reduce((sum, part) => sum + characterCount(part.text), 0);
  const unchangedChars = parts
    .filter((part) => part.type === "same")
    .reduce((sum, part) => sum + characterCount(part.text), 0);
  const changedChars = addedChars + removedChars;
  const changeRatio = changedChars
    ? Math.round((changedChars / (unchangedChars + changedChars)) * 1000) / 10
    : 0;

  return { parts, addedChars, removedChars, unchangedChars, changeRatio };
}

export function compareCanvasStories(
  canvas: JsonObject,
  promptState: PromptState,
  options: { includeWorldStory?: boolean } = {}
): CanvasStoryRow[] {
  return canvasNodeEntries(canvas, "story")
    .map((entry) => {
      const source = storySourceFor(entry.metadata, promptState.versions);
      const title = normalizedText(entry.metadata.title) || "(제목 없음)";
      const titleMatches = Boolean(source)
        && normalizedTitle(title) === normalizedTitle(source!.name);
      const isStart = entry.metadata.isStart === true;
      const sourceIsStart = source?.nodeType ? source.nodeType === "start" : isStart;
      const kindMatches = isStart === sourceIsStart;
      const canvasText = text(entry.metadata.coreContext);
      const sourceText = source
        ? storyPromptText(promptState.mainPrompt, source.additionalPrompt)
        : "";
      const canvasBackgroundText = text(entry.metadata.text);
      const sourceBackgroundText = source && options.includeWorldStory !== false
        ? normalizedText(source.worldStory ?? promptState.worldStory) : "";
      const canvasPrologueText = text(entry.metadata.prologue);
      const sourcePrologueText = source && sourceIsStart ? normalizedText(source.starterMessage) : "";
      const canvasPrologueGuideText = text(entry.metadata.prologueGuide);
      const sourcePrologueGuideText = source && sourceIsStart ? normalizedText(source.starterPrompt) : "";
      const compactCanvas = compactForInclusion(canvasText);
      const compactSource = compactForInclusion(sourceText);
      const compactCanvasBackground = compactForInclusion(canvasBackgroundText);
      const compactSourceBackground = compactForInclusion(sourceBackgroundText);
      const compactCanvasPrologue = compactForInclusion(canvasPrologueText);
      const compactSourcePrologue = compactForInclusion(sourcePrologueText);
      const compactCanvasPrologueGuide = compactForInclusion(canvasPrologueGuideText);
      const compactSourcePrologueGuide = compactForInclusion(sourcePrologueGuideText);
      const promptMatches = compactCanvas === compactSource;
      const backgroundMatches = options.includeWorldStory === false || compactCanvasBackground === compactSourceBackground;
      const prologueMatches = compactCanvasPrologue === compactSourcePrologue;
      const prologueGuideMatches = compactCanvasPrologueGuide === compactSourcePrologueGuide;
      let status: CanvasStoryRow["status"];
      if (!source) status = "unmatched";
      else if (!titleMatches || !kindMatches) status = "different";
      else if (
        promptMatches
        && backgroundMatches
        && prologueMatches
        && prologueGuideMatches
      ) status = "exact";
      else if (
        (compactSource ? compactCanvas.includes(compactSource) : !compactCanvas)
        && (options.includeWorldStory === false || (compactSourceBackground ? compactCanvasBackground.includes(compactSourceBackground) : !compactCanvasBackground))
        && (compactSourcePrologue ? compactCanvasPrologue.includes(compactSourcePrologue) : !compactCanvasPrologue)
        && (compactSourcePrologueGuide ? compactCanvasPrologueGuide.includes(compactSourcePrologueGuide) : !compactCanvasPrologueGuide)
      ) status = "included";
      else status = "different";
      return {
        id: entry.uid,
        title,
        titleMatches,
        isStart,
        nodeUid: entry.uid,
        source,
        status,
        canvasText,
        sourceText,
        canvasBackgroundText,
        sourceBackgroundText,
        canvasPrologueText,
        sourcePrologueText,
        canvasPrologueGuideText,
        sourcePrologueGuideText,
        coreContextDiff: buildCanvasTextDiff(canvasText, sourceText),
        backgroundDiff: buildCanvasTextDiff(canvasBackgroundText,
          options.includeWorldStory === false ? canvasBackgroundText : sourceBackgroundText),
        prologueDiff: buildCanvasTextDiff(canvasPrologueText, sourcePrologueText),
        prologueGuideDiff: buildCanvasTextDiff(
          canvasPrologueGuideText,
          sourcePrologueGuideText
        )
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title, "ko"));
}

export function updateCanvasStory(
  canvas: JsonObject,
  nodeUid: string,
  promptState: PromptState,
  source: PromptVersion,
  updatedAt = new Date().toISOString(),
  options: { includeWorldStory?: boolean } = {}
) {
  const next = structuredClone(canvas);
  const metadata = metadataSet(next);
  const nodeMetadata = metadata[nodeUid];
  if (!isJsonObject(nodeMetadata) || nodeMetadata.type !== "story") {
    throw new Error(`스토리 노드를 찾을 수 없습니다: ${nodeUid}`);
  }
  const promptText = storyPromptText(promptState.mainPrompt, source.additionalPrompt);
  const backgroundText = normalizedText(source.worldStory ?? promptState.worldStory);
  const prologueText = normalizedText(source.starterMessage);
  const prologueGuideText = normalizedText(source.starterPrompt);
  nodeMetadata.title = source.name;
  nodeMetadata.isStart = source.nodeType ? source.nodeType === "start" : nodeMetadata.isStart === true;
  nodeMetadata.coreContext = promptText;
  nodeMetadata.coreContextTokenCount = estimateTokenCount(promptText);
  if (options.includeWorldStory !== false) {
    nodeMetadata.text = backgroundText;
    nodeMetadata.textTokenCount = estimateTokenCount(backgroundText);
  }
  nodeMetadata.prologue = nodeMetadata.isStart ? prologueText : "";
  nodeMetadata.prologueTokenCount = estimateTokenCount(String(nodeMetadata.prologue));
  nodeMetadata.prologueGuide = nodeMetadata.isStart ? prologueGuideText : "";
  nodeMetadata.prologueGuideTokenCount = estimateTokenCount(String(nodeMetadata.prologueGuide));
  nodeMetadata.updatedAt = updatedAt;
  metadata[nodeUid] = nodeMetadata;
  next.metadataSet = metadata;
  return next;
}

export type CanvasAchievementRow = {
  id: string;
  name: string;
  status: CanvasContentStatus;
  achievementMatches: boolean;
  conditionMatches: boolean;
  source: RplayAchievement | null;
  achievementNodeUid: string | null;
  triggerNodeUid: string | null;
  targetVariableNodeUid: string | null;
  targetVariableName: string;
  canvasVariableType: string;
  canvasConditionType: string;
  canvasConditionValue: unknown;
  canvasDescription: string;
  canvasCredits: number;
  canvasIsHidden: boolean;
};

function canvasAchievementCondition(conditionType: RplayAchievement["conditionType"]) {
  if (conditionType === "equal") return "equal";
  if (conditionType === "above" || conditionType === "greater" || conditionType === "greater_equal") return "above";
  if (conditionType === "below" || conditionType === "less" || conditionType === "less_equal") return "below";
  return null;
}

function booleanConditionValue(value: unknown) {
  const normalized = normalizedText(value).toLocaleLowerCase("en-US");
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

function conditionBlockValue(block: JsonObject | null) {
  if (!block) return undefined;
  if (block.variableType === "number") return block.numberValue;
  if (block.variableType === "boolean") return block.booleanValue;
  return block.stringValue;
}

function reusableVariableOid(canvas: JsonObject, variableNodeUid: string, variableName: string) {
  const variableEntry = canvasNodeEntries(canvas, "variable")
    .find((entry) => entry.uid === variableNodeUid);
  const metadataOid = normalizedText(variableEntry?.metadata.variableOid);
  if (metadataOid) return metadataOid;

  const conditionBlocks = canvasNodeEntries(canvas, "trigger")
    .flatMap((trigger) => objectArray(trigger.metadata.conditionBlocks))
    .filter((block) => normalizedText(block.variableOid));
  const exactBlock = conditionBlocks.find((block) =>
    normalizedText(block.variableNodeUid) === variableNodeUid
  );
  if (exactBlock) return normalizedText(exactBlock.variableOid);

  const namedBlock = conditionBlocks.find((block) =>
    normalizedText(block.variableName).toLocaleLowerCase("ko-KR") === variableName.toLocaleLowerCase("ko-KR")
  );
  return normalizedText(namedBlock?.variableOid);
}

function achievementConditionBlock(
  canvas: JsonObject,
  source: RplayAchievement,
  targetVariableNodeUid?: string | null
) {
  const variableNodes = canvasNodeEntries(canvas, "variable");
  const variableEntry = targetVariableNodeUid
    ? variableNodes.find((variable) => variable.uid === targetVariableNodeUid) ?? null
    : variableNodes.find((variable) =>
      normalizedText(variable.metadata.variableName).toLocaleLowerCase("ko-KR")
        === normalizedText(source.targetVariable || "achv").toLocaleLowerCase("ko-KR")
    ) ?? null;
  if (!variableEntry) {
    throw new Error(`감시 대상 변수 노드를 찾을 수 없습니다: ${source.targetVariable || "achv"}`);
  }

  const variableType = normalizedText(variableEntry.metadata.variableType);
  if (variableType !== "string" && variableType !== "number" && variableType !== "boolean") {
    throw new Error(`지원하지 않는 변수 타입입니다: ${variableType || "(비어 있음)"}`);
  }
  const numberCondition = canvasAchievementCondition(source.conditionType);
  if (!numberCondition) {
    throw new Error(`알플레이 캔버스에서 지원하지 않는 업적 조건입니다: ${source.conditionType}`);
  }
  const numericValue = Number(source.conditionValue);
  if (variableType === "number" && !Number.isFinite(numericValue)) {
    throw new Error(`숫자 변수 ${source.targetVariable}의 조건 값이 숫자가 아닙니다: ${source.conditionValue}`);
  }
  const booleanValue = booleanConditionValue(source.conditionValue);
  if (variableType === "boolean" && booleanValue === null) {
    throw new Error(`불리언 변수 ${source.targetVariable}의 조건 값은 true/false 또는 1/0이어야 합니다.`);
  }

  return {
    variableNodeUid: variableEntry.uid,
    conditionBlock: {
      variableOid: reusableVariableOid(canvas, variableEntry.uid, source.targetVariable || "achv"),
      variableName: source.targetVariable || "achv",
      variableType,
      numberCondition,
      numberValue: variableType === "number" ? numericValue : 0,
      booleanValue: variableType === "boolean" ? booleanValue : false,
      stringValue: variableType === "string" ? String(source.conditionValue || "") : "",
      variableNodeUid: variableEntry.uid
    }
  };
}

export function compareCanvasAchievements(
  canvas: JsonObject,
  sources: RplayAchievement[],
  variables: RplayVariable[] = []
): CanvasAchievementRow[] {
  const achvNodes = canvasNodeEntries(canvas, "achievement");
  const triggerNodes = canvasNodeEntries(canvas, "trigger");
  const variableNodes = canvasNodeEntries(canvas, "variable");
  const connections = objectArray(canvas.connections);

  const sourceGroups = groupBy(sources, (s) => normalizedText(s.achievementName).toLocaleLowerCase());
  const canvasGroups = groupBy(achvNodes, (entry) =>
    normalizedText(entry.metadata.achievementName || entry.metadata.title).toLocaleLowerCase()
  );

  const keys = Array.from(new Set([...sourceGroups.keys(), ...canvasGroups.keys()]));

  return keys.map((key) => {
    const sourceMatches = sourceGroups.get(key) || [];
    const canvasMatches = canvasGroups.get(key) || [];
    const source = sourceMatches[0] || null;
    const achvEntry = canvasMatches[0] || null;

    let triggerEntry = null;
    let targetVarEntry = null;

    if (achvEntry) {
      // 업적 노드로 들어오는 트리거 연결선 찾기
      const triggerConn = connections.find(
        (c) => String(c.targetNodeId) === achvEntry.uid && String(c.connectionType) === "trigger"
      );
      if (triggerConn) {
        triggerEntry = triggerNodes.find((t) => t.uid === String(triggerConn.sourceNodeId)) || null;
        if (triggerEntry) {
          // 트리거 노드로 들어오는 변수 연결선 찾기
          const varConn = connections.find(
            (c) => String(c.targetNodeId) === triggerEntry!.uid && String(c.connectionType) === "variable"
          );
          if (varConn) {
            targetVarEntry = variableNodes.find((v) => v.uid === String(varConn.sourceNodeId)) || null;
          }
        }
      }
    }

    const sourceVariable = source
      ? variables.find((variable) =>
        normalizedText(variable.variableName).toLocaleLowerCase("ko-KR")
          === normalizedText(source.targetVariable).toLocaleLowerCase("ko-KR")
      ) ?? null
      : null;
    const conditionBlocks = triggerEntry
      ? objectArray(triggerEntry.metadata.conditionBlocks)
      : [];
    const conditionBlock = conditionBlocks[0] ?? null;
    const expectedCondition = source ? canvasAchievementCondition(source.conditionType) : null;
    const sourceVariableType = sourceVariable?.variableType ?? "";
    const canvasVariableType = normalizedText(conditionBlock?.variableType);
    const canvasConditionType = normalizedText(conditionBlock?.numberCondition);
    const canvasConditionValue = conditionBlockValue(conditionBlock);
    const expectedBooleanValue = sourceVariableType === "boolean" && source
      ? booleanConditionValue(source.conditionValue)
      : null;
    const valueMatches = Boolean(source && sourceVariable && conditionBlock) && (
      sourceVariableType === "number"
        ? Number.isFinite(Number(source!.conditionValue))
          && Number(canvasConditionValue) === Number(source!.conditionValue)
        : sourceVariableType === "boolean"
          ? expectedBooleanValue !== null && canvasConditionValue === expectedBooleanValue
          : normalizedText(canvasConditionValue) === normalizedText(source!.conditionValue)
    );
    const conditionMatches = Boolean(source && sourceVariable && triggerEntry && targetVarEntry && conditionBlock)
      && conditionBlocks.length === 1
      && normalizedText(targetVarEntry!.metadata.variableName).toLocaleLowerCase("ko-KR")
        === normalizedText(source!.targetVariable).toLocaleLowerCase("ko-KR")
      && normalizedText(conditionBlock!.variableNodeUid) === targetVarEntry!.uid
      && normalizedText(conditionBlock!.variableName).toLocaleLowerCase("ko-KR")
        === normalizedText(source!.targetVariable).toLocaleLowerCase("ko-KR")
      && canvasVariableType === sourceVariableType
      && expectedCondition !== null
      && canvasConditionType === expectedCondition
      && valueMatches;

    const nameMatches = Boolean(source && achvEntry)
      && normalizedText(achvEntry!.metadata.achievementName || achvEntry!.metadata.title) === normalizedText(source!.achievementName);
    const descMatches = Boolean(source && achvEntry)
      && normalizedText(achvEntry!.metadata.description) === normalizedText(source!.description);
    const creditsMatch = Boolean(source && achvEntry)
      && Number(achvEntry!.metadata.rewardCredits || 0) === Number(source!.rewardCredits || 0);
    const hiddenMatches = Boolean(source && achvEntry)
      && Boolean(achvEntry!.metadata.isHidden) === Boolean(source!.isHidden);
    const hintMatches = Boolean(source && achvEntry)
      && normalizedText(achvEntry!.metadata.hint) === normalizedText(source!.hint);
    const imageMatches = Boolean(source && achvEntry)
      && normalizedText(achvEntry!.metadata.image) === normalizedText(source!.image);
    const achievementMatches = nameMatches
      && descMatches
      && creditsMatch
      && hiddenMatches
      && hintMatches
      && imageMatches;

    let status: CanvasContentStatus;
    if (sourceMatches.length > 1 || canvasMatches.length > 1) status = "duplicate";
    else if (!source) status = "canvas-only";
    else if (!achvEntry) status = "source-only";
    else status = achievementMatches && conditionMatches ? "exact" : "changed";

    return {
      id: achvEntry?.uid ?? source?.id ?? key,
      name: source?.achievementName
        || normalizedText(achvEntry?.metadata.achievementName || achvEntry?.metadata.title)
        || "(업적명 없음)",
      status,
      achievementMatches,
      conditionMatches,
      source,
      achievementNodeUid: achvEntry?.uid ?? null,
      triggerNodeUid: triggerEntry?.uid ?? null,
      targetVariableNodeUid: targetVarEntry?.uid ?? null,
      targetVariableName: source?.targetVariable || normalizedText(targetVarEntry?.metadata.variableName) || "achv",
      canvasVariableType,
      canvasConditionType,
      canvasConditionValue,
      canvasDescription: normalizedText(achvEntry?.metadata.description),
      canvasCredits: Number(achvEntry?.metadata.rewardCredits || 0),
      canvasIsHidden: Boolean(achvEntry?.metadata.isHidden)
    };
  }).sort((left, right) =>
    left.status.localeCompare(right.status)
    || left.name.localeCompare(right.name, "ko")
  );
}

export function addCanvasAchievementWithTrigger(
  canvas: JsonObject,
  source: RplayAchievement,
  options: {
    targetVariableNodeUid?: string | null;
    startX?: number;
    startY?: number;
    index?: number;
  } = {}
) {
  const next = structuredClone(canvas);
  const achvUid = generatedUid();
  const triggerUid = generatedUid();
  const createdAt = new Date().toISOString();

  const idx = options.index ?? objectArray(next.nodes).length;
  const startX = options.startX ?? 1200;
  const startY = options.startY ?? 350 + idx * 180;

  // 1. 트리거 노드 좌표 & 업적 노드 좌표
  const triggerCoords = { x: startX + 350, y: startY };
  const achvCoords = { x: startX + 720, y: startY };

  // 2. 감시 변수와 캔버스 조건 블록 구성
  const { variableNodeUid, conditionBlock } = achievementConditionBlock(
    next,
    source,
    options.targetVariableNodeUid
  );

  // 3. 노드 추가
  next.nodes = [
    ...objectArray(next.nodes),
    {
      uid: triggerUid,
      hash: shortHash(triggerUid),
      coordinates: triggerCoords,
      name: "trigger-node",
      type: "trigger"
    },
    {
      uid: achvUid,
      hash: shortHash(achvUid),
      coordinates: achvCoords,
      name: "achievement-node",
      type: "achievement"
    }
  ];

  // 4. 메타데이터 추가
  const metadata = metadataSet(next);
  metadata[triggerUid] = {
    conditionBlocks: [
      conditionBlock
    ],
    nodeUid: triggerUid,
    type: "trigger",
    title: `${source.achievementName} 트리거`,
    text: "",
    useTokenBlock: true,
    createdAt,
    updatedAt: createdAt
  };

  metadata[achvUid] = {
    achievementName: source.achievementName,
    description: source.description,
    image: source.image || "",
    rewards: [],
    priority: 0,
    isHidden: Boolean(source.isHidden),
    hint: source.hint || "",
    rewardCredits: Number(source.rewardCredits) || 0,
    nodeUid: achvUid,
    type: "achievement",
    title: source.achievementName,
    text: "",
    useTokenBlock: true,
    createdAt,
    updatedAt: createdAt
  };

  next.metadataSet = metadata;

  // 5. 연결선(connections) 와이어링
  const newConns = [...objectArray(next.connections)];

  // a) 트리거 ➔ 업적 연결
  newConns.push({
    uid: generatedUid(),
    sourceNodeId: triggerUid,
    sourceOutputPortName: "output",
    sourceOutputIndex: 0,
    sourceOutputLabel: "trigger-port",
    sourceOutputRelation: "트리거 출력 포트.",
    targetNodeId: achvUid,
    targetInputPortName: "trigger",
    targetInputIndex: 0,
    targetInputLabel: "trigger-port",
    targetInputRelation: "업적 달성 조건.",
    connectionType: "trigger"
  });

  // b) 변수 ➔ 트리거 연결 (변수 노드가 존재하는 경우)
  newConns.push({
    uid: generatedUid(),
    sourceNodeId: variableNodeUid,
    sourceOutputPortName: "variable",
    sourceOutputIndex: 0,
    sourceOutputLabel: "variable-port",
    sourceOutputRelation: "변수 데이터.",
    targetNodeId: triggerUid,
    targetInputPortName: "variable",
    targetInputIndex: 1,
    targetInputLabel: "variable-port",
    targetInputRelation: "트리거 조건에 사용될 변수.",
    connectionType: "variable"
  });

  next.connections = newConns;
  return next;
}

export function updateCanvasAchievementWithTrigger(
  canvas: JsonObject,
  achievementNodeUid: string,
  source: RplayAchievement,
  updatedAt = new Date().toISOString()
) {
  const next = structuredClone(canvas);
  const metadata = metadataSet(next);
  const achievementMetadata = metadata[achievementNodeUid];
  if (!isJsonObject(achievementMetadata) || achievementMetadata.type !== "achievement") {
    throw new Error(`업적 노드를 찾을 수 없습니다: ${achievementNodeUid}`);
  }

  const { variableNodeUid, conditionBlock } = achievementConditionBlock(next, source);
  let connections = objectArray(next.connections);
  const triggerConnection = connections.find((connection) =>
    normalizedText(connection.targetNodeId) === achievementNodeUid
    && connection.connectionType === "trigger"
  );
  let triggerNodeUid = normalizedText(triggerConnection?.sourceNodeId);

  if (!triggerNodeUid) {
    triggerNodeUid = generatedUid();
    const achievementNode = objectArray(next.nodes)
      .find((node) => normalizedText(node.uid) === achievementNodeUid);
    next.nodes = [
      ...objectArray(next.nodes),
      {
        uid: triggerNodeUid,
        hash: shortHash(triggerNodeUid),
        coordinates: {
          x: numericCoordinate(achievementNode ?? {}, "x") - 370,
          y: numericCoordinate(achievementNode ?? {}, "y")
        },
        name: "trigger-node",
        type: "trigger"
      }
    ];
    connections.push({
      uid: generatedUid(),
      sourceNodeId: triggerNodeUid,
      sourceOutputPortName: "output",
      sourceOutputIndex: 0,
      sourceOutputLabel: "trigger-port",
      sourceOutputRelation: "트리거 출력 포트.",
      targetNodeId: achievementNodeUid,
      targetInputPortName: "trigger",
      targetInputIndex: 0,
      targetInputLabel: "trigger-port",
      targetInputRelation: "업적 달성 조건.",
      connectionType: "trigger"
    });
  }

  const currentTriggerMetadata = metadata[triggerNodeUid];
  metadata[triggerNodeUid] = {
    ...(isJsonObject(currentTriggerMetadata) ? currentTriggerMetadata : {}),
    conditionBlocks: [conditionBlock],
    nodeUid: triggerNodeUid,
    type: "trigger",
    title: `${source.achievementName} 트리거`,
    text: isJsonObject(currentTriggerMetadata) ? currentTriggerMetadata.text ?? "" : "",
    useTokenBlock: true,
    updatedAt
  };
  metadata[achievementNodeUid] = {
    ...achievementMetadata,
    achievementName: source.achievementName,
    description: source.description,
    image: source.image || "",
    rewards: Array.isArray(achievementMetadata.rewards) ? achievementMetadata.rewards : [],
    isHidden: Boolean(source.isHidden),
    hint: source.hint || "",
    rewardCredits: Number(source.rewardCredits) || 0,
    nodeUid: achievementNodeUid,
    type: "achievement",
    title: source.achievementName,
    updatedAt
  };

  connections = connections.filter((connection) => !(
    normalizedText(connection.targetNodeId) === triggerNodeUid
    && connection.connectionType === "variable"
  ));
  connections.push({
    uid: generatedUid(),
    sourceNodeId: variableNodeUid,
    sourceOutputPortName: "variable",
    sourceOutputIndex: 0,
    sourceOutputLabel: "variable-port",
    sourceOutputRelation: "변수 데이터.",
    targetNodeId: triggerNodeUid,
    targetInputPortName: "variable",
    targetInputIndex: 1,
    targetInputLabel: "variable-port",
    targetInputRelation: "트리거 조건에 사용될 변수.",
    connectionType: "variable"
  });

  next.metadataSet = metadata;
  next.connections = connections;
  return next;
}

export function injectAllAchievementsWithTriggers(
  canvas: JsonObject,
  achievements: RplayAchievement[],
  variables: RplayVariable[] = []
) {
  let next = structuredClone(canvas);
  // 기존 변수 노드들 위치 기준으로 업적 배치
  const varNodes = canvasNodeEntries(next, "variable");
  let baseX = 1200;
  let baseY = 300;
  if (varNodes.length > 0) {
    const maxX = Math.max(...varNodes.map((v) => Number((next.nodes as any[])?.find((n: any) => n.uid === v.uid)?.coordinates?.x || 1000)));
    const maxY = Math.max(...varNodes.map((v) => Number((next.nodes as any[])?.find((n: any) => n.uid === v.uid)?.coordinates?.y || 300)));
    baseX = maxX;
    baseY = maxY + 150;
  }

  let addedIndex = 0;
  compareCanvasAchievements(next, achievements, variables).forEach((row) => {
    if (!row.source || row.status === "duplicate" || row.status === "exact") return;
    if (row.status === "changed" && row.achievementNodeUid) {
      next = updateCanvasAchievementWithTrigger(next, row.achievementNodeUid, row.source);
      return;
    }
    if (row.status === "source-only") {
      next = addCanvasAchievementWithTrigger(next, row.source, {
        startX: baseX,
        startY: baseY + addedIndex * 160,
        index: addedIndex
      });
      addedIndex += 1;
    }
  });

  return next;
}
