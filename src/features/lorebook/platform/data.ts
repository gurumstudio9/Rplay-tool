import { rplayLorebookPriority } from "../model";
import { normalizeLorebookTriggers, type LorebookEntry } from "../model";

export type SimpleLorebookData = {
  id: string;
  title: string;
  matchTitles?: string[];
  triggers: string[];
  body: string;
  type?: string;
  priority?: number;
};

export function buildRplayData(entries: LorebookEntry[], bodyLimit: number) {
  return entries.map((entry): SimpleLorebookData => ({
    id: entry.id,
    title: entry.title.trim().slice(0, 20),
    triggers: normalizeLorebookTriggers(entry.triggers),
    body: entry.body.slice(0, bodyLimit),
    priority: rplayLorebookPriority(entry),
    type: entry.type
  }));
}
