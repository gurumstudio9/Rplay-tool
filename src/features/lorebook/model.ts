export const lorebookTypeOptions = [
  ["general", "일반"],
  ["command", "명령어"],
  ["mode", "모드"],
  ["instruction", "지침"],
  ["person", "인물"],
  ["person-sub", "인물-서브"],
  ["person-gimmick", "인물-기믹"],
  ["setting", "설정"],
  ["region", "지역"],
  ["region-sub", "지역-서브"],
  ["faction", "세력"],
  ["item", "물건"],
  ["gimmick", "기믹"],
  ["other", "기타"]
] as const;

export type LorebookType = typeof lorebookTypeOptions[number][0];

export type LorebookEntry = {
  id: string;
  fileName: string;
  sourceFileName: string;
  no: string;
  type: LorebookType;
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
  migrateBodyToMarkdown: boolean;
  [key: string]: unknown;
};

export type LorebookState = {
  bodyLimit: number;
  entries: LorebookEntry[];
  collectionRevision: string;
  invalidJsonFiles: string[];
  [key: string]: unknown;
};

export type LorebookSortField =
  | "no"
  | "updatedAt"
  | "type"
  | "title"
  | "triggers"
  | "count";

export const lorebookTitleLimit = 20;
export const lorebookTriggerLimit = 5;
export const lorebookBodyStorage = "sidecar-md-v1";
export const lorebookUnlimitedBodyLimit = Number.MAX_SAFE_INTEGER;

export function lorebookDefaultBodyLimit(workId = "") {
  return String(workId).split("::").at(-1) === "에덴"
    ? lorebookUnlimitedBodyLimit
    : 500;
}

export function lorebookBodyLimitLabel(limit: number) {
  return limit >= lorebookUnlimitedBodyLimit ? "무제한" : String(limit);
}

const typePrefixes: Record<LorebookType, string> = {
  command: "A",
  mode: "A",
  instruction: "AA",
  person: "B",
  "person-sub": "C",
  "person-gimmick": "D",
  setting: "E",
  region: "F",
  "region-sub": "G",
  faction: "GA",
  item: "GB",
  gimmick: "H",
  general: "I",
  other: "J"
};

const typeRank = new Map(
  [
    "command",
    "mode",
    "instruction",
    "person",
    "person-sub",
    "person-gimmick",
    "setting",
    "region",
    "region-sub",
    "faction",
    "item",
    "gimmick",
    "general",
    "other"
  ].map((type, index) => [type, index])
);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
function text(value: unknown) {
  return String(value ?? "").trim();
}

export function cloneLorebookState(state: LorebookState): LorebookState {
  return structuredClone(state);
}

export function makeLorebookId(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ko-KR")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || `entry-${Date.now()}`;
}

export function normalizeLorebookType(value: unknown): LorebookType {
  const candidate = text(value || "general");
  return lorebookTypeOptions.some(([id]) => id === candidate)
    ? candidate as LorebookType
    : "general";
}

export function lorebookTypeLabel(value: unknown) {
  const type = normalizeLorebookType(value);
  return lorebookTypeOptions.find(([id]) => id === type)?.[1] ?? "일반";
}

export function normalizeLorebookTriggers(value: unknown): string[] {
  const values = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(
    values
      .map((item) => String(item).normalize("NFC").replace(/\s+/g, ""))
      .filter(Boolean)
  )];
}

export function normalizeLorebookBody(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+$/g, "");
}

export function lorebookBodyFileName(fileName: unknown) {
  return `${String(fileName || "entry.json").replace(/\.json$/i, "")}.md`;
}

function normalizeFileName(value: unknown, fallbackId: string) {
  const candidate = text(value || `${fallbackId}.json`);
  return candidate.toLocaleLowerCase().endsWith(".json")
    ? `${candidate.slice(0, -5)}.json`
    : `${candidate}.json`;
}

export function reassignLorebookNumbers(entries: LorebookEntry[]) {
  const counters = new Map<string, number>();
  return entries.map((entry) => {
    const prefix = typePrefixes[entry.type] || "I";
    const count = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, count);
    return {
      ...entry,
      no: `${prefix}${String(count).padStart(4, "0")}`
    };
  });
}

export function normalizeLorebookEntry(
  value: unknown,
  index = 0
): LorebookEntry {
  const source = record(value);
  const rawFileName = text(source.fileName || source.sourceFileName);
  const fileId = rawFileName.replace(/\.json$/i, "");
  const id = text(source.id || fileId || makeLorebookId(source.title || "entry"));
  const fileName = `${id}.json`;
  const bodyFileName = lorebookBodyFileName(fileName);
  const paired = source.bodyStorage === lorebookBodyStorage;
  return {
    ...source,
    id,
    fileName,
    sourceFileName: normalizeFileName(
      source.sourceFileName || source.fileName || fileName,
      id
    ),
    no: text(source.no || index + 1),
    type: normalizeLorebookType(source.type),
    title: text(source.title),
    triggers: normalizeLorebookTriggers(source.triggers),
    body: normalizeLorebookBody(source.body),
    updatedAt: text(source.updatedAt),
    bodyStorage: paired ? lorebookBodyStorage : "legacy-json",
    bodyFileName,
    sourceBodyFileName: text(
      source.sourceBodyFileName || source.bodyFileName || bodyFileName
    ),
    bodySource: text(source.bodySource || (paired ? "markdown" : "legacy-json")),
    bodyStatus: text(source.bodyStatus || (paired ? "new-md" : "legacy")),
    bodyRevision: text(source.bodyRevision),
    bodyModifiedAt: text(source.bodyModifiedAt),
    migrateBodyToMarkdown: source.migrateBodyToMarkdown === true
  };
}

