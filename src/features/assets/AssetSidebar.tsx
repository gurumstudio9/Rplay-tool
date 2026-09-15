import { SidebarSection } from "../workspace/WorkspaceSidebar";
import type { AssetSummary } from "./model";

type AssetSidebarProps = {
  assets: AssetSummary[];
  selectedName: string;
  disabled: boolean;
  onSelect: (name: string) => void;
};

export function AssetSidebar({
  assets,
  selectedName,
  disabled,
  onSelect
}: AssetSidebarProps) {
  return (
    <SidebarSection order={21} title="에셋 선택">
      <aside className="asset-sidebar">
      <div className="asset-sidebar-heading">
        <span>HTML FILES</span>
        <strong>{assets.length}</strong>
      </div>
      <div className="asset-file-list">
        {assets.length ? assets.map((asset) => (
          <button
            className={asset.name === selectedName ? "is-active" : ""}
            disabled={disabled}
            key={asset.name}
            onClick={() => onSelect(asset.name)}
            type="button"
          >
            <span>{asset.name}</span>
            <small>HTML</small>
          </button>
        )) : (
          <p>이 작품에는 HTML 에셋이 없습니다.</p>
        )}
      </div>
    </aside>
      </SidebarSection>
  );
}
