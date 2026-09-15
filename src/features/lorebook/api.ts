import { readStorage } from "../../api/storage";
import {
  lorebookDefaultBodyLimit,
  normalizeLorebookState,
  type LorebookState
} from "./model";

const lorebookStorageKey = "character-lorebook-manager-v1";

export async function loadLorebook(workId: string, signal?: AbortSignal) {
  const stored = await readStorage<unknown>(
    lorebookStorageKey,
    workId,
    { entries: [] },
    signal
  );
  return normalizeLorebookState(stored, lorebookDefaultBodyLimit(workId));
}

export async function saveLorebook(workId: string, state: LorebookState) {
  const key = encodeURIComponent(`${lorebookStorageKey}::${workId}`);
  const response = await fetch(`/api/storage?key=${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: state })
  });
  const payload = await response.json() as {
    error?: string;
    value?: unknown;
  };
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "로어북을 저장하지 못했습니다.");
  }
  return normalizeLorebookState(
    payload.value || state,
    lorebookDefaultBodyLimit(workId)
  );
}
