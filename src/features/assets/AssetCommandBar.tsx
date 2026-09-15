import { ToolbarSlot, SidebarSection } from "../workspace/WorkspaceSidebar";
import { ManagementMenu } from "../workspace/ManagementMenu";
import type { AssetStatus } from "./model";

type AssetCommandBarProps = {
  managementTools?: import("react").ReactNode;
  count: number;
  selectedName: string;
  dirty: boolean;
  status: AssetStatus;
  message: string;
  onCreate: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

export function AssetCommandBar({
  managementTools,
  count,
  selectedName,
  dirty,
  status,
  message,
  onCreate,
  onSave,
  onCancel,
  onDelete,
}: AssetCommandBarProps) {
  const busy = status === "loading" || status === "saving";

  return (
    <SidebarSection order={10}>
      <section className="asset-command-bar">
      <div className="asset-command-summary">
        <span>ASSET WORKSPACE</span>
        <strong>{count}개 HTML 템플릿</strong>
        <ToolbarSlot slot="status"><small className={`asset-status asset-status--${status}`}>
          {dirty ? "저장 안 됨" : message || "저장됨"}
        </small></ToolbarSlot>
      </div>
      <ManagementMenu>
        <div className="asset-command-groups">
          <div>
            <span>편집</span>
            <ToolbarSlot slot="actions"><button disabled={busy} onClick={onCreate} type="button">+ 새 에셋</button></ToolbarSlot>
            <ToolbarSlot slot="save"><button disabled={!selectedName || !dirty || busy} onClick={onSave} type="button">
              변경 저장
            </button></ToolbarSlot>
            <button disabled={!dirty || busy} onClick={onCancel} type="button">변경 취소</button>
            <button
              className="asset-danger-button"
              disabled={!selectedName || busy}
              onClick={onDelete}
              type="button"
            >
              삭제
            </button>
          </div>
        </div>
        {managementTools}
      </ManagementMenu>
    </section>
      </SidebarSection>
  );
}
