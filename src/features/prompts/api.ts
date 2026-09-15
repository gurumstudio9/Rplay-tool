import { readStorage, writeStorage } from "../../api/storage";
import {
  normalizePromptState,
  normalizeRplayAchievements,
  type PromptState,
  type RplayAchievement,
  type RplayUpdateRule,
  type RplayVariablesData
} from "./model";

const promptStorageKey = "character-prompt-manager-v1";
const rplayVariablesStorageKey = "character-rplay-variables-v1";

export async function loadPromptState(
  workId: string,
  signal?: AbortSignal
) {
  const stored = await readStorage<unknown>(
    promptStorageKey,
    workId,
    { versions: [], activeVersionId: "" },
    signal
  );
  return normalizePromptState(stored);
}

export async function savePromptState(
  workId: string,
  state: PromptState
) {
  await writeStorage(promptStorageKey, workId, state);
}

export async function loadRplayVariables(
  workId: string,
  signal?: AbortSignal
): Promise<RplayVariablesData> {
  const stored = await readStorage<RplayVariablesData>(
    rplayVariablesStorageKey,
    workId,
    { variables: [] },
    signal
  );
  return {
    variables: Array.isArray(stored?.variables)
      ? stored.variables.map((variable) => {
        const { rules: _legacyRules, ...cleanVariable } = variable as RplayVariableDataWithLegacyRules;
        return cleanVariable;
      })
      : []
  };
}

type RplayVariableDataWithLegacyRules = RplayVariablesData["variables"][number] & {
  rules?: unknown;
};

export async function saveRplayVariables(
  workId: string,
  data: RplayVariablesData
) {
  await writeStorage(rplayVariablesStorageKey, workId, data);
}

export async function loadRplayUpdateRules(
  workId: string,
  signal?: AbortSignal
): Promise<RplayUpdateRule[]> {
  const response = await fetch(`/api/update-rules?workId=${encodeURIComponent(workId)}`, { signal });
  if (!response.ok) throw new Error("업데이트 규칙 MD 목록을 불러오지 못했습니다.");
  const payload = await response.json() as { rules?: unknown };
  return Array.isArray(payload.rules)
    ? payload.rules.flatMap((rule) => {
      if (!rule || typeof rule !== "object") return [];
      const candidate = rule as RplayUpdateRule;
      if (typeof candidate.title !== "string" || typeof candidate.text !== "string") return [];
      return [{
        ...candidate,
        variables: Array.isArray(candidate.variables)
          ? candidate.variables.filter((variable): variable is string => typeof variable === "string")
          : []
      }];
    })
    : [];
}

export async function saveRplayUpdateRules(
  workId: string,
  rules: RplayUpdateRule[]
) {
  const response = await fetch("/api/update-rules", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workId, rules })
  });
  if (!response.ok) throw new Error("업데이트 규칙 MD 목록을 저장하지 못했습니다.");
}

export async function loadRplayAchievements(
  workId: string,
  signal?: AbortSignal
): Promise<RplayAchievement[]> {
  try {
    const res = await fetch(`/api/achievements?workId=${encodeURIComponent(workId)}`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return normalizeRplayAchievements(data.achievements);
  } catch {
    return [];
  }
}

export async function saveRplayAchievements(
  workId: string,
  achievements: RplayAchievement[]
): Promise<boolean> {
  try {
    const res = await fetch("/api/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId, achievements: normalizeRplayAchievements(achievements) })
    });
    return res.ok;
  } catch {
    return false;
  }
}
