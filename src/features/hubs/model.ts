export const inputTypes = ["lorebook", "character", "updateRule"] as const;
export type HubInputType = typeof inputTypes[number];
export type HubDirection = "in" | "out";
export const inputLabels: Record<HubInputType, string> = { lorebook: "로어북", character: "인물", updateRule: "업데이트 규칙" };
export type HubRecord = { id: string; name: string; inputs: Record<HubInputType, string[]>; outputs: { story: string[] } };
export type HubData = { version: 1; hubs: HubRecord[] };
export type HubTarget = { id: string; name: string; detail?: string; category?: string; missing?: boolean };
export type HubCatalog = Record<HubInputType | "story", HubTarget[]>;
export const emptyHubData: HubData = { version: 1, hubs: [] };

export function createHub(name: string): HubRecord {
  if (!name.trim()) throw new Error("허브 이름을 입력해 주세요.");
  return { id: crypto.randomUUID(), name: name.trim(), inputs: { lorebook: [], character: [], updateRule: [] }, outputs: { story: [] } };
}

export function parseHubData(value: unknown): HubData {
  const data = value as HubData;
  if (!data || data.version !== 1 || !Array.isArray(data.hubs)) throw new Error("허브 데이터 형식을 확인해 주세요.");
  const ids = new Set<string>();
  for (const hub of data.hubs) {
    if (!hub || typeof hub.id !== "string" || !hub.id || ids.has(hub.id) || typeof hub.name !== "string" || !hub.name.trim()) throw new Error("허브 이름 또는 ID가 올바르지 않습니다.");
    ids.add(hub.id);
    for (const refs of [...inputTypes.map((type) => hub.inputs?.[type]), hub.outputs?.story]) {
      if (!Array.isArray(refs) || refs.some((id) => typeof id !== "string" || !id) || new Set(refs).size !== refs.length) throw new Error("허브 연결 대상 목록이 올바르지 않습니다.");
    }
  }
  return data;
}

export function hubSelection(hub: HubRecord, direction: HubDirection, type: HubInputType): string[] {
  return direction === "out" ? hub.outputs.story : hub.inputs[type];
}

export function setHubTargets(hub: HubRecord, direction: HubDirection, type: HubInputType, ids: string[], checked: boolean): HubRecord {
  const selected = new Set(hubSelection(hub, direction, type));
  ids.forEach((id) => checked ? selected.add(id) : selected.delete(id));
  return direction === "out"
    ? { ...hub, outputs: { ...hub.outputs, story: [...selected] } }
    : { ...hub, inputs: { ...hub.inputs, [type]: [...selected] } };
}

export function targetsWithMissing(targets: HubTarget[], selected: string[]): HubTarget[] {
  const known = new Set(targets.map((target) => target.id));
  return [...targets, ...selected.filter((id) => !known.has(id)).map((id) => ({ id, name: id, detail: "원본 없음 · 체크를 해제하면 연결 목록에서 제외됩니다.", missing: true }))];
}
