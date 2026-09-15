import { ToolbarSlot, SidebarSection } from "../workspace/WorkspaceSidebar";
import { ManagementMenu } from "../workspace/ManagementMenu";
import { useRef } from "react";
import type {
  LorebookPlatformAction
} from "./platform/useLorebookPlatformCopy";
import type { LorebookSaveStatus } from "./useLorebookManager";

type Props = {
  managementTools?: import("react").ReactNode;
  entryCount: number;
  dirty: boolean;
  status: LorebookSaveStatus;
  message: string;
  invalidJsonCount: number;
  bulkMode: boolean;
  onAdd: () => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleBulk: () => void;
  onSplitMarkdown: () => void;
  onPlatform: (action: LorebookPlatformAction) => void;
  onCopyAll: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

function statusLabel(status: LorebookSaveStatus, dirty: boolean) {
  if (status === "loading") return "불러오는 중";
  if (status === "saving") return "저장 중";
  if (status === "error") return "확인 필요";
  return dirty ? "저장 안 됨" : "저장됨";
}

export function LorebookCommandBar({
  managementTools,
  entryCount,
  dirty,
  status,
  message,
  invalidJsonCount,
  bulkMode,
  onAdd,
  onSave,
  onCancel,
  onToggleBulk,
  onSplitMarkdown,
  onPlatform,
  onCopyAll,
  onExport,
  onImport
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = status === "loading" || status === "saving";

  return (
    <SidebarSection order={10}>
      <section className="lore-command-surface">
      <div className="lore-command-heading">
        <div>
          <span className="eyebrow">LOREBOOK WORKSPACE</span>
          <h1>작품 로어북</h1>
          <p>설정집 항목과 호출 키워드를 draft로 편집한 뒤 JSON/MD 쌍으로 저장합니다.</p>
        </div>
        <div className="lore-command-stats">
          <span>
            <small>항목</small>
            <strong>{entryCount}</strong>
          </span>
          <ToolbarSlot slot="status"><span className={`lore-save-chip lore-save-chip--${status}${dirty ? " is-dirty" : ""}`}>
            {statusLabel(status, dirty)}
          </span></ToolbarSlot>
        </div>
      </div>

      <ManagementMenu>
        <div className="lore-command-groups">
          <div className="lore-command-group">
            <span>편집</span>
            <div>
              <ToolbarSlot slot="actions"><button type="button" className="is-primary" onClick={onAdd} disabled={disabled}>
                + 항목 추가
              </button></ToolbarSlot>
              <ToolbarSlot slot="save"><button type="button" className="is-primary" onClick={onSave} disabled={disabled || !dirty || invalidJsonCount > 0}>
                변경 저장
              </button></ToolbarSlot>
              <button type="button" onClick={onCancel} disabled={disabled || !dirty}>
                변경 취소
              </button>
              <button
                type="button"
                className={bulkMode ? "is-active" : ""}
                aria-pressed={bulkMode}
                onClick={onToggleBulk}
                disabled={disabled}
              >
                {bulkMode ? "일괄 편집 종료" : "일괄 편집"}
              </button>
              <button type="button" onClick={onSplitMarkdown} disabled={disabled}>
                본문 MD 분리
              </button>
            </div>
          </div>

          <div className="lore-command-group">
            <span>알플레이</span>
            <div><button type="button" data-platform="rplay" onClick={() => onPlatform("rplay-sync")} disabled={disabled}>알플레이 입력 복사</button></div>
          </div>

          <div className="lore-command-group">
            <span>데이터</span>
            <div>
              <button type="button" data-tone="data" onClick={onCopyAll} disabled={disabled}>
                전체 텍스트 복사
              </button>
              <button type="button" data-tone="data" onClick={onExport} disabled={disabled}>
                JSON 내보내기
              </button>
              <button type="button" data-tone="data" onClick={() => fileRef.current?.click()} disabled={disabled}>
                JSON 가져오기
              </button>
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept="application/json"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) onImport(file);
                  event.currentTarget.value = "";
                }}
              />
            </div>
          </div>
        </div>
        {managementTools}
      </ManagementMenu>

      <div className={`lore-command-message lore-command-message--${status}`} aria-live="polite">
        <span aria-hidden="true" />
        {invalidJsonCount
          ? `파싱할 수 없는 로어북 JSON ${invalidJsonCount}개가 있습니다.`
          : message || "저장 전까지 변경은 현재 화면의 draft에만 유지됩니다."}
      </div>
    </section>
      </SidebarSection>
  );
}
