import {
  type PromptVersion
} from "./model";

interface PromptVersionDialogProps {
  open: boolean;
  editing: boolean;
  draft: PromptVersion;
  field: "additionalPrompt" | "starterPrompt" | "starterMessage";
  onClose: () => void;
  onChange: (patch: Partial<PromptVersion>) => void;
  onSave: () => boolean;
  onDelete: () => void;
}

export function PromptVersionDialog({
  open,
  editing,
  draft,
  field,
  onClose,
  onChange,
  onSave,
  onDelete
}: PromptVersionDialogProps) {
  if (!open) return null;
  return (
    <div className="prompt-modal-backdrop" role="presentation">
      <section
        className="prompt-version-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-version-dialog-title"
      >
        <header>
          <div>
            <span>PROMPT NODE</span>
            <h2 id="prompt-version-dialog-title">
              {editing ? "노드 수정" : "노드 추가"}
            </h2>
          </div>
          <button type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="prompt-version-form-grid">
            <label>
              노드 이름
              <input
                autoFocus
                required
                value={draft.name}
                placeholder="예: 새로운 여정의 시작"
                onChange={(event) => onChange({ name: event.target.value })}
              />
            </label>
            <label>
              노드 ID
              <input
                value={draft.id}
                disabled={editing}
                placeholder="적용할 때 노드 이름에서 자동 생성"
                onChange={(event) => onChange({ id: event.target.value })}
              />
            </label>
            <label className="prompt-version-body-field">
              노드 종류
              <select value={draft.nodeType} onChange={event => onChange({ nodeType: event.target.value as "start" | "normal" })}>
                <option value="start">시작 노드</option>
                <option value="normal">일반 노드</option>
              </select>
              <small>{draft.nodeType === "start" ? "메인 · 월드스토리 · 시작 프롬프트 · 시작 메시지" : "메인 · 월드스토리"}</small>
            </label>
            <label className="prompt-version-notes-field">
              메모
              <textarea
                value={draft.notes}
                placeholder="이 버전의 목적이나 변경 사항"
                onChange={(event) => onChange({ notes: event.target.value })}
              />
            </label>
          </div>
          <footer>
            {editing ? (
              <button
                className="prompt-button prompt-button--danger"
                type="button"
                onClick={onDelete}
              >
                삭제
              </button>
            ) : <span />}
            <span />
            <button className="prompt-button" type="button" onClick={onClose}>
              취소
            </button>
            <button
              className="prompt-button prompt-button--primary"
              type="submit"
            >
              편집 내용에 적용
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
