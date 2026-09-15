import {
  lorebookBodyState,
  lorebookBodyLimitLabel,
  lorebookTypeLabel,
  type LorebookEntry,
  type LorebookSortField
} from "./model";

type Props = {
  entries: LorebookEntry[];
  selectedId: string | null;
  bodyLimit: number;
  sortField: LorebookSortField;
  sortDirection: "asc" | "desc";
  bulkMode: boolean;
  bulkSelectedIds: Set<string>;
  canReorder: boolean;
  onSort: (field: LorebookSortField) => void;
  onSelect: (id: string) => void;
  onToggleBulk: (id: string) => void;
  onMove: (id: string, offset: -1 | 1) => void;
  onCopy: (entry: LorebookEntry) => void;
};

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function SortButton({
  field,
  label,
  activeField,
  direction,
  onSort
}: {
  field: LorebookSortField;
  label: string;
  activeField: LorebookSortField;
  direction: "asc" | "desc";
  onSort: (field: LorebookSortField) => void;
}) {
  return (
    <button
      type="button"
      className={field === activeField ? "is-active" : ""}
      onClick={() => onSort(field)}
    >
      {label}
      <span aria-hidden="true">
        {field === activeField ? (direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

export function LorebookTable({
  entries,
  selectedId,
  bodyLimit,
  sortField,
  sortDirection,
  bulkMode,
  bulkSelectedIds,
  canReorder,
  onSort,
  onSelect,
  onToggleBulk,
  onMove,
  onCopy
}: Props) {
  return (
    <section className="lore-table-shell">
      <div className="lore-table-scroll">
        <table>
          <thead>
            <tr>
              {bulkMode ? <th className="lore-col-check">선택</th> : null}
              <th className="lore-col-no">
                <SortButton field="no" label="No." activeField={sortField} direction={sortDirection} onSort={onSort} />
              </th>
              <th className="lore-col-date">
                <SortButton field="updatedAt" label="수정일" activeField={sortField} direction={sortDirection} onSort={onSort} />
              </th>
              <th className="lore-col-type">
                <SortButton field="type" label="타입" activeField={sortField} direction={sortDirection} onSort={onSort} />
              </th>
              <th className="lore-col-title">
                <SortButton field="title" label="제목" activeField={sortField} direction={sortDirection} onSort={onSort} />
              </th>
              <th className="lore-col-trigger">
                <SortButton field="triggers" label="트리거" activeField={sortField} direction={sortDirection} onSort={onSort} />
              </th>
              <th className="lore-col-count">
                <SortButton field="count" label="글자수" activeField={sortField} direction={sortDirection} onSort={onSort} />
              </th>
              <th className="lore-col-actions">관리</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const storage = lorebookBodyState(entry);
              const selected = entry.id === selectedId;
              const bulkSelected = bulkSelectedIds.has(entry.id);
              return (
                <tr
                  key={entry.id}
                  className={[
                    selected ? "is-selected" : "",
                    bulkSelected ? "is-bulk-selected" : ""
                  ].filter(Boolean).join(" ")}
                  onClick={() => bulkMode ? onToggleBulk(entry.id) : onSelect(entry.id)}
                >
                  {bulkMode ? (
                    <td className="lore-col-check">
                      <input
                        type="checkbox"
                        checked={bulkSelected}
                        aria-label={`${entry.title || entry.id} 선택`}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => onToggleBulk(entry.id)}
                      />
                    </td>
                  ) : null}
                  <td className="lore-col-no"><code>{entry.no}</code></td>
                  <td className="lore-col-date">{formatDate(entry.bodyModifiedAt || entry.updatedAt)}</td>
                  <td className="lore-col-type">
                    <span className="lore-type-badge">{lorebookTypeLabel(entry.type)}</span>
                  </td>
                  <td className="lore-col-title">
                    <strong>{entry.title || "제목 없음"}</strong>
                    <small className={`lore-storage-inline lore-storage-inline--${storage.tone}`}>
                      {storage.label}
                    </small>
                  </td>
                  <td className="lore-col-trigger">
                    <div className="lore-tag-list">
                      {entry.triggers.length
                        ? entry.triggers.map((trigger) => <span key={trigger}>{trigger}</span>)
                        : <small>트리거 없음</small>}
                    </div>
                  </td>
                  <td className={entry.body.length > bodyLimit ? "lore-col-count is-warning" : "lore-col-count"}>
                    {entry.body.length} / {lorebookBodyLimitLabel(bodyLimit)}
                  </td>
                  <td className="lore-col-actions">
                    <div>
                      <button
                        type="button"
                        aria-label={`${entry.title} 한 칸 위로`}
                        disabled={!canReorder || index === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          onMove(entry.id, -1);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`${entry.title} 한 칸 아래로`}
                        disabled={!canReorder || index === entries.length - 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          onMove(entry.id, 1);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCopy(entry);
                        }}
                      >
                        복사
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!entries.length ? (
        <div className="lore-table-empty">
          <strong>표시할 로어북 항목이 없습니다.</strong>
          <p>검색어나 타입 필터를 바꾸거나 새 항목을 추가해 보세요.</p>
        </div>
      ) : null}
    </section>
  );
}
