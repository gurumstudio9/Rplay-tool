import { useState } from "react";
import { availableLorebookTypes, rplayTypePriority, type LorebookState } from "./model";

type Props = {
  state: LorebookState;
  disabled: boolean;
  onChange: (type: string, priority: number) => void;
};

export function LorebookTypeSettings({ state, disabled, onChange }: Props) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("10");
  const [message, setMessage] = useState("");
  const options = availableLorebookTypes(state);
  return <details className="lore-type-settings">
    <summary>매크로 타입 · 기본 우선순위 설정</summary>
    <p>이 작품의 알플레이 로어북에 적용합니다. 항목별 우선순위가 있으면 그 값을 쓰고, 비어 있으면 아래 기본값을 씁니다. 변경 후 저장하세요.</p>
    <div className="lore-type-priorities">
      {options.map(([id, label]) => <label key={id}>{label}
        <input aria-label={`${label} 기본 우선순위`} type="number" min="0" step="1" disabled={disabled}
          value={rplayTypePriority(id, state.typePriorities)}
          onChange={event => { if (event.target.value !== "") onChange(id, Number(event.target.value)); }} />
      </label>)}
    </div>
    <div className="lore-custom-type">
      <label>사용자 타입 이름<input maxLength={80} value={name} disabled={disabled} onChange={event => setName(event.target.value)} placeholder="예: 사건" /></label>
      <label>새 타입 기본 우선순위<input type="number" min="0" step="1" value={priority} disabled={disabled} onChange={event => setPriority(event.target.value)} /></label>
      <button type="button" disabled={disabled || !name.trim()} onClick={() => {
        const id = name.trim();
        if (id === "all" || options.some(([key, label]) => key === id || label === id)) { setMessage("이미 있는 타입 이름입니다."); return; }
        if (priority === "" || !Number.isSafeInteger(Number(priority)) || Number(priority) < 0) { setMessage("우선순위는 0 이상의 정수로 입력하세요."); return; }
        onChange(id, Number(priority)); setName(""); setMessage(`${id} 타입을 추가했습니다. 변경 저장을 누르세요.`);
      }}>사용자 타입 추가</button>
    </div>
    <p role="status">{message}</p>
  </details>;
}
