import { useState } from "react";
import { applyCanvasBatch, type CanvasBatchItem } from "./canvasBatch";
import type { JsonObject } from "./model";
import { HelpButton } from "../help/HelpButton";

type Props = {
  canvas: JsonObject;
  items: CanvasBatchItem[];
  onApply: (canvas: JsonObject, message: string) => void;
};

export function RplayCanvasBatchPanel({ canvas, items, onApply }: Props) {
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const types = [...new Set(items.map((item) => item.kind))].sort();
  const visible = items.filter((item) => !type || item.kind === type);
  const selectable = visible.filter((item) => item.status !== "blocked");
  const missing = visible.filter((item) => item.status === "missing");
  const legacy = visible.filter((item) => item.status === "legacy");
  const selectedMissing = missing.filter((item) => selected.has(item.id));
  const selectedLegacy = legacy.filter((item) => selected.has(item.id));
  const allChecked = !!selectable.length && selectable.every((item) => selected.has(item.id));

  function toggle(ids: string[], checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => checked ? next.add(id) : next.delete(id));
      return next;
    });
  }

  function apply(rows: CanvasBatchItem[], action: "add" | "delete") {
    if (!rows.length) return;
    setError("");
    try {
      const next = applyCanvasBatch(canvas, rows, action);
      onApply(next, `${action === "add" ? "누락" : "레거시"} 노드 ${rows.length}개를 ${action === "add" ? "추가" : "삭제"}했습니다.`);
      toggle(rows.map((row) => row.id), false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "선택한 항목을 적용하지 못했습니다.");
    }
  }

  return <section className="rplay-batch-panel" aria-label="노드 추가·삭제 체크리스트">
    <header><span className="feature-help-pair"><strong>추가·삭제 대상</strong><HelpButton topic="canvasBatch" /></span><label>타입
      <select aria-label="추가·삭제 대상 타입" value={type} onChange={(event) => setType(event.target.value)}>
        <option value="">전체 타입</option>
        {types.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        {type && !types.includes(type) ? <option value={type}>{type}</option> : null}
      </select>
    </label></header>
    <div className="rplay-batch-actions">
      <button type="button" disabled={!selectable.length} onClick={() => toggle(selectable.map((item) => item.id), !allChecked)}>{allChecked ? "현재 목록 선택 해제" : "현재 목록 전체 선택"}</button>
      <button type="button" disabled={!selectedMissing.length} onClick={() => apply(selectedMissing, "add")}>선택 추가 ({selectedMissing.length})</button>
      <button type="button" disabled={!missing.length} onClick={() => apply(missing, "add")}>{type ? "현재 타입 누락 모두 추가" : "누락 모두 추가"} ({missing.length})</button>
      <button type="button" disabled={!selectedLegacy.length} onClick={() => apply(selectedLegacy, "delete")}>선택 레거시 삭제 ({selectedLegacy.length})</button>
      <button type="button" disabled={!legacy.length} onClick={() => apply(legacy, "delete")}>{type ? "현재 타입 레거시 모두 삭제" : "레거시 모두 삭제"} ({legacy.length})</button>
    </div>
    <p>전체 선택·일괄 작업은 현재 타입에 표시된 항목에만 적용됩니다. 삭제는 캔버스 수정본에 적용하며 편집 되돌리기로 복원할 수 있습니다.</p>
    {error ? <p role="alert">{error}</p> : null}
    <div className="rplay-content-table-wrap"><table className="rplay-content-table">
      <thead><tr><th className="rplay-content-select-column"><input type="checkbox" aria-label="현재 목록 전체 선택" checked={allChecked} disabled={!selectable.length} onChange={(event) => toggle(selectable.map((item) => item.id), event.target.checked)} /></th><th>이름</th><th>타입</th><th>상태</th></tr></thead>
      <tbody>{visible.map((item) => <tr key={item.id}>
        <td className="rplay-content-select-column"><input type="checkbox" aria-label={`${item.title} ${item.status === "legacy" ? "삭제" : "추가"} 선택`} checked={selected.has(item.id)} disabled={item.status === "blocked"} onChange={(event) => toggle([item.id], event.target.checked)} /></td>
        <td>{item.title}</td><td>{item.kind}</td><td>{item.status === "missing" ? "누락 · 추가 가능" : item.status === "legacy" ? "레거시 · 원본 없음" : item.reason || "중복 확인 필요"}</td>
      </tr>)}{!visible.length ? <tr><td colSpan={4}>해당 타입에 추가·삭제할 대상이 없습니다.</td></tr> : null}</tbody>
    </table></div>
  </section>;
}
