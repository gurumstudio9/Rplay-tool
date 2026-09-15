import { AutoTextarea } from "../workspace/AutoTextarea";
import { TokenCount } from "../workspace/TokenCount";
import {
  lorebookBodyLimitLabel,
  lorebookBodyState,
  lorebookBodyUnavailable,
  normalizeLorebookTriggers,
  lorebookTitleLimit,
  lorebookTriggerLimit,
  lorebookTypeOptions,
  type LorebookEntry
} from "./model";

type Props = {
  entry: LorebookEntry | null;
  order: number;
  bodyLimit: number;
  errors: string[];
  disabled: boolean;
  onChange: (patch: Partial<LorebookEntry>) => void;
  onOrderChange: (value: number) => void;
  onDelete: () => void;
};

export function LorebookEditor({
  entry,
  order,
  bodyLimit,
  errors,
  disabled,
  onChange,
  onOrderChange,
  onDelete,
}: Props) {
  if (!entry) {
    return (
      <section className="lore-editor lore-editor--empty">
        <span aria-hidden="true">↖</span>
        <strong>편집할 로어북 항목을 선택하세요</strong>
        <p>표의 행을 누르거나 새 항목을 추가하면 이곳에서 전체 내용을 편집할 수 있습니다.</p>
      </section>
    );
  }

  const bodyState = lorebookBodyState(entry);
  const bodyUnavailable = lorebookBodyUnavailable(entry);
  const triggerText = entry.triggers.join(",");
  const triggerCount = normalizeLorebookTriggers(entry.triggers).length;

  return (
    <section className="lore-editor">
      <div className="lore-editor-heading">
        <div>
          <span className={`lore-storage-badge lore-storage-badge--${bodyState.tone}`}>
            {bodyState.label}
          </span>
          <h2>{entry.title || "새 로어북 항목"}</h2>
          <p>{entry.fileName} · {entry.bodyFileName}</p>
        </div>
        <button
          type="button"
          className="lore-delete-button"
          onClick={onDelete}
          disabled={disabled}
        >
          선택 삭제
        </button>
      </div>

      <div className="lore-identity-fields">
        <label>
          <span>타입</span>
          <select
            value={entry.type}
            onChange={(event) => onChange({ type: event.target.value as LorebookEntry["type"] })}
            disabled={disabled}
          >
            {lorebookTypeOptions.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>직접 순서</span>
          <input
            type="number"
            min="1"
            value={order}
            onChange={(event) => onOrderChange(Number(event.target.value))}
            disabled={disabled}
          />
        </label>
        <label className={errors.length ? "has-error" : ""}>
          <span>ID</span>
          <input
            value={entry.id}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange({ id: event.target.value })}
            disabled={disabled}
          />
        </label>
        <label>
          <span>내부 번호</span>
          <input value={entry.no} readOnly />
        </label>
      </div>

      {errors.length ? (
        <div className="lore-editor-error" role="alert">{errors.join(" · ")}</div>
      ) : null}
      {bodyUnavailable ? (
        <div className="lore-editor-error" role="alert">
          {entry.bodyFileName} 본문을 안전하게 읽지 못했습니다. 파일을 확인하기 전에는 저장할 수 없습니다.
        </div>
      ) : null}

      <div className="lore-editor-grid">
        <label className="lore-title-input">
          <span>
            제목
            <small className={entry.title.length > lorebookTitleLimit ? "is-warning" : ""}>
              {entry.title.length} / {lorebookTitleLimit}
            </small>
          </span>
          <input
            value={entry.title}
            placeholder="20자 이내 제목"
            onChange={(event) => onChange({ title: event.target.value })}
            disabled={disabled}
          />
        </label>

        <label className="lore-trigger-input">
          <span>
            트리거
            <span className="lore-field-tools">
              <small className={triggerCount > lorebookTriggerLimit ? "is-warning" : ""}>
                {triggerCount} / {lorebookTriggerLimit}
              </small>
              </span>
          </span>
          <input
            value={triggerText}
            placeholder="쉼표로 구분"
            onChange={(event) => onChange({
              triggers: event.target.value.split(",")
            })}
            disabled={disabled}
          />
        </label>

        <label className="lore-body-input">
          <span>
            본문
            <span className="lore-field-tools">
              <small className={entry.body.length > bodyLimit ? "is-warning" : ""}>
                {entry.body.length} / {lorebookBodyLimitLabel(bodyLimit)}
              </small>
              {!bodyUnavailable ? <TokenCount text={entry.body} /> : null}
              </span>
          </span>
          <AutoTextarea
            rows={13}
            value={entry.body}
            placeholder="로어북 본문을 입력하세요."
            onChange={(event) => onChange({ body: event.target.value })}
            disabled={disabled || bodyUnavailable}
          />
        </label>
      </div>
    </section>
  );
}
