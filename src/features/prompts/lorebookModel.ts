export const promptLorebookTypes = [
  ["all", "타입 전체"],
  ["general", "일반"],
  ["command", "명령어"],
  ["person", "인물"],
  ["person-sub", "인물-서브"],
  ["person-gimmick", "인물-기믹"],
  ["setting", "설정"],
  ["region", "지역"],
  ["region-sub", "지역-서브"],
  ["gimmick", "기믹"],
  ["other", "기타"]
] as const;

export type PromptLorebookEntry = {
  id: string;
  fileName: string;
  sourceFileName: string;
  no: number;
  type: string;
  title: string;
  triggers: string[];
  body: string;
  updatedAt: string;
  bodyStorage: string;
  bodyFileName: string;
  sourceBodyFileName: string;
  bodySource: string;
  bodyStatus: string;
  bodyRevision: string;
  bodyModifiedAt: string;
  [key: string]: unknown;
};

export type PromptLorebookState = {
  entries: PromptLorebookEntry[];
  collectionRevision: string;
  invalidJsonFiles: string[];
  [key: string]: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function bodyText(value: unknown) {
  return String(value ?? "").replace(/\r\n?/g, "\n").replace(/\n+$/g, "");
}

function bodyFileName(fileName: string) {
  return `${fileName.replace(/\.json$/i, "")}.md`;
}

export function normalizePromptLorebookEntry(
  value: unknown,
  index = 0
): PromptLorebookEntry {
  const source = record(value);
  const id = text(source.id || `entry-${index + 1}`);
  const fileName = text(source.fileName || `${id}.json`);
  const paired = source.bodyStorage === "sidecar-md-v1";
  const triggers = Array.isArray(source.triggers)
    ? source.triggers.map(text).filter(Boolean)
    : text(source.triggers).split(",").map(text).filter(Boolean);
  return {
    ...source,
    id,
    fileName,
    sourceFileName: text(source.sourceFileName || fileName),
    no: Math.max(1, Number(source.no || index + 1)),
    type: text(source.type || "general"),
    title: text(source.title),
    triggers,
    body: bodyText(source.body),
    updatedAt: text(source.updatedAt),
    bodyStorage: paired ? "sidecar-md-v1" : "legacy-json",
    bodyFileName: bodyFileName(fileName),
    sourceBodyFileName: text(
      source.sourceBodyFileName || source.bodyFileName || bodyFileName(fileName)
    ),
    bodySource: text(source.bodySource || (paired ? "markdown" : "legacy-json")),
    bodyStatus: text(source.bodyStatus || (paired ? "new-md" : "legacy")),
    bodyRevision: text(source.bodyRevision),
    bodyModifiedAt: text(source.bodyModifiedAt)
  };
}

export function normalizePromptLorebookState(
  value: unknown
): PromptLorebookState {
  const source = record(value);
  const entries = Array.isArray(source.entries)
    ? source.entries.map(normalizePromptLorebookEntry)
    : [];
  return {
    ...source,
    entries,
    collectionRevision: text(source.collectionRevision),
    invalidJsonFiles: Array.isArray(source.invalidJsonFiles)
      ? source.invalidJsonFiles.map(text).filter(Boolean)
      : []
  };
}

export function promptLorebookTypeLabel(type: string) {
  return promptLorebookTypes.find(([id]) => id === type)?.[1] ?? "일반";
}

export function promptLorebookBodyUnavailable(
  entry: PromptLorebookEntry | null
) {
  return entry?.bodyStorage === "sidecar-md-v1"
    && ["missing-md", "unreadable-md", "invalid-body-file"].includes(
      entry.bodyStatus
    );
}

export function promptLorebookBodyLabel(entry: PromptLorebookEntry) {
  if (entry.bodyStorage !== "sidecar-md-v1") {
    return entry.bodyStatus === "unlinked-md" ? "JSON · MD 미연결" : "JSON 본문";
  }
  if (entry.bodyStatus === "missing-md") return "MD 없음";
  if (entry.bodyStatus === "unreadable-md") return "MD 오류";
  if (entry.bodyStatus === "invalid-body-file") return "MD 연결 오류";
  if (entry.bodyStatus === "new-md") return "새 MD";
  return "MD";
}

export function blankPromptLorebookEntry(
  entries: PromptLorebookEntry[]
): PromptLorebookEntry {
  const id = `entry-${Date.now()}`;
  return normalizePromptLorebookEntry({
    id,
    fileName: `${id}.json`,
    sourceFileName: "",
    no: entries.reduce(
      (maximum, entry) => Math.max(maximum, Number(entry.no || 0)),
      0
    ) + 1,
    type: "general",
    title: "",
    triggers: [],
    body: "",
    updatedAt: new Date().toISOString(),
    bodyStorage: "sidecar-md-v1",
    bodySource: "markdown",
    bodyStatus: "new-md"
  }, entries.length);
}
