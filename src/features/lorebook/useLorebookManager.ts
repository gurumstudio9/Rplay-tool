import {
  useEffect,
  useMemo,
  useState
} from "react";
import { saveLorebook } from "./api";
import {
  applyLorebookBulkType,
  moveLorebookEntryToOrder,
  prepareLorebookEntriesForSave,
  swapLorebookEntries,
  updateLorebookEntry
} from "./draftOperations";
import {
  filterAndSortLorebookEntries,
  matchesLorebookEntry
} from "./filtering";
import {
  blankLorebookEntry,
  cloneLorebookState,
  lorebookDefaultBodyLimit,
  lorebookBodyFileName,
  lorebookBodyStorage,
  lorebookBodyUnavailable,
  lorebookIdentityErrors,
  normalizeLorebookState,
  reassignLorebookNumbers,
  type LorebookEntry,
  type LorebookSortField,
  type LorebookType
} from "./model";
import { validateLorebookSave } from "./saveValidation";
import { useLorebookDocument } from "./useLorebookDocument";
export type { LorebookSaveStatus } from "./useLorebookDocument";


export function useLorebookManager(activeWorkId: string) {
  const {
    savedState,
    setSavedState,
    draftState,
    setDraftState,
    status,
    setStatus,
    message,
    setMessage,
    dirty,
    announce
  } = useLorebookDocument(activeWorkId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | LorebookType>("all");
  const [sortField, setSortField] = useState<LorebookSortField>("no");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    setSelectedId(null);
    setQuery("");
    setTypeFilter("all");
    setBulkMode(false);
    setBulkSelectedIds(new Set());
  }, [activeWorkId]);

  const selectedEntry = useMemo(
    () => draftState.entries.find((entry) => entry.id === selectedId) ?? null,
    [draftState.entries, selectedId]
  );

  const filteredEntries = useMemo(
    () => filterAndSortLorebookEntries(
      draftState.entries,
      query,
      typeFilter,
      sortField,
      sortDirection
    ),
    [draftState.entries, query, sortDirection, sortField, typeFilter]
  );

  const identityErrors = useMemo(
    () => lorebookIdentityErrors(draftState.entries),
    [draftState.entries]
  );
  const unavailableEntries = useMemo(
    () => draftState.entries.filter(lorebookBodyUnavailable),
    [draftState.entries]
  );
  const legacyEntries = useMemo(
    () => draftState.entries.filter((entry) =>
      entry.bodyStorage !== lorebookBodyStorage && !entry.migrateBodyToMarkdown
    ),
    [draftState.entries]
  );
  const canReorder = sortField === "no"
    && sortDirection === "asc"
    && !query.trim();

  function selectEntry(id: string | null) {
    setSelectedId(id);
  }

  function addEntry() {
    const entry = blankLorebookEntry(draftState.entries);
    const entries = reassignLorebookNumbers([...draftState.entries, entry]);
    setDraftState((current) => ({ ...current, entries }));
    setQuery("");
    setSelectedId(entry.id);
    announce("새 항목을 draft에 추가했습니다.");
  }

  function updateSelectedEntry(patch: Partial<LorebookEntry>) {
    if (!selectedEntry) return;
    const previousId = selectedEntry.id;
    const nextId = patch.id === undefined ? previousId : String(patch.id).trim();
    setDraftState((current) => ({
      ...current,
      entries: updateLorebookEntry(current.entries, previousId, patch)
    }));
    if (nextId !== previousId) {
      setSelectedId(nextId);
      setBulkSelectedIds((current) => {
        if (!current.has(previousId)) return current;
        const next = new Set(current);
        next.delete(previousId);
        next.add(nextId);
        return next;
      });
    }
  }

  function deleteSelectedEntry() {
    if (!selectedEntry) return;
    const pairedNotice = selectedEntry.bodyStorage === lorebookBodyStorage
      ? `\n${selectedEntry.fileName}과 ${selectedEntry.bodyFileName}이 함께 삭제됩니다.`
      : "";
    if (!window.confirm(`${selectedEntry.title || "제목 없음"} 항목을 삭제할까요?${pairedNotice}`)) {
      return;
    }
    setDraftState((current) => ({
      ...current,
      entries: reassignLorebookNumbers(
        current.entries.filter((entry) => entry.id !== selectedEntry.id)
      )
    }));
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      next.delete(selectedEntry.id);
      return next;
    });
    setSelectedId(null);
    announce("선택 항목을 draft에서 삭제했습니다.");
  }

  function setManualSort() {
    setSortField("no");
    setSortDirection("asc");
  }

  function changeSort(field: LorebookSortField) {
    if (sortField === field) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortField(field);
    setSortDirection(field === "updatedAt" ? "desc" : "asc");
  }

  function moveEntry(id: string, offset: -1 | 1) {
    if (!canReorder) return;
    const visible = draftState.entries.filter((entry) =>
      matchesLorebookEntry(entry, query, typeFilter)
    );
    const index = visible.findIndex((entry) => entry.id === id);
    const target = visible[index + offset];
    if (index < 0 || !target) return;
    setDraftState((current) => ({
      ...current,
      entries: swapLorebookEntries(current.entries, id, target.id)
    }));
  }

  function moveSelectedToOrder(value: number) {
    if (!selectedEntry) return;
    setDraftState((current) => ({
      ...current,
      entries: moveLorebookEntryToOrder(
        current.entries,
        selectedEntry.id,
        value
      )
    }));
    setManualSort();
  }

  function toggleBulkMode() {
    setBulkMode((current) => !current);
    setBulkSelectedIds(new Set());
  }

  function toggleBulkSelection(id: string) {
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearBulkSelection() {
    setBulkSelectedIds(new Set());
  }

  function selectAllBulkEntries() {
    setBulkSelectedIds(new Set(draftState.entries.map((entry) => entry.id)));
  }

  function selectFilteredBulkEntries() {
    setBulkSelectedIds(new Set(filteredEntries.map((entry) => entry.id)));
  }

  function selectBulkEntriesByType(type: LorebookType) {
    setBulkSelectedIds(new Set(
      draftState.entries
        .filter((entry) => entry.type === type)
        .map((entry) => entry.id)
    ));
  }

  function applyBulkType(type: LorebookType) {
    if (!bulkSelectedIds.size) return;
    const selectedCount = bulkSelectedIds.size;
    setDraftState((current) => ({
      ...current,
      entries: applyLorebookBulkType(current.entries, bulkSelectedIds, type)
    }));
    setBulkSelectedIds(new Set());
    announce(`${selectedCount}개 항목의 타입을 변경했습니다.`);
  }

  function splitBodiesToMarkdown() {
    const targets = bulkSelectedIds.size
      ? legacyEntries.filter((entry) => bulkSelectedIds.has(entry.id))
      : legacyEntries;
    if (!targets.length) {
      announce("MD로 분리할 JSON 본문 항목이 없습니다.", "error");
      return;
    }
    const conflicts = targets.filter((entry) => entry.bodyStatus === "unlinked-md");
    if (conflicts.length) {
      announce(`${conflicts[0].bodyFileName}과 같은 미연결 MD가 이미 있습니다.`, "error");
      return;
    }
    const scope = bulkSelectedIds.size ? "선택한" : "모든 레거시";
    if (!window.confirm(
      `${scope} ${targets.length}개 항목의 본문을 동명 .md 파일로 분리 예약할까요?\n실제 파일 변경은 저장할 때 적용됩니다.`
    )) return;
    const ids = new Set(targets.map((entry) => entry.id));
    setDraftState((current) => ({
      ...current,
      entries: current.entries.map((entry) => ids.has(entry.id)
        ? {
            ...entry,
            migrateBodyToMarkdown: true,
            bodyFileName: lorebookBodyFileName(entry.fileName),
            bodyStatus: "pending-migration"
          }
        : entry)
    }));
    announce(`${targets.length}개 항목의 MD 분리를 예약했습니다.`);
  }

  function updateBodyLimit(value: number) {
    setDraftState((current) => ({
      ...current,
      bodyLimit: Math.max(1, Number(value || 1))
    }));
  }

  async function saveChanges() {
    const entries = prepareLorebookEntriesForSave(draftState.entries);
    const validation = validateLorebookSave(draftState, entries);
    if (!validation.ok) {
      if (validation.entryId !== undefined) {
        setSelectedId(validation.entryId || null);
      }
      if (validation.message) {
        announce(validation.message, "error");
      }
      return false;
    }
    const snapshot = { ...draftState, entries };
    setStatus("saving");
    setMessage("JSON/MD 쌍을 저장하고 있습니다.");
    try {
      const next = await saveLorebook(activeWorkId, snapshot);
      setSavedState(next);
      setDraftState(cloneLorebookState(next));
      setSelectedId((current) =>
        next.entries.some((entry) => entry.id === current) ? current : null
      );
      setStatus("idle");
      setMessage(
        next.migration && typeof next.migration === "object"
          ? "저장 완료 · MD 분리 상태 반영됨"
          : "변경사항 저장 완료"
      );
      return true;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
      return false;
    }
  }

  function cancelChanges() {
    if (dirty && !window.confirm("저장하지 않은 변경을 취소할까요?")) return;
    setDraftState(cloneLorebookState(savedState));
    setSelectedId(null);
    setBulkMode(false);
    setBulkSelectedIds(new Set());
    announce("저장된 상태로 되돌렸습니다.");
  }

  function replaceDraftFromImport(value: unknown) {
    const imported = normalizeLorebookState(
      value,
      lorebookDefaultBodyLimit(activeWorkId)
    );
    setDraftState({
      ...imported,
      collectionRevision: savedState.collectionRevision,
      invalidJsonFiles: savedState.invalidJsonFiles
    });
    setSelectedId(null);
    setBulkSelectedIds(new Set());
    announce(`${imported.entries.length}개 항목을 draft로 가져왔습니다.`);
  }

  return {
    savedState,
    draftState,
    status,
    message,
    dirty,
    selectedId,
    selectedEntry,
    query,
    typeFilter,
    sortField,
    sortDirection,
    bulkMode,
    bulkSelectedIds,
    filteredEntries,
    identityErrors,
    unavailableEntries,
    legacyEntries,
    canReorder,
    setQuery,
    setTypeFilter,
    selectEntry,
    addEntry,
    updateSelectedEntry,
    deleteSelectedEntry,
    setManualSort,
    changeSort,
    moveEntry,
    moveSelectedToOrder,
    toggleBulkMode,
    toggleBulkSelection,
    clearBulkSelection,
    selectAllBulkEntries,
    selectFilteredBulkEntries,
    selectBulkEntriesByType,
    applyBulkType,
    splitBodiesToMarkdown,
    updateBodyLimit,
    saveChanges,
    cancelChanges,
    replaceDraftFromImport,
    announce
  };
}

export type LorebookManager = ReturnType<typeof useLorebookManager>;
