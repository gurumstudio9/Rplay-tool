export type PromptTab =
  | "worldStory"
  | "mainPrompt"
  | "additionalPrompt"
  | "starterPrompt"
  | "starterMessage"
  | "suggestedReplies"
  | "variables"
  | "achievements";

export type PromptTextTab = Exclude<PromptTab, "suggestedReplies" | "variables" | "achievements">;

export type RplayVariableType = "string" | "number" | "boolean";

export interface RplayVariable {
  id: string;
  type?: "variable";
  title: string;
  variableName: string;
  variableType: RplayVariableType;
  initValue: string | number | boolean;
}

export interface RplayUpdateRule {
  id: string;
  type?: "updateRule";
  fileName?: string;
  title: string;
  text: string;
  variables: string[];
}

export interface RplayAchievement {
  id: string;
  achievementName: string;
  description: string;
  targetVariable: string;
  conditionType:
    | "equal"
    | "above"
    | "below"
    | "not_equal"
    | "greater"
    | "greater_equal"
    | "less"
    | "less_equal";
  conditionValue: string;
  rewardCredits: number;
  isHidden: boolean;
  hint: string;
  image: string;
}

export interface RplayVariablesData {
  variables: RplayVariable[];
}

export type PromptNodeType = "start" | "normal";

export type PromptVersion = {
  nodeType: PromptNodeType;
  worldStory: string;
  id: string;
  name: string;
  additionalPrompt: string;
  starterPrompt: string;
  starterMessage: string;
  suggestedReplies: [string, string, string];
  notes: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type PromptState = {
  mainPrompt: string;
  worldStory: string;
  edenImageBaseUrl: string;
  versions: PromptVersion[];
  activeVersionId: string;
  [key: string]: unknown;
};

export type PromptDiffLine = {
  type: "same" | "add" | "remove";
  prefix: " " | "+" | "-";
  text: string;
};

export const promptTabLabels: Record<PromptTab, string> = {
  worldStory: "월드스토리",
  mainPrompt: "메인 프롬프트",
  additionalPrompt: "추가 프롬프트",
  starterPrompt: "시작 프롬프트",
  starterMessage: "시작 메시지",
  suggestedReplies: "추천 답변",
  variables: "변수 관리 (알플레이)",
  achievements: "업적 관리 (알플레이)"
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function bodyText(value: unknown) {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function labelText(value: unknown) {
  return bodyText(value).trim();
}

export function normalizeRplayAchievements(value: unknown): RplayAchievement[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const source = record(item);
    const conditionType = labelText(source.conditionType);
    return {
      ...source,
      conditionType: conditionType === "above" || conditionType === "greater" || conditionType === "greater_equal"
        ? "above"
        : conditionType === "below" || conditionType === "less" || conditionType === "less_equal"
          ? "below"
          : conditionType === "not_equal"
            ? "not_equal"
            : "equal"
    } as RplayAchievement;
  });
}

export function promptId(value: unknown) {
  return labelText(value)
    .toLocaleLowerCase("ko-KR")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || `version-${Date.now()}`;
}

export function normalizePromptVersion(
  value: unknown,
  index = 0
): PromptVersion {
  const source = record(value);
  const replies = Array.isArray(source.suggestedReplies)
    ? source.suggestedReplies
    : [];
  return {
    ...source,
    nodeType: source.nodeType === "normal" ? "normal" : source.nodeType === "start" || source.starterPrompt || source.starterMessage || index === 0 ? "start" : "normal",
    worldStory: bodyText(source.worldStory),
    id: labelText(source.id || `version-${index + 1}`),
    name: labelText(source.name || `v${index + 1}`),
    additionalPrompt: bodyText(source.additionalPrompt),
    starterPrompt: bodyText(source.starterPrompt),
    starterMessage: bodyText(source.starterMessage),
    suggestedReplies: [
      bodyText(replies[0]),
      bodyText(replies[1]),
      bodyText(replies[2])
    ],
    notes: bodyText(source.notes).trim(),
    updatedAt: labelText(source.updatedAt)
  };
}

export function normalizePromptState(value: unknown): PromptState {
  const source = record(value);
  const rawVersions = Array.isArray(source.versions)
    ? source.versions
    : Array.isArray(source.blocks)
      ? source.blocks
      : [];
  const versions = rawVersions.map((version, index) => normalizePromptVersion({
    ...record(version),
    worldStory: typeof record(version).worldStory === "string" ? record(version).worldStory : source.worldStory
  }, index));
  const requestedActive = labelText(source.activeVersionId);
  return {
    ...source,
    mainPrompt: bodyText(source.mainPrompt),
    worldStory: bodyText(source.worldStory),
    edenImageBaseUrl: normalizeEdenImageBaseUrl(source.edenImageBaseUrl),
    versions,
    activeVersionId: versions.some((version) => version.id === requestedActive)
      ? requestedActive
      : versions[0]?.id ?? ""
  };
}

export function blankPromptVersion(): PromptVersion {
  return {
    nodeType: "start",
    worldStory: "",
    id: "",
    name: "",
    additionalPrompt: "",
    starterPrompt: "",
    starterMessage: "",
    suggestedReplies: ["", "", ""],
    notes: "",
    updatedAt: ""
  };
}

export function uniquePromptId(state: PromptState, name: string) {
  const base = promptId(name);
  let id = base;
  let suffix = 2;
  while (state.versions.some((version) => version.id === id)) {
    id = `${base}-${suffix++}`;
  }
  return id;
}

export function activePromptVersion(state: PromptState) {
  return state.versions.find(
    (version) => version.id === state.activeVersionId
  ) ?? state.versions[0] ?? null;
}

export function promptTextForTab(
  state: PromptState,
  tab: PromptTab,
  version = activePromptVersion(state)
): string {
  if (tab === "mainPrompt") return state.mainPrompt;
  if (tab === "suggestedReplies") {
    return version?.suggestedReplies.join("\n\n") ?? "";
  }
  if (tab === "variables" || tab === "achievements") return "";
  const value = version ? version[tab as keyof PromptVersion] : "";
  return typeof value === "string" ? value : "";
}

export function versionPreviewTab(tab: PromptTab): Exclude<
  PromptTab,
  "mainPrompt" | "suggestedReplies" | "variables" | "achievements"
> | "additionalPrompt" {
  if (tab === "mainPrompt" || tab === "suggestedReplies" || tab === "variables" || tab === "achievements") {
    return "worldStory";
  }
  return tab as Exclude<PromptTab, "mainPrompt" | "suggestedReplies" | "variables" | "achievements">;
}

export function buildPromptLineDiff(
  leftText: string,
  rightText: string
): PromptDiffLine[] {
  const leftLines = bodyText(leftText).split("\n");
  const rightLines = bodyText(rightText).split("\n");
  const rows: PromptDiffLine[] = [];
  const count = Math.max(leftLines.length, rightLines.length);
  for (let index = 0; index < count; index += 1) {
    const left = leftLines[index] ?? "";
    const right = rightLines[index] ?? "";
    if (left === right) {
      rows.push({ type: "same", prefix: " ", text: left });
    } else {
      if (left) rows.push({ type: "remove", prefix: "-", text: left });
      if (right) rows.push({ type: "add", prefix: "+", text: right });
    }
  }
  return rows;
}

export function normalizeEdenImageBaseUrl(value: unknown) {
  const trimmed = labelText(value);
  return trimmed.replace(/\/+$/, "");
}

export function convertStarterMessageForEden(
  starterMessage: string,
  imageBaseUrl: string,
  _versionName = ""
) {
  const normalizedBase = normalizeEdenImageBaseUrl(imageBaseUrl);
  return String(starterMessage || "").replace(
    /\{\{url\}\}([^\s)]+)/gi,
    (_, imagePath) => {
      const trimmedPath = String(imagePath || "").replace(/^\/+/, "");
      return normalizedBase ? `${normalizedBase}/${trimmedPath}` : trimmedPath;
    }
  );
}

export function promptTabsForNode(nodeType: PromptNodeType): PromptTab[] {
  return nodeType === "start"
    ? ["mainPrompt", "worldStory", "starterPrompt", "starterMessage"]
    : ["mainPrompt", "worldStory"];
}
