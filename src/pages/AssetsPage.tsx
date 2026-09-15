import { AssetCommandBar } from "../features/assets/AssetCommandBar";
import { AssetEditor } from "../features/assets/AssetEditor";
import { AssetSidebar } from "../features/assets/AssetSidebar";
import { useAssetManager } from "../features/assets/useAssetManager";
import { useWorks } from "../features/works/WorkContext";
import "../styles/assets.css";

export function AssetsPage() {
  const { activeWorkId, activePlatformId, activeWork } = useWorks();
  const workKey = `${activeWorkId}::${activePlatformId}`;
  const manager = useAssetManager(workKey, activePlatformId);
  const disabled = manager.status === "loading" || manager.status === "saving";

  function createAsset() {
    const name = window.prompt(
      "새 HTML 에셋 파일명을 입력해 주세요.",
      "character_card.html"
    );
    if (name) void manager.createNewAsset(name);
  }

  if (manager.status === "loading" && !manager.assets.length) {
    return (
      <section className="asset-loading">
        <span />
        <strong>HTML 에셋을 불러오는 중입니다</strong>
        <p>{activeWork?.name ?? "현재 작품"}의 assets 폴더를 확인하고 있습니다.</p>
      </section>
    );
  }

  return (
    <div className="asset-page">
      <AssetCommandBar
        count={manager.assets.length}
        dirty={manager.dirty}
        message={manager.message}
        selectedName={manager.selectedName}
        status={manager.status}
        onCancel={manager.cancelChanges}
        onCreate={createAsset}
        onDelete={() => void manager.removeSelectedAsset()}
        onSave={() => void manager.saveChanges()}
      />

      {manager.status === "error" ? (
        <section className="asset-error" role="alert">{manager.message}</section>
      ) : null}

      <div className="asset-workspace">
        <AssetSidebar
          assets={manager.assets}
          disabled={disabled}
          selectedName={manager.selectedName}
          onSelect={(name) => void manager.selectAsset(name)}
        />
        <main className="asset-main">
          <AssetEditor
            content={manager.draftContent}
            disabled={disabled}
            mockData={manager.mockData}
            name={manager.selectedName}
            previewMode={manager.previewMode}
            variableMessage={manager.variableMessage}
            variableStatus={manager.variableStatus}
            variables={manager.variables}
            onContentChange={manager.updateDraft}
            onMockChange={manager.updateMockValue}
            onMockReset={manager.resetMockValues}
          />
        </main>
      </div>

    </div>
  );
}
