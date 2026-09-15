import { ToolbarSlot, SidebarSection } from "../workspace/WorkspaceSidebar";
import { ManagementMenu } from "../workspace/ManagementMenu";
import type { ChangeEvent } from "react";

export type SaveState =
  | "loading"
  | "idle"
  | "typing"
  | "saving"
  | "saved"
  | "error";

interface SettingsCommandBarProps {
  managementTools?: import("react").ReactNode;
  saveState: SaveState;
  statusMessage: string;
  onCreate: () => void;
  onCopySummary: () => void;
  onCopyList: () => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
}

function saveLabel(state: SaveState, message: string) {
  if (message) return message;
  if (state === "loading") return "불러오는 중";
  if (state === "typing") return "입력 중";
  if (state === "saving") return "저장 중";
  if (state === "saved") return "저장됨";
  if (state === "error") return "저장 오류";
  return "준비됨";
}

export function SettingsCommandBar({
  managementTools,
  saveState,
  statusMessage,
  onCreate,
  onCopySummary,
  onCopyList,
  onExport,
  onImport
}: SettingsCommandBarProps) {
  return (
    <SidebarSection order={10}>
      <section className="settings-command-bar">
      <div className="settings-title">
        <span className="settings-kicker">MIGRATED TOOL 01</span>
        <div>
          <h1>캐릭터 설정</h1>
          <ToolbarSlot slot="status"><span className={`settings-save-state settings-save-state--${saveState}`}>
            <i />
            {saveLabel(saveState, statusMessage)}
          </span></ToolbarSlot>
        </div>
        <p>공용 캐릭터 정의와 플랫폼 입력용 프롬프트를 한곳에서 관리합니다.</p>
      </div>
      <ManagementMenu>
        <div className="settings-actions">
          <div className="settings-action-group">
            <span>편집</span>
            <ToolbarSlot slot="actions"><button className="settings-button settings-button--primary" type="button" onClick={onCreate}>
              새 캐릭터
            </button></ToolbarSlot>
          </div>
          <div className="settings-action-group">
            <span>데이터</span>
            <ToolbarSlot slot="actions"><button className="settings-button" type="button" onClick={onCopySummary}>
              요약 복사
            </button></ToolbarSlot>
            <button className="settings-button" type="button" onClick={onCopyList}>
              목록 복사
            </button>
            <button className="settings-button" type="button" onClick={onExport}>
              JSON 내보내기
            </button>
            <label className="settings-button settings-file-button">
              JSON 가져오기
              <input type="file" accept="application/json" onChange={onImport} />
            </label>
          </div>
        </div>
        {managementTools}
      </ManagementMenu>
    </section>
      </SidebarSection>
  );
}
