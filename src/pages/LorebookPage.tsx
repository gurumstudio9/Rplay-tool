import { LorebookBulkBar } from "../features/lorebook/LorebookBulkBar";
import { LorebookCommandBar } from "../features/lorebook/LorebookCommandBar";
import { LorebookEditor } from "../features/lorebook/LorebookEditor";
import { LorebookFilters } from "../features/lorebook/LorebookFilters";
import { LorebookTable } from "../features/lorebook/LorebookTable";
import {
  formatLorebookEntry,
  lorebookUnlimitedBodyLimit,
  portableLorebookState
} from "../features/lorebook/model";
import { copyLorebookText } from "../features/lorebook/platform/clipboard";
import { useLorebookPlatformCopy } from "../features/lorebook/platform/useLorebookPlatformCopy";
import { useLorebookManager } from "../features/lorebook/useLorebookManager";
import { useWorks } from "../features/works/WorkContext";
import "../styles/lorebook.css";
import "../styles/lorebook-editor.css";
import "../styles/lorebook-table.css";

export function LorebookPage() {
  const { activeWorkId, activePlatformId, activeWork } = useWorks();
  const workKey = `${activeWorkId}::${activePlatformId}`;
  const manager = useLorebookManager(workKey);
  const platform = useLorebookPlatformCopy(workKey, manager);
  const selectedOrder = manager.selectedEntry
    ? manager.draftState.entries.findIndex(
        (entry) => entry.id === manager.selectedEntry?.id
      ) + 1
    : 0;
  const selectedErrors = manager.selectedEntry
    ? manager.identityErrors
        .filter((error) => error.entryId === manager.selectedEntry?.id)
        .map((error) => error.message)
    : [];
  const disabled = manager.status === "loading" || manager.status === "saving";

  async function exportJson() {
    const data = JSON.stringify(portableLorebookState(manager.draftState), null, 2);
    await copyLorebookText(data);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeWorkId}-${activePlatformId}-lorebook.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    manager.announce("JSON을 복사하고 파일로 내보냈습니다.");
  }

  async function importJson(file: File) {
    try {
      const imported = JSON.parse(await file.text()) as unknown;
      if (
        !imported
        || typeof imported !== "object"
        || Array.isArray(imported)
        || !("entries" in imported)
        || !Array.isArray((imported as { entries?: unknown }).entries)
      ) {
        throw new Error("{ entries } 배열 형식이 필요합니다.");
      }
      manager.replaceDraftFromImport(imported);
    } catch (error) {
      manager.announce(
        error instanceof Error ? `가져오기 실패: ${error.message}` : "JSON 가져오기에 실패했습니다.",
        "error"
      );
    }
  }

  async function copyAll() {
    await copyLorebookText(
      manager.draftState.entries.map(formatLorebookEntry).join("\n\n---\n\n")
    );
    manager.announce(`전체 로어북 ${manager.draftState.entries.length}개 복사됨`);
  }

  if (manager.status === "loading") {
    return (
      <section className="lore-loading">
        <span />
        <strong>작품 로어북을 불러오는 중입니다</strong>
        <p>{activeWork?.name ?? "현재 작품"}의 JSON과 Markdown 본문을 연결하고 있습니다.</p>
      </section>
    );
  }

  return (
    <div className="lore-page">
      <LorebookCommandBar
        managementTools={<>
          <label className="workspace-action-group">본문 글자수 기준
            {manager.draftState.bodyLimit >= lorebookUnlimitedBodyLimit ? <strong>무제한</strong> :
            <input aria-label="본문 글자수 기준" type="number" min="1" step="50" value={manager.draftState.bodyLimit} onChange={(event) => manager.updateBodyLimit(Number(event.target.value))} />
            }
          </label>
          <LorebookBulkBar
            open={manager.bulkMode}
            selectedCount={manager.bulkSelectedIds.size}
            totalCount={manager.draftState.entries.length}
            filteredCount={manager.filteredEntries.length}
            onSelectAll={manager.selectAllBulkEntries}
            onSelectFiltered={manager.selectFilteredBulkEntries}
            onSelectType={manager.selectBulkEntriesByType}
            onApplyType={manager.applyBulkType}
            onClear={manager.clearBulkSelection}
          />
        </>}
        entryCount={manager.draftState.entries.length}
        dirty={manager.dirty}
        status={manager.status}
        message={manager.message}
        invalidJsonCount={manager.draftState.invalidJsonFiles.length}
        bulkMode={manager.bulkMode}
        onAdd={manager.addEntry}
        onSave={() => void manager.saveChanges()}
        onCancel={manager.cancelChanges}
        onToggleBulk={manager.toggleBulkMode}
        onSplitMarkdown={manager.splitBodiesToMarkdown}
        onPlatform={(action) => void platform.copyPlatform(action)}
        onCopyAll={() => void copyAll()}
        onExport={() => void exportJson()}
        onImport={(file) => void importJson(file)}
      />

      {manager.draftState.invalidJsonFiles.length ? (
        <section className="lore-file-warning" role="alert">
          <strong>파싱할 수 없는 JSON이 있어 저장과 플랫폼 복사를 중단합니다.</strong>
          <p>{manager.draftState.invalidJsonFiles.join(" · ")}</p>
        </section>
      ) : null}

      <LorebookFilters
        query={manager.query}
        typeFilter={manager.typeFilter}
        filteredCount={manager.filteredEntries.length}
        totalCount={manager.draftState.entries.length}
        manualSort={manager.sortField === "no" && manager.sortDirection === "asc"}
        onQueryChange={manager.setQuery}
        onTypeChange={manager.setTypeFilter}
        onManualSort={manager.setManualSort}
        onReset={() => {
          manager.setQuery("");
          manager.setTypeFilter("all");
        }}
      />


      {!manager.bulkMode ? (
        <LorebookEditor
          entry={manager.selectedEntry}
          order={selectedOrder}
          bodyLimit={manager.draftState.bodyLimit}
          errors={selectedErrors}
          disabled={disabled}
          onChange={manager.updateSelectedEntry}
          onOrderChange={manager.moveSelectedToOrder}
          onDelete={manager.deleteSelectedEntry}
        />
      ) : null}

      <LorebookTable
        entries={manager.filteredEntries}
        selectedId={manager.selectedId}
        bodyLimit={manager.draftState.bodyLimit}
        sortField={manager.sortField}
        sortDirection={manager.sortDirection}
        bulkMode={manager.bulkMode}
        bulkSelectedIds={manager.bulkSelectedIds}
        canReorder={manager.canReorder}
        onSort={manager.changeSort}
        onSelect={manager.selectEntry}
        onToggleBulk={manager.toggleBulkSelection}
        onMove={manager.moveEntry}
        onCopy={(entry) => {
          void copyLorebookText(formatLorebookEntry(entry)).then(
            () => manager.announce(`${entry.title || entry.id} 복사됨`)
          );
        }}
      />

    </div>
  );
}

