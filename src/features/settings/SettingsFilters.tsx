import { FilterBar } from "../workspace/FilterBar";
import {
  genderLabels,
  groupLabels,
  type CharacterGender,
  type CharacterGroup
} from "./model";

interface SettingsFiltersProps {
  query: string;
  group: CharacterGroup | "all";
  gender: CharacterGender | "all";
  filteredCount: number;
  totalCount: number;
  onQueryChange: (value: string) => void;
  onGroupChange: (value: CharacterGroup | "all") => void;
  onGenderChange: (value: CharacterGender | "all") => void;
  onReset: () => void;
}

export function SettingsFilters({
  query,
  group,
  gender,
  filteredCount,
  totalCount,
  onQueryChange,
  onGroupChange,
  onGenderChange,
  onReset
}: SettingsFiltersProps) {
  return (
    <FilterBar className="settings-filter-bar" aria-label="캐릭터 목록 필터">
      <label className="settings-search">
        <span className="sr-only">캐릭터 검색</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="이름, 별칭, 소속, 관계 검색"
        />
      </label>
      <label>
        <span className="sr-only">분류</span>
        <select
          value={group}
          onChange={(event) => onGroupChange(event.target.value as CharacterGroup | "all")}
        >
          <option value="all">분류 전체</option>
          {Object.entries(groupLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">성별</span>
        <select
          value={gender}
          onChange={(event) => onGenderChange(event.target.value as CharacterGender | "all")}
        >
          <option value="all">성별 전체</option>
          {Object.entries(genderLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <button className="settings-button settings-button--ghost" type="button" onClick={onReset}>
        필터 초기화
      </button>
      <span className="settings-filter-count">{filteredCount}/{totalCount}명</span>
    </FilterBar>
  );
}
