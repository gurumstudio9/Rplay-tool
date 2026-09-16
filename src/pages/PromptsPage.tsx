import { useState } from "react";
import { PromptCommandBar } from "../features/prompts/PromptCommandBar";
import { PromptDiffPanel } from "../features/prompts/PromptDiffPanel";
import { PromptEditor } from "../features/prompts/PromptEditor";
import { PromptLorebookSidebar } from "../features/prompts/PromptLorebookSidebar";
import { PromptTabs } from "../features/prompts/PromptTabs";
import { PromptTokenUsage } from "../features/prompts/PromptTokenUsage";
import { PromptVersionDialog } from "../features/prompts/PromptVersionDialog";
import { PromptVersionList } from "../features/prompts/PromptVersionList";
import { RplayVariableEditor } from "../features/prompts/RplayVariableEditor";
import { RplayAchievementEditor } from "../features/prompts/RplayAchievementEditor";
import { promptTextForTab } from "../features/prompts/model";
import { copyText } from "../features/prompts/platform";
import { usePromptLorebook } from "../features/prompts/usePromptLorebook";
import { usePromptManager } from "../features/prompts/usePromptManager";
import { useWorks } from "../features/works/WorkContext";
import { storyPromptText } from "../features/rplay/canvasContent";
import { HelpButton } from "../features/help/HelpButton";
import type { HelpTopicId } from "../features/help/topics";
import "../styles/prompts.css";
import "../styles/prompts-editor.css";
import "../styles/prompts-lorebook.css";

