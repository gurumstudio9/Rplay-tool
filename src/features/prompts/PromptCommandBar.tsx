import { ToolbarSlot, SidebarSection } from "../workspace/WorkspaceSidebar";
import { ManagementMenu } from "../workspace/ManagementMenu";
import type { ChangeEvent } from "react";
import type { SaveState } from "../settings/SettingsCommandBar";

interface PromptCommandBarProps {
  managementTools?: import("react").ReactNode;
  saveState: SaveState;
  dirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  statusMessage: string;
  versionCount: number;
  mainCharacters: number;
  lorebookOpen: boolean;
  onCreateVersion: () => void;
  onToggleLorebook: () => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
}

function saveLabel(state: SaveState, message: string, dirty: boolean) {
  if (state === "saving") return "저장 중";
  if (state === "error") return message || "저장 오류";
  if (dirty) return "미저장 변경사항";
  if (message) return message;
  if (state === "loading") return "불러오는 중";
  if (state === "typing") return "미저장 변경사항";
  if (state === "saved") return "저장됨";
  return "준비됨";
}

export function PromptCommandBar({
  managementTools,
  saveState,
  dirty,
  onSave,
  onDiscard,
  statusMessage,
  versionCount,
  mainCharacters,
  lorebookOpen,
  onCreateVersion,
  onToggleLorebook,
  onExport,
  onImport
}: PromptCommandBarProps) {
  return (
    <SidebarSection order={10}>
      <section className="prompt-command-bar">
      <div className="prompt-title">
        <span className="prompt-kicker">NODE PROMPTS</span>
        <div>
          <h1>노드 프롬프트</h1>
          <ToolbarSlot slot="status"><span className={`prompt-save-state prompt-save-state--${dirty && saveState !== "saving" && saveState !== "error" ? "typing" : saveState}`}>
            <i />
            {saveLabel(saveState, statusMessage, dirty)}
          </span></ToolbarSlot>
        </div>
        <p>수정한 내용은 저장 버튼을 눌러 반영합니다.</p>
      </div>

      <dl className="prompt-overview" aria-label="프롬프트 현황">
        <div>
          <dt>노드</dt>
          <dd>{versionCount}<small>개</small></dd>
        </div>
        <div>
          <dt>메인</dt>
          <dd>{mainCharacters.toLocaleString()}<small>자</small></dd>
        </div>
      </dl>

      <ManagementMenu>
        <div className="prompt-actions">
          <div className="prompt-action-group">
            <span>저장</span>
            <ToolbarSlot slot="save"><button className="prompt-button prompt-button--primary" type="button" disabled={!dirty || saveState === "saving"} onClick={onSave} title="Ctrl+S / ⌘S">
              {saveState === "saving" ? "저장 중…" : "저장"}
            </button></ToolbarSlot>
            <button className="prompt-button" type="button" disabled={!dirty || saveState === "saving"} onClick={onDiscard}>
              변경 취소
            </button>
          </div>
          <div className="prompt-action-group">
            <span>편집</span>
            <button
              className="prompt-button prompt-button--primary"
              type="button"
              onClick={onCreateVersion}
            >
              노드 추가
            </button>
            <ToolbarSlot slot="actions"><button
              className={lorebookOpen
                ? "prompt-button prompt-button--active"
                : "prompt-button"}
              type="button"
              onClick={onToggleLorebook}
            >
              로어북 사전
            </button></ToolbarSlot>
          </div>

          <div className="prompt-action-group">
            <span>데이터</span>
            <button className="prompt-button" type="button" onClick={onExport}>
              JSON 내보내기
            </button>
            <label className="prompt-button prompt-file-button">
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
