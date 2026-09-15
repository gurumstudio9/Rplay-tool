import {
  lorebookTypeLabel,
  type LorebookEntry,
  type LorebookSortField,
  type LorebookType
} from "./model";

export function matchesLorebookEntry(
  entry: LorebookEntry,
  query: string,
  typeFilter: "all" | LorebookType
) {
  if (typeFilter !== "all" && entry.type !== typeFilter) return false;
  const needle = query.trim().toLocaleLowerCase("ko-KR");
  if (!needle) return true;
  return [
    entry.id,
    entry.fileName,
    entry.bodyFileName,
    lorebookTypeLabel(entry.type),
    entry.title,
    entry.body,
    ...entry.triggers
  ].join(" ").toLocaleLowerCase("ko-KR").includes(needle);
}

function sortValue(entry: LorebookEntry, field: LorebookSortField) {
  if (field === "count") return entry.body.length;
  if (field === "triggers") return entry.triggers.join(", ");
  if (field === "type") return lorebookTypeLabel(entry.type);
  return entry[field] || "";
}

export function filterAndSortLorebookEntries(
  entries: LorebookEntry[],
  query: string,
  typeFilter: "all" | LorebookType,
  sortField: LorebookSortField,
  sortDirection: "asc" | "desc"
) {
  return entries
    .filter((entry) => matchesLorebookEntry(entry, query, typeFilter))
    .sort((left, right) => {
      const leftValue = sortValue(left, sortField);
      const rightValue = sortValue(right, sortField);
      const comparison = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), "ko-KR");
      return sortDirection === "asc" ? comparison : -comparison;
    });
}