export function normalizeLorebookState(
  value: unknown,
  defaultBodyLimit = 500
): LorebookState {
  const source = record(value);
  const entries = Array.isArray(source.entries)
    ? source.entries.map(normalizeLorebookEntry)
    : [];
  const ordered = entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftRank = typeRank.get(left.entry.type) ?? 999;
      const rightRank = typeRank.get(right.entry.type) ?? 999;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ entry }) => entry);
  return {
    ...source,
    bodyLimit: Math.max(1, Number(source.bodyLimit ?? defaultBodyLimit)),
    entries: reassignLorebookNumbers(ordered),
    collectionRevision: text(source.collectionRevision),
    invalidJsonFiles: Array.isArray(source.invalidJsonFiles)
      ? source.invalidJsonFiles.map(text).filter(Boolean)
      : []
  };
}

export function blankLorebookEntry(entries: LorebookEntry[]) {
  let id = makeLorebookId("새 항목");
  let suffix = 2;
  while (entries.some((entry) => entry.id === id)) {
    id = `${makeLorebookId("새 항목")}-${suffix++}`;
  }
  return normalizeLorebookEntry({
    id,
    fileName: `${id}.json`,
    sourceFileName: "",
    type: "general",
    title: "",
    triggers: [],
    body: "",
    updatedAt: new Date().toISOString(),
    bodyStorage: lorebookBodyStorage,
    bodySource: "markdown",
    bodyStatus: "new-md"
  }, entries.length);
}

export function lorebookBodyUnavailable(entry: LorebookEntry) {
  return entry.bodyStorage === lorebookBodyStorage
    && ["missing-md", "unreadable-md", "invalid-body-file"].includes(
      entry.bodyStatus
    );
}

export function lorebookBodyState(entry: LorebookEntry) {
  if (entry.migrateBodyToMarkdown) return { label: "MD 분리 예정", tone: "pending" };
  if (entry.bodyStorage === lorebookBodyStorage) {
    if (entry.bodyStatus === "new-md") return { label: "새 MD", tone: "pending" };
    if (entry.bodyStatus === "missing-md") return { label: "MD 없음", tone: "error" };
    if (entry.bodyStatus === "unreadable-md") return { label: "MD 읽기 오류", tone: "error" };
    if (entry.bodyStatus === "invalid-body-file") return { label: "MD 연결 오류", tone: "error" };
    return { label: "MD", tone: "ready" };
  }
  if (entry.bodyStatus === "unlinked-md") {
    return { label: "JSON · 미연결 MD", tone: "error" };
  }
  return { label: "JSON 본문", tone: "legacy" };
}

export function lorebookIdentityErrors(entries: LorebookEntry[]) {
  const errors: Array<{ entryId: string; field: "id" | "fileName"; message: string }> = [];
  const ids = new Set<string>();
  const fileNames = new Set<string>();
  entries.forEach((entry) => {
    const idKey = entry.id.toLocaleLowerCase();
    const fileKey = entry.fileName.toLocaleLowerCase();
    if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u.test(entry.id)) {
      errors.push({ entryId: entry.id, field: "id", message: `ID 형식 오류: ${entry.id || "빈 ID"}` });
    } else if (ids.has(idKey)) {
      errors.push({ entryId: entry.id, field: "id", message: `중복 ID: ${entry.id}` });
    } else {
      ids.add(idKey);
    }

    const baseName = entry.fileName.replace(/\.json$/i, "");
    const validFile = Boolean(baseName)
      && entry.fileName.toLocaleLowerCase().endsWith(".json")
      && entry.fileName.length <= 240
      && !entry.fileName.includes("..")
      && !/[<>:"/\\|?*\x00-\x1f]/.test(entry.fileName)
      && !/[. ]$/.test(baseName)
      && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(baseName);
    if (!validFile) {
      errors.push({ entryId: entry.id, field: "fileName", message: `파일명 형식 오류: ${entry.fileName || "빈 파일명"}` });
    } else if (fileNames.has(fileKey)) {
      errors.push({ entryId: entry.id, field: "fileName", message: `중복 파일명: ${entry.fileName}` });
    } else {
      fileNames.add(fileKey);
    }
  });
  return errors;
}

export function formatLorebookEntry(entry: LorebookEntry) {
  return `# [${lorebookTypeLabel(entry.type)}] ${stripLorebookAnchor(entry.title)}\n${entry.triggers.join(", ")}\n\n${entry.body}`;
}

export function stripLorebookAnchor(value: unknown) {
  return String(value ?? "").replace(/^\s*\[[^\]]+\]\s*/, "").trim();
}

export function portableLorebookState(state: LorebookState) {
  return {
    bodyLimit: state.bodyLimit,
    entries: state.entries.map((entry) => {
      const portable = { ...entry };
      [
        "sourceFileName",
        "bodyStorage",
        "bodyFile",
        "bodyFileName",
        "sourceBodyFileName",
        "bodySource",
        "bodyStatus",
        "bodyRevision",
        "bodyModifiedAt",
        "migrateBodyToMarkdown"
      ].forEach((field) => delete portable[field]);
      return portable;
    })
  };
}
