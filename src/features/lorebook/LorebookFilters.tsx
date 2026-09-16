import { FilterBar } from "../workspace/FilterBar";
import {
  lorebookTypeOptions,
  type LorebookType
} from "./model";

type Props = {
  typeOptions?: ReadonlyArray<readonly [string, string]>;
  query: string;
  typeFilter: "all" | LorebookType;
  filteredCount: number;
  totalCount: number;
  manualSort: boolean;
  onQueryChange: (value: string) => void;
  onTypeChange: (value: "all" | LorebookType) => void;
  onManualSort: () => void;
  onReset: () => void;
};

export function LorebookFilters({
  typeOptions = lorebookTypeOptions,
  query,
  typeFilter,
  filteredCount,
  totalCount,
  manualSort,
  onQueryChange,
  onTypeChange,
  onManualSort,
  onReset
}: Props) {
  return (
    <FilterBar className="lore-filter-bar">
      <div className="lore-filter-main">
        <select
          aria-label="로어북 타입 필터"
          value={typeFilter}
          onChange={(event) => onTypeChange(event.target.value as "all" | LorebookType)}
        >
          <option value="all">타입 전체</option>
          {typeOptions.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <label className="lore-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="로어북 검색"
            type="search"
            value={query}
            placeholder="제목, 트리거, 본문, ID 검색"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <strong>
          {filteredCount === totalCount
            ? `총 ${totalCount}개`
            : `${filteredCount}개 / 총 ${totalCount}개`}
        </strong>
      </div>
      <div className="lore-filter-options">

        <button
          type="button"
          className={manualSort ? "lore-filter-button is-active" : "lore-filter-button"}
          onClick={onManualSort}
        >
          직접 순서
        </button>
        <button type="button" className="lore-filter-button" onClick={onReset}>
          필터 초기화
        </button>
      </div>
    </FilterBar>
  );
}