export function PromptsPage() {
  const { activeWorkId, activePlatformId, activeWork } = useWorks();
  const workKey = `${activeWorkId}::${activePlatformId}`;
  const manager = usePromptManager(workKey);
  const lorebook = usePromptLorebook(workKey);
  const [lorebookOpen, setLorebookOpen] = useState(
    () => localStorage.getItem("prompt-manager-show-sidebar") !== "false"
  );

  function toggleLorebook() {
    setLorebookOpen((current) => {
      const next = !current;
      localStorage.setItem("prompt-manager-show-sidebar", String(next));
      return next;
    });
  }

  if (manager.saveState === "loading") {
    return (
      <section className="prompt-loading">
        <span />
        <strong>작품 프롬프트를 불러오는 중입니다</strong>
        <p>{activeWork?.name ?? "현재 작품"}의 Markdown 본문을 연결하고 있습니다.</p>
      </section>
    );
  }

  if (!manager.loaded) {
    return (
      <section className="prompt-loading" role="alert">
        <strong>작품 프롬프트를 불러오지 못했습니다</strong>
        <p>{manager.statusMessage}</p>
        <button className="prompt-button" type="button" onClick={manager.reload}>다시 불러오기</button>
      </section>
    );
  }

  const showVersionList = manager.activeTab !== "variables"
    && manager.activeTab !== "achievements"
    && !manager.focusMode;
  const tabHelp: Partial<Record<typeof manager.activeTab, HelpTopicId>> = {
    mainPrompt: "mainPrompt", additionalPrompt: "additionalPrompt", worldStory: "worldStory", starterPrompt: "starterPrompt",
    starterMessage: "starterMessage", variables: "variables", achievements: "achievements"
  };

  return (
    <div className={manager.focusMode ? "prompt-page is-focused" : "prompt-page"}>
      <PromptCommandBar
        saveState={manager.saveState}
        dirty={manager.dirty}
        onSave={() => void manager.saveNow()}
        onDiscard={manager.discardChanges}
        statusMessage={manager.statusMessage}
        versionCount={manager.state.versions.length}
        mainCharacters={manager.state.mainPrompt.length}
        lorebookOpen={lorebookOpen}
        onCreateVersion={manager.openCreateVersion}
        onToggleLorebook={toggleLorebook}
        onExport={() => void manager.exportJson()}
        onImport={(event) => void manager.importJson(event)}
      />

      <header className="prompt-page-header" aria-label="편집 항목">
        <div className="prompt-node-heading">
          <span className="prompt-node-kind">{manager.activeVersion?.nodeType === "normal" ? "일반 노드" : "시작 노드"}</span>
          <strong>{manager.activeVersion?.name ?? "노드를 추가해 주세요"}</strong>
          {manager.activeVersion ? <button className="prompt-button" type="button" onClick={() => manager.openEditVersion(manager.activeVersion!.id)}>노드 설정</button> : null}
        </div>
        <PromptTabs
          activeTab={manager.activeTab}
          onChange={manager.setActiveTab}
          nodeType={manager.activeVersion?.nodeType ?? "start"}
        />
        <div className="feature-help-context">이 항목 사용법 <HelpButton topic={tabHelp[manager.activeTab] ?? "prompts"} /></div>
        <p className="prompt-canvas-mapping">중요 정보 = 각 노드의 메인 + 에디셔널 (4,300토큰) · 전체 스토리 (30,000토큰) · 시작 노드만 시작 메시지 (1,000토큰)와 시작 가이드 (300토큰)를 사용합니다.</p>
      </header>

      {manager.activeTab === "variables" ? (
        <RplayVariableEditor workKey={workKey} />
      ) : manager.activeTab === "achievements" ? (
        <RplayAchievementEditor workKey={workKey} />
      ) : (
        <div className={[
          "prompt-workspace",
          showVersionList ? "has-versions" : "",
          lorebookOpen && !manager.focusMode ? "has-lorebook" : ""
        ].filter(Boolean).join(" ")}>
          {showVersionList ? (
            <PromptVersionList
              versions={manager.state.versions}
              activeVersionId={manager.state.activeVersionId}
              activeTab={manager.activeTab}
              onSelect={manager.selectVersion}
              onMove={manager.moveVersion}
              onCopy={(version) => {
                void copyText(
                  promptTextForTab(manager.state, manager.activeTab, version)
                ).then(() => manager.announce(`${version.name} 복사됨`));
              }}
              onEdit={manager.openEditVersion}
            />
          ) : null}

          <div className="prompt-center-column">
            {manager.activeTab !== "suggestedReplies" ? (
              <PromptTokenUsage
                key={`${workKey}:${manager.activeTab}`}
                storageKey={`prompt-token-limit:${workKey}:${manager.activeTab}`}
                text={manager.activeText}
                combinedText={manager.activeTab === "mainPrompt" || manager.activeTab === "additionalPrompt"
                  ? storyPromptText(manager.state.mainPrompt, manager.activeVersion?.additionalPrompt)
                  : undefined}
                defaultLimit={manager.activeTab === "mainPrompt" || manager.activeTab === "additionalPrompt" ? 4300 : manager.activeTab === "worldStory" ? 30000 : manager.activeTab === "starterMessage" ? 1000 : manager.activeTab === "starterPrompt" ? 300 : undefined}
              />
            ) : null}
            <PromptEditor
              versions={manager.state.versions}
              activeVersion={manager.activeVersion}
              activeTab={manager.activeTab}
              activeText={manager.activeText}
              focusMode={manager.focusMode}
              insertionRequest={manager.insertionRequest}
              onSelectVersion={manager.selectVersion}
              onTextChange={manager.updateActiveText}
              onSuggestedReplyChange={manager.updateSuggestedReply}
              onConsumeInsertion={manager.consumeInsertion}
              onToggleFocus={manager.toggleFocusMode}
              onCopyActive={() => void manager.copyActive()}
              onCopyAll={() => void manager.copyAll()}
              onToggleDiff={() => manager.setShowDiff(!manager.showDiff)}
              diffOpen={manager.showDiff}
            />
            <PromptDiffPanel
              open={manager.showDiff}
              tab={manager.activeTab}
              lines={manager.diffLines}
              versionCount={manager.state.versions.length}
            />
          </div>

          {lorebookOpen && !manager.focusMode ? (
            <PromptLorebookSidebar
              open
              lorebook={lorebook}
              onClose={toggleLorebook}
              onInsert={manager.requestInsertion}
            />
          ) : null}
        </div>
      )}

      <PromptVersionDialog
        open={manager.versionDialogOpen}
        editing={Boolean(manager.editingVersionId)}
        draft={manager.versionDraft}
        field={manager.versionDraftTab}
        onClose={manager.closeVersionDialog}
        onChange={manager.updateVersionDraft}
        onSave={manager.saveVersionDraft}
        onDelete={() => {
          if (manager.editingVersionId) {
            manager.deleteVersion(manager.editingVersionId);
          }
        }}
      />
    </div>
  );
}
