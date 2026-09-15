import {
  lorebookBodyFileName,
  lorebookTitleLimit,
  normalizeLorebookBody,
  normalizeLorebookTriggers,
  normalizeLorebookType,
  reassignLorebookNumbers,
  type LorebookEntry,
  type LorebookType
} from "./model";

export function updateLorebookEntry(
  entries: LorebookEntry[],
  previousId: string,
  patch: Partial<LorebookEntry>
) {
  const updatedAt = new Date().toISOString();
  return reassignLorebookNumbers(entries.map((entry) => {
    if (entry.id !== previousId) return entry;
    const nextId = patch.id === undefined ? previousId : String(patch.id).trim();
    return {
      ...entry,
      ...patch,
      id: nextId,
      fileName: `${nextId}.json`,
      bodyFileName: lorebookBodyFileName(`${nextId}.json`),
      type: patch.type === undefined
        ? entry.type
        : normalizeLorebookType(patch.type),
      title: patch.title === undefined
        ? entry.title
        : String(patch.title).trimStart(),
      triggers: patch.triggers === undefined
        ? entry.triggers
        : patch.triggers,
      body: patch.body === undefined
        ? entry.body
        : normalizeLorebookBody(patch.body),
      updatedAt
    };
  }));
}

export function swapLorebookEntries(
  entries: LorebookEntry[],
  entryId: string,
  targetId: string
) {
  const next = [...entries];
  const from = next.findIndex((entry) => entry.id === entryId);
  const to = next.findIndex((entry) => entry.id === targetId);
  if (from < 0 || to < 0 || from === to) return entries;
  [next[from], next[to]] = [next[to], next[from]];
  return reassignLorebookNumbers(next);
}

export function moveLorebookEntryToOrder(
  entries: LorebookEntry[],
  entryId: string,
  value: number
) {
  const next = [...entries];
  const from = next.findIndex((entry) => entry.id === entryId);
  const to = Math.max(0, Math.min(next.length - 1, value - 1));
  if (from < 0 || from === to) return entries;
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry);
  return reassignLorebookNumbers(next);
}

export function applyLorebookBulkType(
  entries: LorebookEntry[],
  selectedIds: Set<string>,
  type: LorebookType
) {
  const nextType = normalizeLorebookType(type);
  const updatedAt = new Date().toISOString();
  return reassignLorebookNumbers(entries.map((entry) =>
    selectedIds.has(entry.id)
      ? { ...entry, type: nextType, updatedAt }
      : entry
  ));
}

export function prepareLorebookEntriesForSave(entries: LorebookEntry[]) {
  return reassignLorebookNumbers(
    entries
      .map((entry) => ({
        ...entry,
        title: entry.title.trim().slice(0, lorebookTitleLimit).trimEnd(),
        triggers: normalizeLorebookTriggers(entry.triggers),
        fileName: `${entry.id}.json`,
        bodyFileName: lorebookBodyFileName(`${entry.id}.json`)
      }))
      .filter((entry) =>
        entry.sourceFileName || entry.title || entry.body || entry.triggers.length
      )
  );
}
