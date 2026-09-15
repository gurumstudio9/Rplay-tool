import { readStorage, writeStorage } from "../../api/storage";
import { loadLorebook } from "../lorebook/api";
import { loadCharacters } from "../settings/api";
import { loadPromptState, loadRplayUpdateRules } from "../prompts/api";
import { emptyHubData, parseHubData, type HubCatalog, type HubData } from "./model";

const storageKey = "rplay-hubs-v1";
export async function loadHubData(workKey: string, signal?: AbortSignal) {
  return parseHubData(await readStorage(storageKey, workKey, emptyHubData, signal));
}
export async function saveHubData(workKey: string, data: HubData) {
  await writeStorage(storageKey, workKey, parseHubData(data));
}
export async function loadHubCatalog(workKey: string, signal?: AbortSignal): Promise<HubCatalog> {
  const [lorebook, characters, rules, prompts] = await Promise.all([
    loadLorebook(workKey, signal), loadCharacters(workKey, signal),
    loadRplayUpdateRules(workKey, signal), loadPromptState(workKey, signal)
  ]);
  return {
    lorebook: lorebook.entries.map((entry) => ({ id: entry.id, name: entry.title, category: entry.type, detail: entry.triggers.join(", ") })),
    character: characters.map((entry) => ({ id: entry.id, name: entry.name })),
    // File IDs are generated from sorting order by the current rules API; use the saved filename instead.
    updateRule: rules.map((entry) => ({ id: entry.fileName || `legacy:${entry.title}`, name: entry.title })),
    story: prompts.versions.map((entry) => ({ id: entry.id, name: entry.name, category: entry.nodeType, detail: entry.nodeType === "start" ? "시작 노드" : "일반 노드" }))
  };
}
