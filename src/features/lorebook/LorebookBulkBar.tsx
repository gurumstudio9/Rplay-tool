import {
  lorebookTypeOptions,
  type LorebookType
} from "./model";
import { useState } from "react";

type Props = {
  typeOptions?: ReadonlyArray<readonly [string, string]>;
  open: boolean;
  selectedCount: number;
  totalCount: number;
  filteredCount: number;
  onSelectAll: () => void;
  onSelectFiltered: () => void;
  onSelectType: (type: LorebookType) => void;
  onApplyType: (type: LorebookType) => void;
  onClear: () => void;
};

export function LorebookBulkBar({
  typeOptions = lorebookTypeOptions,
  open,
  selectedCount,
  totalCount,
  filteredCount,
  onSelectAll,
  onSelectFiltered,
  onSelectType,
  onApplyType,
  onClear
}: Props) {
  const [selectionType, setSelectionType] = useState<LorebookType>("general");
  const [targetType, setTargetType] = useState<LorebookType>("general");
  if (!open) return null;
  return (
    <section className="lore-bulk-bar">
      <div className="lore-bulk-summary" aria-live="polite">
        <strong>{selectedCount}개 선택</strong>
        <small>변경 내용은 저장 전까지 draft 상태입니다.</small>
      </div>

      <div className="lore-bulk-group">
        <span>선택 범위</span>
        <div>
          <button type="button" onClick={onSelectAll} disabled={totalCount === 0}>
            전체 선택 ({totalCount})
          </button>
          <button type="button" onClick={onSelectFiltered} disabled={filteredCount === 0}>
            검색 결과 선택 ({filteredCount})
          </button>
          <label>
            <span className="sr-only">선택할 로어북 타입</span>
            <select
              aria-label="선택할 로어북 타입"
              value={selectionType}
              onChange={(event) => setSelectionType(event.target.value as LorebookType)}
            >
              {typeOptions.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => onSelectType(selectionType)}>
            이 타입만 선택
          </button>
          <button type="button" onClick={onClear} disabled={selectedCount === 0}>
            선택 해제
          </button>
        </div>
      </div>

      <div className="lore-bulk-group lore-bulk-group--apply">
        <span>타입 일괄 변경</span>
        <div>
          <label>
            <span className="sr-only">변경할 로어북 타입</span>
            <select
              aria-label="변경할 로어북 타입"
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as LorebookType)}
              disabled={selectedCount === 0}
            >
              {typeOptions.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="is-primary"
            onClick={() => onApplyType(targetType)}
            disabled={selectedCount === 0}
          >
            타입 변경 적용
          </button>
        </div>
      </div>
    </section>
  );
}
