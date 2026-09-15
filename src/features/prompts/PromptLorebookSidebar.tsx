import { SidebarSection } from "../workspace/WorkspaceSidebar";
import { AutoTextarea } from "../workspace/AutoTextarea";
import {
  promptLorebookBodyLabel,
  promptLorebookBodyUnavailable,
  promptLorebookTypeLabel,
  promptLorebookTypes,
  type PromptLorebookEntry
} from "./lorebookModel";
import type { usePromptLorebook } from "./usePromptLorebook";

interface PromptLorebookSidebarProps {
  open: boolean;
  lorebook: ReturnType<typeof usePromptLorebook>;
  onClose: () => void;
  onInsert: (body: string) => void;
}

export function PromptLorebookSidebar({
  open,
  lorebook,
  onClose,
  onInsert
}: PromptLorebookSidebarProps) {
  if (!open) return null;
  const draft = lorebook.draft;
  return (
    <SidebarSection order={40}>
      <aside className="prompt-lorebook" aria-label="로어북 사전">
      <header>
        <div>
          <span>LOREBOOK DICTIONARY</span>
          <strong>로어북 사전</strong>
        </div>
        <button type="button" aria-label="로어북 닫기" onClick={onClose}>×</button>
      </header>

      {lorebook.message ? (
        <p className={`prompt-lorebook-status is-${lorebook.status}`}>
          {lorebook.message}
        </p>
      ) : null}
      {lorebook.state.invalidJsonFiles.length ? (
        <p className="prompt-lorebook-warning">
          파싱 오류: {lorebook.state.invalidJsonFiles.join(", ")}
        </p>
      ) : null}

      {lorebook.editorOpen && draft ? (
        <LorebookEditor
          draft={draft}
          editing={Boolean(lorebook.editingId)}
          saving={lorebook.status === "saving"}
          onBack={lorebook.closeEditor}
          onChange={lorebook.updateDraft}
          onInsert={() => {
            if (!promptLorebookBodyUnavailable(draft)) onInsert(draft.body);
          }}
          onSave={() => void lorebook.saveDraft()}
          onDelete={() => void lorebook.deleteDraft()}
        />
      ) : (
        <>
          <div className="prompt-lorebook-filters">
            <select
              aria-label="로어북 타입 필터"
              value={lorebook.typeFilter}
              onChange={(event) => lorebook.setTypeFilter(event.target.value)}
            >
              {promptLorebookTypes.map(([id, label]) => (
                <option value={id} key={id}>{label}</option>
              ))}
            </select>
            <input
              type="search"
              value={lorebook.query}
              placeholder="제목, 트리거, 본문 검색"
              aria-label="로어북 검색"
              onChange={(event) => lorebook.setQuery(event.target.value)}
            />
            <button
              className="prompt-button prompt-button--primary"
              type="button"
              onClick={lorebook.openCreate}
            >
              추가
            </button>
          </div>
          <div className="prompt-lorebook-list">
            {lorebook.status === "loading" ? (
              <div className="prompt-lorebook-empty">로어북을 불러오는 중입니다.</div>
            ) : lorebook.entries.length ? (
              lorebook.entries.map((entry) => (
                <article key={entry.id}>
                  <button
                    className="prompt-lorebook-entry"
                    type="button"
                    onClick={() => lorebook.openEntry(entry.id)}
                  >
                    <span>
                      <strong>{entry.title || "제목 없음"}</strong>
                      <small>{promptLorebookTypeLabel(entry.type)}</small>
                      <small>{promptLorebookBodyLabel(entry)}</small>
                    </span>
                    <div>
                      {entry.triggers.map((trigger) => (
                        <em key={trigger}>{trigger}</em>
                      ))}
                    </div>
                    <p>{entry.body || "내용 없음"}</p>
                  </button>
                  <button
                    className="prompt-lorebook-insert"
                    type="button"
                    disabled={promptLorebookBodyUnavailable(entry)}
                    onClick={() => onInsert(entry.body)}
                  >
                    본문 삽입
                  </button>
                </article>
              ))
            ) : (
              <div className="prompt-lorebook-empty">검색 결과가 없습니다.</div>
            )}
          </div>
        </>
      )}
    </aside>
      </SidebarSection>
  );
}

function LorebookEditor({
  draft,
  editing,
  saving,
  onBack,
  onChange,
  onInsert,
  onSave,
  onDelete
}: {
  draft: PromptLorebookEntry;
  editing: boolean;
  saving: boolean;
  onBack: () => void;
  onChange: (patch: Partial<PromptLorebookEntry>) => void;
  onInsert: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const unavailable = promptLorebookBodyUnavailable(draft);
  return (
    <div className="prompt-lorebook-editor">
      <div className="prompt-lorebook-editor-head">
        <button type="button" onClick={onBack}>← 목록</button>
        <span>{promptLorebookBodyLabel(draft)}</span>
      </div>
      <label>
        타입
        <select
          value={draft.type}
          onChange={(event) => onChange({ type: event.target.value })}
        >
          {promptLorebookTypes.filter(([id]) => id !== "all").map(
            ([id, label]) => <option value={id} key={id}>{label}</option>
          )}
        </select>
      </label>
      <label>
        제목
        <input
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </label>
      <label>
        트리거 태그
        <input
          value={draft.triggers.join(", ")}
          placeholder="태그1, 태그2"
          onChange={(event) => onChange({
            triggers: event.target.value.split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          })}
        />
      </label>
      <label className="prompt-lorebook-body-field">
        본문
        <AutoTextarea
          value={draft.body}
          disabled={unavailable}
          title={unavailable
            ? `${draft.bodyFileName} 본문을 읽지 못했습니다.`
            : draft.bodyFileName}
          onChange={(event) => onChange({ body: event.target.value })}
        />
      </label>
      <footer>
        <button
          className="prompt-button"
          type="button"
          disabled={unavailable}
          onClick={onInsert}
        >
          프롬프트에 삽입
        </button>
        {editing ? (
          <button
            className="prompt-button prompt-button--danger"
            type="button"
            disabled={saving}
            onClick={onDelete}
          >
            삭제
          </button>
        ) : null}
        <button
          className="prompt-button prompt-button--primary"
          type="button"
          disabled={saving || unavailable}
          onClick={onSave}
        >
          {saving ? "저장 중" : "저장"}
        </button>
      </footer>
    </div>
  );
}
