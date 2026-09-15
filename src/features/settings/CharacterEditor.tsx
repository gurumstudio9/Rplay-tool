import { ToolbarSlot } from "../workspace/WorkspaceSidebar";
import { AutoTextarea } from "../workspace/AutoTextarea";
import {
  genderLabels,
  groupLabels,
  type CharacterForm,
  type EditableField
} from "./model";

const textareaFields: Array<{
  field: EditableField;
  label: string;
  rows: number;
  placeholder?: string;
  maxLength?: number;
}> = [
  { field: "prompt", label: "프롬프트 (마크다운)", rows: 8, placeholder: "캐릭터 설정 중 AI가 참고할 프롬프트" },
  { field: "background", label: "배경", rows: 4 },
  { field: "introduction", label: "소개", rows: 2, maxLength: 300, placeholder: "사용자에게 보이는 짧은 캐릭터 개요" },
  { field: "notes", label: "메모", rows: 3 }
];

interface CharacterEditorProps {
  form: CharacterForm;
  draftMode: boolean;
  onUpdate: (field: keyof CharacterForm, value: string, immediate?: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSubmit: () => void;
  onBlur: () => void;
}

export function CharacterEditor({
  form,
  draftMode,
  onUpdate,
  onDuplicate,
  onDelete,
  onSubmit,
  onBlur
}: CharacterEditorProps) {
  return (
    <section className="settings-panel settings-editor-panel" tabIndex={-1}>
      <header className="settings-panel-header">
        <div>
          <span>EDITOR</span>
          <strong>{draftMode ? "새 캐릭터 설정" : form.name || "캐릭터 설정"}</strong>
        </div>
        <div className="settings-panel-actions">
          <button
            className="settings-button settings-button--ghost"
            type="button"
            disabled={draftMode}
            onClick={onDuplicate}
          >
            복제
          </button>
          <button
            className="settings-button settings-button--danger"
            type="button"
            disabled={draftMode}
            onClick={onDelete}
          >
            삭제
          </button>
        </div>
      </header>

      <form
        id="character-settings-form"
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        onBlurCapture={onBlur}
      >
        <div className="settings-form-grid">
          <label>
            표시 이름
            <input
              required
              value={form.name}
              onChange={(event) => onUpdate("name", event.target.value)}
              placeholder="예: 마리아"
            />
          </label>
          <label>
            영문 이름
            <input
              value={form.englishName}
              onChange={(event) => onUpdate("englishName", event.target.value)}
              placeholder="예: Maria"
            />
          </label>
          <label>
            ID
            <input
              required
              disabled={!draftMode}
              value={form.id}
              onChange={(event) => onUpdate("id", event.target.value)}
              placeholder="한글 또는 영문 ID"
            />
          </label>
          <label>
            코드
            <input
              value={form.folderCode}
              onChange={(event) => onUpdate("folderCode", event.target.value)}
              placeholder="폴더용 코드 · 예: a1"
            />
          </label>
          <label>
            분류
            <select
              value={form.group}
              onChange={(event) => onUpdate("group", event.target.value, true)}
            >
              {Object.entries(groupLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            소속
            <input
              value={form.faction}
              onChange={(event) => onUpdate("faction", event.target.value)}
              placeholder="예: 아카데미 1학년, 학생회"
            />
          </label>
          <label>
            성별
            <select
              value={form.gender}
              onChange={(event) => onUpdate("gender", event.target.value, true)}
            >
              {Object.entries(genderLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            키 (cm)
            <input
              type="number"
              min="1"
              max="999"
              value={form.heightCm}
              onChange={(event) => onUpdate("heightCm", event.target.value)}
              placeholder="예: 162"
            />
          </label>
          <label>
            머리장식 높이 (cm)
            <input
              type="number"
              min="0"
              max="999"
              step="0.1"
              value={form.headAccessoryHeightCm}
              onChange={(event) => onUpdate("headAccessoryHeightCm", event.target.value)}
              placeholder="없으면 비워두기"
            />
          </label>
          <label>
            가슴 크기
            <input
              value={form.bustSize}
              onChange={(event) => onUpdate("bustSize", event.target.value)}
              placeholder="예: F컵"
            />
          </label>
          <label>
            머리색
            <input
              value={form.hairColor}
              onChange={(event) => onUpdate("hairColor", event.target.value)}
              placeholder="예: 금발, 흑발, 은발"
            />
          </label>
          <label>
            머리길이
            <input
              value={form.hairLength}
              onChange={(event) => onUpdate("hairLength", event.target.value)}
              placeholder="예: 장발, 숏컷, 단발"
            />
          </label>
          <label>
            머리모양
            <input
              value={form.hairStyle}
              onChange={(event) => onUpdate("hairStyle", event.target.value)}
              placeholder="예: 생머리, 웨이브, 포니테일"
            />
          </label>
          <label>
            눈색
            <input
              value={form.eyeColor}
              onChange={(event) => onUpdate("eyeColor", event.target.value)}
              placeholder="예: 청안, 적안, 금안"
            />
          </label>
          <label>
            피부색
            <input
              value={form.skinColor}
              onChange={(event) => onUpdate("skinColor", event.target.value)}
              placeholder="예: 백옥 피부, 구릿빛 피부"
            />
          </label>
          <label className="settings-span-2">
            별칭
            <input
              value={form.aliases}
              onChange={(event) => onUpdate("aliases", event.target.value)}
              placeholder="쉼표로 구분"
            />
          </label>
          <label className="settings-span-2">
            역할/신분
            <input
              value={form.role}
              onChange={(event) => onUpdate("role", event.target.value)}
              placeholder="예: 유폐된 황녀, 전담 시녀, 경비 총괄"
            />
          </label>

          {textareaFields.map(({ field, label, rows, placeholder, maxLength }) => (
            <label className="settings-span-2" key={field}>
              <span className="settings-label-row">
                <span>{label}{field === "introduction" ? " (최대 300자)" : ""}</span>
                {field === "prompt" ? <small>{form.prompt.length}자</small> : null}
              </span>
              <AutoTextarea
                rows={rows}
                value={form[field]}
                maxLength={maxLength}
                placeholder={placeholder}
                onChange={(event) => onUpdate(field, event.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="settings-form-footer">
          <span>입력 내용은 잠시 후 자동으로 저장됩니다.</span>
          <ToolbarSlot slot="save"><button className="settings-button settings-button--primary" type="submit" form="character-settings-form">
            지금 저장
          </button></ToolbarSlot>
        </div>
      </form>
    </section>
  );
}
