import { ToolbarSlot, SidebarSection } from "../workspace/WorkspaceSidebar";
import { Fragment, useMemo, useState } from "react";
import { listAssets, loadAsset } from "../assets/api";
import { loadLorebook } from "../lorebook/api";
import { loadPromptState, loadRplayAchievements, loadRplayUpdateRules, loadRplayVariables } from "../prompts/api";
import type { RplayAchievement, RplayUpdateRule } from "../prompts/model";
import { loadCharacters } from "../settings/api";
import { groupLabels } from "../settings/model";
import {
  addCanvasAchievementWithTrigger,
  addCanvasCharacter,
  addCanvasLorebook,
  addCanvasUpdateRule,
  addCanvasVariable,
  assertEditableCanvas,
  arrangeCanvasContentNodes,
  compareCanvasAchievements,
  compareCanvasCharacters,
  compareCanvasLorebooks,
  compareCanvasStories,
  compareCanvasStatusViews,
  compareCanvasUpdateRules,
  compareCanvasVariables,
  deleteCanvasNode,
  injectAllAchievementsWithTriggers,
  syncCanvasVariableRuleConnections,
  updateCanvasAchievementWithTrigger,
  updateCanvasCharacter,
  updateCanvasLorebook,
  updateCanvasStatusView,
  updateCanvasStory,
  updateCanvasUpdateRule,
  updateCanvasVariable,
  type CanvasAchievementRow,
  type CanvasContentStatus,
  type CanvasStoryRow,
  type CanvasTextDiff,
  type StatusViewAssetSource
} from "./canvasContent";
import { downloadJson, readJsonFile, safeFilenamePart } from "./files";
import type { JsonObject } from "./model";
import { RplayFeedbackPanel } from "./RplayFeedbackPanel";
import { RplayCanvasHubImport } from "./RplayCanvasHubImport";
import { canvasBatchItems } from "./canvasBatch";
import { RplayCanvasBatchPanel } from "./RplayCanvasBatchPanel";
import { HelpButton } from "../help/HelpButton";
import type { HelpTopicId } from "../help/topics";

type EditorTab = "lorebook" | "character" | "variable" | "updateRule" | "statusView" | "story" | "achievement" | "hub";

const tabHelp: Record<EditorTab, HelpTopicId> = {
  lorebook: "lorebook", character: "canvasCharacter", variable: "variables", updateRule: "variables",
  statusView: "assets", story: "prompts", achievement: "achievements", hub: "canvasHub"
};

type RplayCanvasContentEditorProps = {
  workId: string;
  workName: string;
};

const statusLabels: Record<CanvasContentStatus, string> = {
  exact: "동일",
  changed: "갱신 필요",
  "source-only": "원본에만 있음",
  "canvas-only": "레거시 후보",
  duplicate: "중복 확인"
};

const storyStatusLabels: Record<CanvasStoryRow["status"], string> = {
  exact: "완전 일치",
  included: "조합 프롬프트 포함",
  different: "내용 차이",
  "empty-source": "원본 비어 있음",
  unmatched: "매칭 안 됨"
};

const statusViewStatusLabels: Record<CanvasContentStatus, string> = {
  ...statusLabels,
  "canvas-only": "에셋 매칭 없음"
};

function statusClass(status: CanvasContentStatus | CanvasStoryRow["status"]) {
  if (status === "exact" || status === "included") return "is-exact";
  if (status === "changed" || status === "different") return "is-changed";
  if (status === "canvas-only") return "is-legacy";
  if (status === "duplicate" || status === "unmatched") return "is-error";
  return "is-muted";
}

function comparedValue(value: unknown) {
  if (value === undefined) return "(없음)";
  if (typeof value === "string") return value || "(빈 문자열)";
  return JSON.stringify(value) ?? String(value);
}

function ContentDifference({
  items
}: {
  items: Array<{ label: string; canvas: unknown; source: unknown }>;
}) {
  return (
    <div className="rplay-content-diff">
      {items.map((item) => (
        <section key={item.label}>
          <strong>{item.label}</strong>
          <div><span>캔버스</span><pre>{comparedValue(item.canvas)}</pre></div>
          <div><span>로컬 원본</span><pre>{comparedValue(item.source)}</pre></div>
        </section>
      ))}
    </div>
  );
}

function StoryTextDifference({
  label,
  diff
}: {
  label: string;
  diff: CanvasTextDiff;
}) {
  return (
    <section className="rplay-story-diff">
      <header>
        <b>{label}</b>
        <small>
          캔버스 → 로컬 원본 · <i className="is-add">+{diff.addedChars}자</i>
          {" / "}<i className="is-remove">−{diff.removedChars}자</i>
          {" / "}변경 비중 {diff.changeRatio}%
        </small>
      </header>
      <pre>
        {diff.parts.length ? diff.parts.map((part, index) => (
          <span key={`${part.type}:${index}`} className={`is-${part.type}`}>{part.text}</span>
        )) : "(둘 다 비어 있음)"}
      </pre>
    </section>
  );
}

export function RplayCanvasContentEditor({
  workId,
  workName
}: RplayCanvasContentEditorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [originalCanvas, setOriginalCanvas] = useState<JsonObject | null>(null);
  const [draftCanvas, setDraftCanvas] = useState<JsonObject | null>(null);
  const [lorebookSources, setLorebookSources] = useState<Awaited<ReturnType<typeof loadLorebook>>["entries"]>([]);
  const [characterSources, setCharacterSources] = useState<Awaited<ReturnType<typeof loadCharacters>>>([]);
  const [variableSources, setVariableSources] = useState<Awaited<ReturnType<typeof loadRplayVariables>>["variables"]>([]);
  const [updateRuleSources, setUpdateRuleSources] = useState<RplayUpdateRule[]>([]);
  const [achievementSources, setAchievementSources] = useState<RplayAchievement[]>([]);
  const [statusViewSources, setStatusViewSources] = useState<StatusViewAssetSource[]>([]);
  const [promptSource, setPromptSource] = useState<Awaited<ReturnType<typeof loadPromptState>> | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("lorebook");
  const [busy, setBusy] = useState(false);
  const [changeCount, setChangeCount] = useState(0);
  const [selectedLorebookIds, setSelectedLorebookIds] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedDifferenceId, setExpandedDifferenceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);

  const lorebookRows = useMemo(
    () => draftCanvas ? compareCanvasLorebooks(draftCanvas, lorebookSources) : [],
    [draftCanvas, lorebookSources]
  );
  const characterRows = useMemo(
    () => draftCanvas ? compareCanvasCharacters(draftCanvas, characterSources) : [],
    [draftCanvas, characterSources]
  );
  const updateRuleRows = useMemo(
    () => draftCanvas ? compareCanvasUpdateRules(draftCanvas, updateRuleSources) : [],
    [draftCanvas, updateRuleSources]
  );
  const variableRows = useMemo(
    () => draftCanvas ? compareCanvasVariables(draftCanvas, variableSources) : [],
    [draftCanvas, variableSources]
  );
  const achievementRows = useMemo(
    () => draftCanvas ? compareCanvasAchievements(draftCanvas, achievementSources, variableSources) : [],
    [draftCanvas, achievementSources, variableSources]
  );
  const statusViewRows = useMemo(
    () => draftCanvas ? compareCanvasStatusViews(draftCanvas, statusViewSources) : [],
    [draftCanvas, statusViewSources]
  );
  const storyRows = useMemo(
    () => draftCanvas && promptSource
      ? compareCanvasStories(draftCanvas, promptSource, { includeWorldStory: true })
      : [],
    [draftCanvas, promptSource]
  );

  async function loadCanvas(nextFile: File | null) {
    setFile(nextFile);
    setOriginalCanvas(null);
    setDraftCanvas(null);
    setChangeCount(0);
    setSelectedLorebookIds(new Set());
    setStatusViewSources([]);
    setExpandedDifferenceId(null);
    if (!nextFile) {
      setFeedback(null);
      return;
    }

    setBusy(true);
    setFeedback({ tone: "info", text: "캔버스와 현재 작품 자료를 비교하고 있습니다." });
    try {
      const [canvas, lorebook, characters, prompts, variableData, updateRules, achvList, statusViewAssets] = await Promise.all([
        readJsonFile(nextFile),
        loadLorebook(workId),
        loadCharacters(workId),
        loadPromptState(workId),
        loadRplayVariables(workId),
        loadRplayUpdateRules(workId),
        loadRplayAchievements(workId),
        listAssets(workId).then(({ assets }) => Promise.all(
          assets.map(async (asset) => ({
            name: asset.name,
            content: await loadAsset(workId, asset.name)
          }))
        ))
      ]);
      assertEditableCanvas(canvas);
      setOriginalCanvas(canvas);
      setDraftCanvas(structuredClone(canvas));
      setLorebookSources(lorebook.entries);
      setCharacterSources(characters);
      setVariableSources(variableData.variables);
      setUpdateRuleSources(updateRules);
      setAchievementSources(achvList);
      setStatusViewSources(statusViewAssets);
      setPromptSource(prompts);
      setFeedback({
        tone: "success",
        text: `비교 준비 완료: 로어북 ${lorebook.entries.length}개, 인물 ${characters.length}개, 변수 ${variableData.variables.length}개, 업적 ${achvList.length}개, 규칙 ${updateRules.length}개, HTML ${statusViewAssets.length}개, 프롬프트 ${prompts.versions.length}개`
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "캔버스를 불러오지 못했습니다."
      });
    } finally {
      setBusy(false);
    }
  }

  function applyLorebook(row: typeof lorebookRows[number]) {
    if (!draftCanvas || !row.nodeUid || !row.source) return;
    setDraftCanvas(updateCanvasLorebook(draftCanvas, row.nodeUid, row.source));
    setExpandedDifferenceId(null);
    setSelectedLorebookIds((current) => {
      const next = new Set(current);
      next.delete(row.id);
      return next;
    });
    setChangeCount((count) => count + 1);
    setFeedback({ tone: "success", text: `${row.title} 로어북을 원본 내용으로 갱신했습니다.` });
  }

  function toggleLorebookSelection(id: string) {
    setSelectedLorebookIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllChangedLorebooks() {
    setSelectedLorebookIds(new Set(
      lorebookRows
        .filter((row) => row.status === "changed" && row.nodeUid && row.source)
        .map((row) => row.id)
    ));
  }

  function applySelectedLorebooks() {
    if (!draftCanvas) return;
    const rows = lorebookRows.filter(
      (row) => row.status === "changed"
        && row.nodeUid
        && row.source
        && selectedLorebookIds.has(row.id)
    );
    if (!rows.length) return;
    try {
      const next = rows.reduce(
        (canvas, row) => updateCanvasLorebook(canvas, row.nodeUid!, row.source!),
        draftCanvas
      );
      setDraftCanvas(next);
      setSelectedLorebookIds(new Set());
      setExpandedDifferenceId(null);
      setChangeCount((count) => count + rows.length);
      setFeedback({ tone: "success", text: `선택한 로어북 ${rows.length}개를 원본 내용으로 갱신했습니다.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "선택한 로어북을 일괄 갱신하지 못했습니다."
      });
    }
  }

  function addLorebook(row: typeof lorebookRows[number]) {
    if (!draftCanvas || !row.source || row.status !== "source-only") return;
    try {
      setDraftCanvas(addCanvasLorebook(draftCanvas, row.source));
      setChangeCount((count) => count + 1);
      setFeedback({ tone: "success", text: `${row.title} 로어북 노드를 추가했습니다. 연결은 허브 관리에서 설정하세요.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "신규 로어북을 추가하지 못했습니다."
      });
    }
  }


  function removeLegacyLorebook(row: typeof lorebookRows[number]) {
    if (!draftCanvas || !row.nodeUid || row.status !== "canvas-only") return;
    if (!window.confirm(`캔버스에서 레거시 로어북 “${row.title}”을 삭제할까요?\n노드, 메타데이터, 연결선이 수정본에서 함께 제거됩니다.`)) {
      return;
    }
    setDraftCanvas(deleteCanvasNode(draftCanvas, row.nodeUid));
    setChangeCount((count) => count + 1);
    setFeedback({ tone: "success", text: `${row.title} 레거시 로어북을 수정본에서 제거했습니다.` });
  }


  function applyCharacter(row: typeof characterRows[number]) {
    if (!draftCanvas || !row.nodeUid || !row.source) return;
    setDraftCanvas(updateCanvasCharacter(draftCanvas, row.nodeUid, row.source));
    setExpandedDifferenceId(null);
    setChangeCount((count) => count + 1);
    setFeedback({ tone: "success", text: `${row.name} 인물 노드의 MD 프롬프트와 배경을 갱신했습니다.` });
  }

  function applyAllCharacters() {
    if (!draftCanvas) return;
    const rows = characterRows.filter(
      (row) => row.status === "changed" && row.nodeUid && row.source
    );
    if (!rows.length) return;
    const next = rows.reduce(
      (canvas, row) => updateCanvasCharacter(canvas, row.nodeUid!, row.source!),
      draftCanvas
    );
    setDraftCanvas(next);
    setExpandedDifferenceId(null);
    setChangeCount((count) => count + rows.length);
    setFeedback({ tone: "success", text: `갱신 필요 인물 ${rows.length}명의 MD 프롬프트와 배경을 모두 갱신했습니다.` });
  }

  function addCharacter(row: typeof characterRows[number]) {
    if (!draftCanvas || !row.source || row.status !== "source-only") return;
    try {
      setDraftCanvas(addCanvasCharacter(draftCanvas, row.source));
      setChangeCount((count) => count + 1);
      setFeedback({ tone: "success", text: `${row.name} 인물 노드를 추가했습니다. 연결은 허브 관리에서 설정하세요.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "신규 인물 노드를 추가하지 못했습니다."
      });
    }
  }


  function applyUpdateRule(row: typeof updateRuleRows[number]) {
    if (!draftCanvas || !row.nodeUid || !row.source) return;
    const updated = updateCanvasUpdateRule(draftCanvas, row.nodeUid, row.source);
    setDraftCanvas(syncCanvasVariableRuleConnections(updated, variableSources, updateRuleSources));
    setExpandedDifferenceId(null);
    setChangeCount((count) => count + 1);
    setFeedback({ tone: "success", text: `${row.title} 업데이트 규칙을 원본 내용으로 갱신했습니다.` });
  }

  function addUpdateRule(row: typeof updateRuleRows[number]) {
    if (!draftCanvas || row.status !== "source-only" || !row.source) return;
    try {
      const updated = addCanvasUpdateRule(draftCanvas, row.source);
      setDraftCanvas(syncCanvasVariableRuleConnections(updated, variableSources, updateRuleSources));
      setChangeCount((count) => count + 1);
      setFeedback({ tone: "success", text: `${row.title} 업데이트 규칙 노드를 추가했습니다.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "업데이트 규칙 노드를 추가하지 못했습니다."
      });
    }
  }

  function applyVariable(row: typeof variableRows[number]) {
    if (!draftCanvas || !row.nodeUid || !row.source) return;
    const updated = updateCanvasVariable(draftCanvas, row.nodeUid, row.source);
    setDraftCanvas(syncCanvasVariableRuleConnections(updated, variableSources, updateRuleSources));
    setExpandedDifferenceId(null);
    setChangeCount((count) => count + 1);
    setFeedback({ tone: "success", text: `${row.name} 변수를 원본 타입·초기값으로 갱신했습니다.` });
  }

  function addVariable(row: typeof variableRows[number]) {
    if (!draftCanvas || row.status !== "source-only" || !row.source) return;
    try {
      const updated = addCanvasVariable(draftCanvas, row.source);
      setDraftCanvas(syncCanvasVariableRuleConnections(updated, variableSources, updateRuleSources));
      setChangeCount((count) => count + 1);
      setFeedback({ tone: "success", text: `${row.name} 변수 노드를 추가했습니다.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "변수 노드를 추가하지 못했습니다."
      });
    }
  }

  function syncVariableRuleConnections() {
    if (!draftCanvas) return;
    setDraftCanvas(syncCanvasVariableRuleConnections(
      draftCanvas,
      variableSources,
      updateRuleSources
    ));
    setChangeCount((count) => count + 1);
    setFeedback({ tone: "success", text: "변수의 rules 배열을 기준으로 업데이트 규칙 연결선을 동기화했습니다." });
  }

  function applyStatusView(row: typeof statusViewRows[number]) {
    if (!draftCanvas || !row.source) return;
    setDraftCanvas(updateCanvasStatusView(draftCanvas, row.nodeUid, row.source));
    setExpandedDifferenceId(null);
    setChangeCount((count) => count + 1);
    setFeedback({ tone: "success", text: `${row.title} 상태창을 ${row.source.name} 내용으로 갱신했습니다.` });
  }

  function applyAllStatusViews() {
    if (!draftCanvas) return;
    const rows = statusViewRows.filter((row) => row.status === "changed" && row.source);
    if (!rows.length) return;
    const next = rows.reduce(
      (canvas, row) => updateCanvasStatusView(canvas, row.nodeUid, row.source!),
      draftCanvas
    );
    setDraftCanvas(next);
    setExpandedDifferenceId(null);
    setChangeCount((count) => count + rows.length);
    setFeedback({ tone: "success", text: `이름이 매칭된 상태창 ${rows.length}개를 에셋 내용으로 갱신했습니다.` });
  }

  function applyStory(row: CanvasStoryRow) {
    if (!draftCanvas || !promptSource || !row.source) return;
    setDraftCanvas(updateCanvasStory(draftCanvas, row.nodeUid, promptSource, row.source));
    setChangeCount(count => count + 1);
    setFeedback({ tone: "success", text: `${row.title} 노드의 종류와 프롬프트·월드스토리를 갱신했습니다.` });
  }

  function applyAllStories() {
    if (!draftCanvas || !promptSource) return;
    const rows = storyRows.filter(row => row.source && (row.status === "different" || row.status === "included"));
    if (!rows.length) return;
    setDraftCanvas(rows.reduce((canvas, row) => updateCanvasStory(canvas, row.nodeUid, promptSource, row.source!), draftCanvas));
    setChangeCount(count => count + rows.length);
    setFeedback({ tone: "success", text: `스토리 노드 ${rows.length}개의 종류와 콘텐츠를 갱신했습니다.` });
  }

  function addAchievement(row: typeof achievementRows[number]) {
    if (!draftCanvas || !row.source) return;
    try {
      setDraftCanvas(addCanvasAchievementWithTrigger(draftCanvas, row.source));
      setChangeCount((count) => count + 1);
      setFeedback({ tone: "success", text: `${row.name} 업적 및 트리거 노드를 추가하고 변수와 연결했습니다.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "업적 노드를 추가하지 못했습니다."
      });
    }
  }

  function updateAchievement(row: typeof achievementRows[number]) {
    if (!draftCanvas || !row.source || !row.achievementNodeUid) return;
    try {
      setDraftCanvas(updateCanvasAchievementWithTrigger(draftCanvas, row.achievementNodeUid, row.source));
      setChangeCount((count) => count + 1);
      setFeedback({ tone: "success", text: `${row.name} 업적과 트리거 조건을 기존 노드에 갱신했습니다.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "업적 노드를 갱신하지 못했습니다."
      });
    }
  }

  function injectAllAchievements() {
    if (!draftCanvas || achievementSources.length === 0) return;
    try {
      const addedCount = achievementRows.filter((row) => row.status === "source-only").length;
      const updatedCount = achievementRows.filter((row) => row.status === "changed").length;
      const exactCount = achievementRows.filter((row) => row.status === "exact").length;
      const duplicateCount = achievementRows.filter((row) => row.status === "duplicate").length;
      const next = injectAllAchievementsWithTriggers(draftCanvas, achievementSources, variableSources);
      setDraftCanvas(next);
      setChangeCount((count) => count + addedCount + updatedCount);
      setFeedback({
        tone: duplicateCount > 0 ? "info" : "success",
        text: `업적 동기화 완료: ${addedCount}개 추가, ${updatedCount}개 갱신, ${exactCount}개 유지, 중복 ${duplicateCount}개 건너뜀.`
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "업적 일괄 주입에 실패했습니다."
      });
    }
  }

  function arrangeNodeSpacing() {
    if (!draftCanvas) return;
    setDraftCanvas(arrangeCanvasContentNodes(draftCanvas));
    setChangeCount((count) => count + 1);
    setFeedback({
      tone: "success",
      text: "타입별 세로 열은 유지하고 노드 간격을 줄였습니다. 로어북과 인물·이미지 영역은 겹치지 않게 분리했습니다."
    });
  }

  function resetChanges() {
    if (!originalCanvas) return;
    setDraftCanvas(structuredClone(originalCanvas));
    setChangeCount(0);
    setSelectedLorebookIds(new Set());
    setExpandedDifferenceId(null);
    setFeedback({ tone: "info", text: "이 캔버스에 적용한 편집 내용을 모두 되돌렸습니다." });
  }

  function downloadEditedCanvas() {
    if (!draftCanvas) return;
    downloadJson(
      `canvas-content-${safeFilenamePart(workName)}.json`,
      draftCanvas
    );
    setFeedback({
      tone: "success",
      text: `편집된 캔버스를 다운로드했습니다. 적용 변경 ${changeCount}건 · 원본 파일은 수정하지 않았습니다.`
    });
  }

  const loreSummary = {
    changed: lorebookRows.filter((row) => row.status === "changed").length,
    legacy: lorebookRows.filter((row) => row.status === "canvas-only").length,
    sourceOnly: lorebookRows.filter((row) => row.status === "source-only").length
  };
  const selectedChangedLorebookCount = lorebookRows.filter(
    (row) => row.status === "changed" && selectedLorebookIds.has(row.id)
  ).length;
  const characterSummary = {
    changed: characterRows.filter((row) => row.status === "changed").length,
    sourceOnly: characterRows.filter((row) => row.status === "source-only").length,
    sourceOnlyCore: characterRows.filter(
      (row) => row.status === "source-only" && (row.group === "core" || row.group === "additional")
    ).length,
    sourceOnlyCandidate: characterRows.filter(
      (row) => row.status === "source-only" && (row.group === "candidate" || row.group === "other")
    ).length,
    canvasOnly: characterRows.filter((row) => row.status === "canvas-only").length,
    missingImageCharacters: characterRows.filter(
      (row) => row.nodeUid && row.missingImageNodeCount > 0
    ).length,
    missingImages: characterRows.reduce(
      (count, row) => count + (row.nodeUid ? row.missingImageNodeCount : 0),
      0
    )
  };
  const variableSummary = {
    changed: variableRows.filter((row) => row.status === "changed").length,
    sourceOnly: variableRows.filter((row) => row.status === "source-only").length,
    canvasOnly: variableRows.filter((row) => row.status === "canvas-only").length
  };
  const updateRuleSummary = {
    changed: updateRuleRows.filter((row) => row.status === "changed").length,
    sourceOnly: updateRuleRows.filter((row) => row.status === "source-only").length,
    canvasOnly: updateRuleRows.filter((row) => row.status === "canvas-only").length
  };
  const statusViewSummary = {
    changed: statusViewRows.filter((row) => row.status === "changed").length,
    exact: statusViewRows.filter((row) => row.status === "exact").length,
    unmatched: statusViewRows.filter((row) => row.status === "canvas-only").length,
    duplicate: statusViewRows.filter((row) => row.status === "duplicate").length
  };
  const storySummary = {
    changed: storyRows.filter(
      (row) => row.status === "different" || row.status === "included"
    ).length,
    exact: storyRows.filter((row) => row.status === "exact").length,
    unmatched: storyRows.filter((row) => row.status === "unmatched").length
  };

  return (
    <>
      {draftCanvas ? (
        <div className="rplay-content-tabs" role="tablist" aria-label="캔버스 콘텐츠 종류">
          <button
            type="button"
            role="tab"
            className={activeTab === "lorebook" ? "is-active" : ""}
            aria-selected={activeTab === "lorebook"}
            onClick={() => setActiveTab("lorebook")}
          >
            로어북 <b>{lorebookRows.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            className={activeTab === "character" ? "is-active" : ""}
            aria-selected={activeTab === "character"}
            onClick={() => setActiveTab("character")}
          >
            인물 노드 <b>{characterRows.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            className={activeTab === "variable" ? "is-active" : ""}
            aria-selected={activeTab === "variable"}
            onClick={() => setActiveTab("variable")}
          >
            변수 <b>{variableRows.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            className={activeTab === "updateRule" ? "is-active" : ""}
            aria-selected={activeTab === "updateRule"}
            onClick={() => setActiveTab("updateRule")}
          >
            업데이트 규칙 <b>{updateRuleRows.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            className={activeTab === "statusView" ? "is-active" : ""}
            aria-selected={activeTab === "statusView"}
            onClick={() => setActiveTab("statusView")}
          >
            상태창 <b>{statusViewRows.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            className={activeTab === "story" ? "is-active" : ""}
            aria-selected={activeTab === "story"}
            onClick={() => setActiveTab("story")}
          >
            스토리 비교 <b>{storyRows.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            className={activeTab === "achievement" ? "is-active" : ""}
            aria-selected={activeTab === "achievement"}
            onClick={() => setActiveTab("achievement")}
          >
            🏆 업적 <b>{achievementRows.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            className={activeTab === "hub" ? "is-active" : ""}
            aria-selected={activeTab === "hub"}
            onClick={() => setActiveTab("hub")}
          >
            허브 관리
          </button>
        </div>
      ) : null}
    <section className="rplay-panel">
      <SidebarSection order={18}><header className="rplay-panel-heading">
        <span>04</span>
        <div>
          <strong>캔버스 콘텐츠 편집기</strong> <HelpButton topic="canvasEdit" />
          <p>
            현재 캔버스를 원본 자료와 비교하고 로어북·인물·변수·업데이트 규칙·상태창 노드를 안전하게 갱신합니다.
            스토리 노드는 프롬프트·배경과 시작 노드의 메시지·가이드를 각각 알맞은 필드로 갱신합니다.
          </p>
        </div>
        <em>CANVAS CONTENT</em>
      </header></SidebarSection>

      <div className="rplay-panel-body">
        <SidebarSection order={20}><div className="rplay-file-action">
          <label className="rplay-file-picker">
            <span>기준 캔버스</span>
            <strong>{file?.name ?? "알플레이 캔버스 내보내기 JSON을 선택하세요"}</strong>
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(event) => void loadCanvas(event.target.files?.[0] ?? null)}
            />
          </label>
          <ToolbarSlot slot="actions"><button
            className="rplay-primary-button"
            type="button"
            disabled={!draftCanvas}
            onClick={downloadEditedCanvas}
          >
            수정본 다운로드 ({changeCount})
          </button></ToolbarSlot>
        </div></SidebarSection>

        <RplayFeedbackPanel feedback={feedback} />

        {draftCanvas ? (
          <>
            <div className="feature-help-context">현재 탭 사용법 <HelpButton topic={tabHelp[activeTab]} /></div>
            <SidebarSection order={22}><div className="rplay-content-toolbar">
              <button
                className="rplay-secondary-button"
                type="button"
                onClick={arrangeNodeSpacing}
              >
                타입별 세로 열 간격 정리
              </button>
              <button
                className="rplay-secondary-button"
                type="button"
                disabled={!changeCount}
                onClick={resetChanges}
              >
                편집 되돌리기
              </button>
            </div></SidebarSection>

            {activeTab !== "hub" ? <RplayCanvasBatchPanel key={`${file?.name}:${activeTab}`} canvas={draftCanvas}
              items={canvasBatchItems(draftCanvas, activeTab, {
                lorebooks: lorebookSources, characters: characterSources, variables: variableSources, rules: updateRuleSources,
                achievements: achievementSources, assets: statusViewSources, prompts: promptSource
              })}
              onApply={(next, message) => {
                setDraftCanvas(next);
                setChangeCount((count) => count + 1);
                setFeedback({ tone: "success", text: message });
              }} /> : null}

            {activeTab === "hub" ? (
              <RplayCanvasHubImport workId={workId} canvas={draftCanvas} onApply={(next, message) => {
                if (next !== draftCanvas) {
                  setDraftCanvas(next);
                  setChangeCount((count) => count + 1);
                }
                setFeedback({ tone: "success", text: message });
              }} />
            ) : null}

            {activeTab === "lorebook" ? (
              <div className="rplay-content-workspace">
                <SidebarSection order={24}><div className="rplay-content-summary">
                  <span>갱신 필요 <strong>{loreSummary.changed}</strong></span>
                  <span>레거시 후보 <strong>{loreSummary.legacy}</strong></span>
                  <span>원본에만 있음 <strong>{loreSummary.sourceOnly}</strong></span>

                  <button
                    className="rplay-secondary-button"
                    type="button"
                    disabled={!loreSummary.changed}
                    onClick={selectAllChangedLorebooks}
                  >
                    갱신 필요 모두 선택
                  </button>
                  <button
                    className="rplay-secondary-button"
                    type="button"
                    disabled={!selectedChangedLorebookCount}
                    onClick={applySelectedLorebooks}
                  >
                    선택 로어북 갱신 ({selectedChangedLorebookCount})
                  </button>
                  <button
                    className="rplay-secondary-button"
                    type="button"
                    disabled={!selectedChangedLorebookCount}
                    onClick={() => setSelectedLorebookIds(new Set())}
                  >
                    선택 해제
                  </button>

                </div></SidebarSection>
                <div className="rplay-content-table-wrap">
                  <table className="rplay-content-table">
                    <thead>
                      <tr>
                        <th className="rplay-content-select-column">
                          <input
                            type="checkbox"
                            aria-label="갱신 필요 로어북 모두 선택"
                            checked={loreSummary.changed > 0 && selectedChangedLorebookCount === loreSummary.changed}
                            disabled={!loreSummary.changed}
                            onChange={(event) => event.target.checked
                              ? selectAllChangedLorebooks()
                              : setSelectedLorebookIds(new Set())}
                          />
                        </th>
                        <th>제목</th>
                        <th>상태</th>
                        <th>본문 길이</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lorebookRows.map((row) => (
                        <Fragment key={row.id}>
                          <tr>
                            <td className="rplay-content-select-column">
                              {row.status === "changed" ? (
                                <input
                                  type="checkbox"
                                  aria-label={`${row.title} 갱신 선택`}
                                  checked={selectedLorebookIds.has(row.id)}
                                  onChange={() => toggleLorebookSelection(row.id)}
                                />
                              ) : <span aria-hidden="true">—</span>}
                            </td>
                            <td className="rplay-content-title-cell">
                              <strong>{row.title}</strong>
                              <small>{row.nodeUid ?? "캔버스 노드 없음"}</small>
                            </td>
                            <td>
                              <span className={`rplay-content-status ${statusClass(row.status)}`}>
                                {statusLabels[row.status]}
                              </span>
                            </td>
                            <td>{row.canvasTextLength} → {row.sourceTextLength}</td>
                            <td>
                              {row.status === "changed" ? (
                                <div className="rplay-content-actions">
                                  <button type="button" onClick={() => applyLorebook(row)}>원본으로 갱신</button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDifferenceId((current) => current === `lorebook:${row.id}` ? null : `lorebook:${row.id}`)}
                                  >
                                    {expandedDifferenceId === `lorebook:${row.id}` ? "차이 닫기" : "차이 보기"}
                                  </button>
                                </div>
                              ) : null}
                              {row.status === "canvas-only" ? (
                                <button className="is-danger" type="button" onClick={() => removeLegacyLorebook(row)}>레거시 삭제</button>
                              ) : null}
                              {row.status === "source-only" ? (
                                <button type="button" onClick={() => addLorebook(row)}>신규 추가</button>
                              ) : null}
                              {row.status === "exact" ? <small>작업 없음</small> : null}
                            </td>
                          </tr>
                          {expandedDifferenceId === `lorebook:${row.id}` && row.status === "changed" && row.source ? (
                            <tr className="rplay-content-diff-row">
                              <td colSpan={5}>
                                <ContentDifference items={[
                                  ...(!row.bodyMatches ? [{ label: "본문", canvas: row.canvasBody, source: row.source.body }] : []),
                                  ...(!row.keyMatches ? [{ label: "트리거 키", canvas: row.canvasKey, source: row.source.triggers.join("|") }] : []),
                                  ...(!row.patternsMatch ? [{ label: "트리거 목록", canvas: row.canvasPatterns, source: row.source.triggers }] : []),
                                  ...(!row.priorityMatches ? [{ label: "우선순위", canvas: row.canvasPriority, source: row.sourcePriority }] : [])
                                ]} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {activeTab === "character" ? (
              <div className="rplay-content-workspace">
                <SidebarSection order={24}><div className="rplay-content-summary">
                  <span>갱신 필요 <strong>{characterSummary.changed}</strong></span>
                  <span>레거시 후보 <strong>{characterSummary.canvasOnly}</strong></span>
                  <span>
                    노드 누락 <strong>{characterSummary.sourceOnly}</strong>
                    <small style={{ marginLeft: "4px", opacity: 0.8 }}>
                      (핵심·추가 {characterSummary.sourceOnlyCore} / 후보 {characterSummary.sourceOnlyCandidate})
                    </small>
                  </span>
                  <button
                    className="rplay-secondary-button"
                    type="button"
                    disabled={!characterSummary.changed}
                    onClick={applyAllCharacters}
                  >
                    갱신 필요 인물 모두 갱신 ({characterSummary.changed})
                  </button>

                </div></SidebarSection>
                <div className="rplay-content-table-wrap">
                  <table className="rplay-content-table">
                    <thead>
                      <tr>
                        <th>인물</th>
                        <th>그룹</th>
                        <th>상태</th>
                        <th>MD 프롬프트</th>
                        <th>배경</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {characterRows.map((row) => (
                        <Fragment key={row.id}>
                          <tr>
                            <td>
                              <strong>{row.name}</strong>
                              <small>{row.nodeUid ?? "캔버스 노드 없음"}</small>
                            </td>
                            <td>
                              {row.group ? (
                                <span className={`rplay-content-status ${row.group === "core" || row.group === "additional" ? "is-exact" : "is-changed"}`}>
                                  {groupLabels[row.group as keyof typeof groupLabels] || row.group}
                                </span>
                              ) : <span>-</span>}
                            </td>
                            <td>
                              <span className={`rplay-content-status ${statusClass(row.status)}`}>
                                {statusLabels[row.status]}
                              </span>
                            </td>
                            <td>
                              <span className={`rplay-content-status ${row.promptMatches ? "is-exact" : "is-changed"}`}>
                                {row.promptMatches ? "동일" : row.source && row.nodeUid ? "차이" : "-"}
                              </span>
                            </td>
                            <td>
                              <span className={`rplay-content-status ${row.backgroundMatches ? "is-exact" : "is-changed"}`}>
                                {row.backgroundMatches ? "동일" : row.source && row.nodeUid ? "차이" : "-"}
                              </span>
                            </td>
                            <td>
                              {row.status === "changed" ? (
                                <div className="rplay-content-actions">
                                  <button type="button" onClick={() => applyCharacter(row)}>프롬프트·배경 갱신</button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDifferenceId((current) => current === `character:${row.id}` ? null : `character:${row.id}`)}
                                  >
                                    {expandedDifferenceId === `character:${row.id}` ? "차이 닫기" : "차이 보기"}
                                  </button>
                                </div>
                              ) : null}
                              {row.status === "source-only" ? (
                                <button type="button" onClick={() => addCharacter(row)}>
                                  {row.group === "candidate" || row.group === "other" ? "후보 추가" : "신규 추가"}
                                </button>
                              ) : null}
                              {row.status === "canvas-only" ? <small>원본 인물 없음</small> : null}
                              {row.status === "exact" ? <small>작업 없음</small> : null}
                            </td>
                          </tr>
                          {expandedDifferenceId === `character:${row.id}` && row.status === "changed" && row.source ? (
                            <tr className="rplay-content-diff-row">
                              <td colSpan={6}>
                                <ContentDifference items={[
                                  ...(!row.promptMatches ? [{ label: "MD 프롬프트", canvas: row.canvasPrompt, source: row.source.prompt }] : []),
                                  ...(!row.backgroundMatches ? [{ label: "배경", canvas: row.canvasBackground, source: row.source.background }] : [])
                                ]} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {activeTab === "variable" ? (
              <div className="rplay-content-workspace">
                <p className="rplay-content-notice">
                  변수명(<code>variableName</code>)이 정확히 같은 노드만 타입·초기값·제목을 비교하고 갱신합니다.
                  원본에만 있는 변수는 개별 추가할 수 있으며, 캔버스에만 있는 변수는 자동 삭제하지 않습니다.
                </p>
                <SidebarSection order={24}><div className="rplay-content-summary">
                  <span>갱신 필요 <strong>{variableSummary.changed}</strong></span>
                  <span>레거시 후보 <strong>{variableSummary.canvasOnly}</strong></span>
                  <span>캔버스 노드 없음 <strong>{variableSummary.sourceOnly}</strong></span>
                </div></SidebarSection>
                <div className="rplay-content-table-wrap">
                  <table className="rplay-content-table">
                    <thead>
                      <tr>
                        <th>변수명</th>
                        <th>상태</th>
                        <th>표시 제목</th>
                        <th>타입</th>
                        <th>초기값</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variableRows.map((row) => (
                        <Fragment key={row.id}>
                          <tr>
                            <td>
                              <strong>{row.name}</strong>
                              <small>{row.nodeUid ?? "캔버스 노드 없음"}</small>
                            </td>
                            <td>
                              <span className={`rplay-content-status ${statusClass(row.status)}`}>
                                {statusLabels[row.status]}
                              </span>
                            </td>
                            <td>
                              <span className={`rplay-content-status ${row.titleMatches ? "is-exact" : "is-changed"}`}>
                                {row.source && row.nodeUid ? (row.titleMatches ? "동일" : "차이") : "-"}
                              </span>
                            </td>
                            <td>
                              <span className={`rplay-content-status ${row.typeMatches ? "is-exact" : "is-changed"}`}>
                                {row.source && row.nodeUid ? (row.typeMatches ? "동일" : "차이") : "-"}
                              </span>
                            </td>
                            <td>
                              <span className={`rplay-content-status ${row.initialValueMatches ? "is-exact" : "is-changed"}`}>
                                {row.source && row.nodeUid ? (row.initialValueMatches ? "동일" : "차이") : "-"}
                              </span>
                            </td>
                            <td>
                              {row.status === "changed" ? (
                                <div className="rplay-content-actions">
                                  <button type="button" onClick={() => applyVariable(row)}>원본으로 갱신</button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDifferenceId((current) => current === `variable:${row.id}` ? null : `variable:${row.id}`)}
                                  >
                                    {expandedDifferenceId === `variable:${row.id}` ? "차이 닫기" : "차이 보기"}
                                  </button>
                                </div>
                              ) : null}
                              {row.status === "exact" ? <small>작업 없음</small> : null}
                              {row.status === "source-only" ? (
                                <button type="button" onClick={() => addVariable(row)}>변수 노드 추가</button>
                              ) : null}
                              {row.status === "canvas-only" ? <small>로컬 변수 없음</small> : null}
                              {row.status === "duplicate" ? <small>중복 변수명 확인</small> : null}
                            </td>
                          </tr>
                          {expandedDifferenceId === `variable:${row.id}` && row.status === "changed" && row.source ? (
                            <tr className="rplay-content-diff-row">
                              <td colSpan={6}>
                                <ContentDifference items={[
                                  ...(!row.titleMatches ? [{ label: "표시 제목", canvas: row.canvasTitle, source: row.source.title }] : []),
                                  ...(!row.typeMatches ? [{ label: "타입", canvas: row.canvasType, source: row.source.variableType }] : []),
                                  ...(!row.initialValueMatches ? [{ label: "초기값", canvas: row.canvasInitialValue, source: row.source.initValue }] : [])
                                ]} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {activeTab === "updateRule" ? (
              <div className="rplay-content-workspace">
                <p className="rplay-content-notice">
                  로컬과 캔버스의 제목이 동일한 업데이트 규칙만 본문을 갱신합니다.
                  추가·삭제 체크리스트에서 누락 규칙과 레거시 규칙을 선택해 적용할 수 있습니다.
                </p>
                <SidebarSection order={24}><div className="rplay-content-summary">
                  <span>갱신 필요 <strong>{updateRuleSummary.changed}</strong></span>
                  <span>캔버스 노드 없음 <strong>{updateRuleSummary.sourceOnly}</strong></span>
                  <span>로컬 규칙 없음 <strong>{updateRuleSummary.canvasOnly}</strong></span>
                  <button
                    className="rplay-secondary-button"
                    type="button"
                    disabled={!variableSources.length || !updateRuleSources.length}
                    onClick={syncVariableRuleConnections}
                  >
                    변수 연결 동기화
                  </button>
                </div></SidebarSection>
                <div className="rplay-content-table-wrap">
                  <table className="rplay-content-table">
                    <thead>
                      <tr>
                        <th>규칙 제목</th>
                        <th>상태</th>
                        <th>본문 길이</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {updateRuleRows.map((row) => (
                        <Fragment key={row.id}>
                          <tr>
                            <td>
                              <strong>{row.title}</strong>
                              <small>{row.nodeUid ?? "캔버스 노드 없음"}</small>
                            </td>
                            <td>
                              <span className={`rplay-content-status ${statusClass(row.status)}`}>
                                {statusLabels[row.status]}
                              </span>
                            </td>
                            <td>{row.canvasTextLength} → {row.sourceTextLength}</td>
                            <td>
                              {row.status === "changed" ? (
                                <div className="rplay-content-actions">
                                  <button type="button" onClick={() => applyUpdateRule(row)}>원본으로 갱신</button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDifferenceId((current) => current === `updateRule:${row.id}` ? null : `updateRule:${row.id}`)}
                                  >
                                    {expandedDifferenceId === `updateRule:${row.id}` ? "차이 닫기" : "차이 보기"}
                                  </button>
                                </div>
                              ) : null}
                              {row.status === "exact" ? <small>작업 없음</small> : null}
                              {row.status === "source-only" ? (
                                <button type="button" onClick={() => addUpdateRule(row)}>업데이트 규칙 추가</button>
                              ) : null}
                              {row.status === "canvas-only" ? <small>로컬 규칙 없음</small> : null}
                              {row.status === "duplicate" ? <small>중복 제목 확인</small> : null}
                            </td>
                          </tr>
                          {expandedDifferenceId === `updateRule:${row.id}` && row.status === "changed" && row.source ? (
                            <tr className="rplay-content-diff-row">
                              <td colSpan={4}>
                                <ContentDifference items={[
                                  { label: "규칙 본문", canvas: row.canvasText, source: row.source.text }
                                ]} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {activeTab === "statusView" ? (
              <div className="rplay-content-workspace">
                <p className="rplay-content-notice">
                  상태창 노드의 제목과 현재 플랫폼 HTML 에셋의 파일명을 이름으로 매칭합니다.
                  <code>경비 상태창</code>과 <code>상태창(경비).html</code>처럼 표기 순서만 다른 이름도 같은 항목으로 봅니다.
                  매칭되지 않거나 중복된 이름은 자동 갱신하지 않습니다.
                </p>
                <SidebarSection order={24}><div className="rplay-content-summary">
                  <span>갱신 필요 <strong>{statusViewSummary.changed}</strong></span>
                  <span>동일 <strong>{statusViewSummary.exact}</strong></span>
                  <span>에셋 매칭 없음 <strong>{statusViewSummary.unmatched}</strong></span>
                  <span>중복 확인 <strong>{statusViewSummary.duplicate}</strong></span>
                  <button
                    className="rplay-secondary-button"
                    type="button"
                    disabled={!statusViewSummary.changed}
                    onClick={applyAllStatusViews}
                  >
                    매칭 상태창 모두 갱신 ({statusViewSummary.changed})
                  </button>
                </div></SidebarSection>
                <div className="rplay-content-table-wrap">
                  <table className="rplay-content-table">
                    <thead>
                      <tr>
                        <th>상태창 노드</th>
                        <th>매칭 에셋</th>
                        <th>상태</th>
                        <th>HTML 길이</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusViewRows.map((row) => (
                        <Fragment key={row.id}>
                          <tr>
                            <td>
                              <strong>{row.title}</strong>
                              <small>{row.nodeUid}</small>
                            </td>
                            <td>{row.assetName || <small>동일 이름 에셋 없음</small>}</td>
                            <td>
                              <span className={`rplay-content-status ${statusClass(row.status)}`}>
                                {statusViewStatusLabels[row.status]}
                              </span>
                            </td>
                            <td>
                              {row.source
                                ? `${row.canvasHtmlLength} → ${row.sourceHtmlLength}`
                                : `${row.canvasHtmlLength} → -`}
                            </td>
                            <td>
                              {row.status === "changed" ? (
                                <div className="rplay-content-actions">
                                  <button type="button" onClick={() => applyStatusView(row)}>에셋으로 갱신</button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDifferenceId((current) => current === `statusView:${row.id}` ? null : `statusView:${row.id}`)}
                                  >
                                    {expandedDifferenceId === `statusView:${row.id}` ? "차이 닫기" : "차이 보기"}
                                  </button>
                                </div>
                              ) : null}
                              {row.status === "exact" ? <small>작업 없음</small> : null}
                              {row.status === "canvas-only" ? <small>동일 이름 에셋 없음</small> : null}
                              {row.status === "duplicate" ? <small>노드 또는 에셋 이름 중복</small> : null}
                            </td>
                          </tr>
                          {expandedDifferenceId === `statusView:${row.id}` && row.status === "changed" && row.source ? (
                            <tr className="rplay-content-diff-row">
                              <td colSpan={5}>
                                <ContentDifference items={[
                                  { label: "상태창 HTML", canvas: row.canvasHtml, source: row.source.content }
                                ]} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {activeTab === "story" ? (
              <div className="rplay-content-workspace">
                <p className="rplay-content-notice">
                  같은 이름의 프롬프트 노드와 연결합니다. 시작·일반 노드 모두 메인과 월드스토리를 적용하고,
                  시작 노드에는 시작 프롬프트와 시작 메시지도 적용합니다. 비운 항목은 캔버스에서도 지워집니다.
                </p>
                <SidebarSection order={24}><div className="rplay-content-summary">
                  <span>갱신 필요 <strong>{storySummary.changed}</strong></span>
                  <span>완전 일치 <strong>{storySummary.exact}</strong></span>
                  <span>매칭 안 됨 <strong>{storySummary.unmatched}</strong></span>
                  <button
                    className="rplay-secondary-button"
                    type="button"
                    disabled={!storySummary.changed}
                    onClick={applyAllStories}
                  >
                    매칭 스토리 모두 갱신 ({storySummary.changed})
                  </button>
                </div></SidebarSection>
                <div className="rplay-story-list">
                  {storyRows.map((row) => (
                    <article key={row.id} className="rplay-story-compare-card">
                      <header>
                        <div>
                          <strong>{row.title}</strong>
                          <small>원본: {row.source?.name ?? "매칭 없음"}</small>
                        </div>
                        <span className={`rplay-content-status ${statusClass(row.status)}`}>
                          {storyStatusLabels[row.status]}
                        </span>
                      </header>
                      <dl>
                        <div><dt>노드 이름</dt><dd>{row.titleMatches ? "일치" : "갱신 필요"}</dd></div>
                        <div><dt>캔버스 coreContext</dt><dd>{row.canvasText.length}자</dd></div>
                        <div><dt>원본 메인 + 추가</dt><dd>{row.sourceText.length}자</dd></div>
                        <div><dt>캔버스 월드스토리</dt><dd>{row.canvasBackgroundText.length}자</dd></div>
                        <div><dt>원본 월드스토리</dt><dd>{row.sourceBackgroundText.length}자</dd></div>
                        <div><dt>노드 종류</dt><dd>{row.isStart ? "시작" : "일반"} → {row.source?.nodeType === "start" ? "시작" : "일반"}</dd></div>
                        {row.isStart || row.source?.nodeType === "start" ? (
                          <>
                            <div><dt>캔버스 prologue</dt><dd>{row.canvasPrologueText.length}자</dd></div>
                            <div><dt>원본 시작 메시지</dt><dd>{row.sourcePrologueText.length}자</dd></div>
                            <div><dt>캔버스 prologueGuide</dt><dd>{row.canvasPrologueGuideText.length}자</dd></div>
                            <div><dt>원본 시작 프롬프트</dt><dd>{row.sourcePrologueGuideText.length}자</dd></div>
                          </>
                        ) : null}
                        <div>
                          <dt>coreContext 변경</dt>
                          <dd>+{row.coreContextDiff.addedChars} / −{row.coreContextDiff.removedChars} ({row.coreContextDiff.changeRatio}%)</dd>
                        </div>
                        {row.isStart || row.source?.nodeType === "start" ? (
                          <>
                            <div>
                              <dt>시작 메시지 변경</dt>
                              <dd>+{row.prologueDiff.addedChars} / −{row.prologueDiff.removedChars} ({row.prologueDiff.changeRatio}%)</dd>
                            </div>
                            <div>
                              <dt>시작 프롬프트 변경</dt>
                              <dd>+{row.prologueGuideDiff.addedChars} / −{row.prologueGuideDiff.removedChars} ({row.prologueGuideDiff.changeRatio}%)</dd>
                            </div>
                          </>
                        ) : null}
                      </dl>
                      {row.source && (row.status === "different" || row.status === "included") ? (
                        <button
                          className="rplay-secondary-button"
                          type="button"
                          onClick={() => applyStory(row)}
                        >
                          이름 + 프롬프트 + 배경{row.isStart ? " + 시작 콘텐츠" : ""} 갱신
                        </button>
                      ) : null}
                      <details>
                        <summary>정확한 변경 위치 보기</summary>
                        <div>
                          <StoryTextDifference label="메인 프롬프트" diff={row.coreContextDiff} />
                          <StoryTextDifference label="월드스토리" diff={row.backgroundDiff} />
                          {row.isStart || row.source?.nodeType === "start" ? (
                            <>
                              <StoryTextDifference label="시작 메시지 (prologue)" diff={row.prologueDiff} />
                              <StoryTextDifference label="시작 프롬프트 (prologueGuide)" diff={row.prologueGuideDiff} />
                            </>
                          ) : null}
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === "achievement" ? (
              <div className="rplay-content-workspace">
                <p className="rplay-content-notice">
                  등록된 업적 목록과 알플레이 캔버스의 업적(achievement) 노드 및 트리거(trigger) 노드를 비교하고 자동 조립합니다.
                  제목이 같은 업적은 기존 노드를 갱신하고, 누락된 업적만 <strong>감시 대상 변수 노드 ➔ 트리거 노드 ➔ 업적 노드</strong>로 추가합니다.
                </p>
                <SidebarSection order={24}><div className="rplay-content-summary">
                  <span>로컬 등록 업적 <strong>{achievementSources.length}</strong></span>
                  <span>캔버스 업적 노드 <strong>{achievementRows.filter((r) => r.achievementNodeUid).length}</strong></span>
                  <button
                    className="rplay-primary-button"
                    type="button"
                    style={{ background: "#4f46e5", borderColor: "#6366f1" }}
                    disabled={achievementSources.length === 0}
                    onClick={injectAllAchievements}
                  >
                    🏆 등록 업적 동기화 ({achievementSources.length}개)
                  </button>
                </div></SidebarSection>
                <div className="rplay-content-table-wrapper">
                  <table className="rplay-content-table">
                    <thead>
                      <tr>
                        <th style={{ width: "90px" }}>상태</th>
                        <th style={{ width: "160px" }}>업적 이름</th>
                        <th style={{ width: "120px" }}>감시 변수</th>
                        <th style={{ width: "90px" }}>보상</th>
                        <th>달성 설명 및 조건</th>
                        <th style={{ width: "140px", textAlign: "right" }}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {achievementRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <span className={`rplay-content-status ${statusClass(row.status)}`}>
                              {statusLabels[row.status]}
                            </span>
                          </td>
                          <td>
                            <strong>{row.name}</strong>
                            {row.source?.isHidden && <span style={{ marginLeft: "0.25rem", fontSize: "0.75rem", color: "#f59e0b" }}>[히든]</span>}
                          </td>
                          <td>
                            <code>{row.targetVariableName}</code>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: "#38bdf8" }}>
                              {row.source?.rewardCredits ?? row.canvasCredits} C
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
                              {row.source?.description || row.canvasDescription || "(설명 없음)"}
                            </div>
                            {row.source?.conditionValue && (
                              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                                등록 조건: <code>{row.source.targetVariable} {row.source.conditionType} {row.source.conditionValue}</code>
                              </div>
                            )}
                            {row.triggerNodeUid && (
                              <div style={{ fontSize: "0.75rem", color: row.conditionMatches ? "#94a3b8" : "#f87171", marginTop: "0.2rem" }}>
                                캔버스 조건: <code>{row.targetVariableName} ({row.canvasVariableType || "타입 없음"}) {row.canvasConditionType || "조건 없음"} {comparedValue(row.canvasConditionValue)}</code>
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {row.status === "source-only" ? (
                              <button
                                className="rplay-secondary-button"
                                type="button"
                                onClick={() => addAchievement(row)}
                              >
                                노드+트리거 추가
                              </button>
                            ) : row.status === "changed" && row.achievementNodeUid ? (
                              <button
                                className="rplay-secondary-button"
                                type="button"
                                onClick={() => updateAchievement(row)}
                              >
                                기존 노드 갱신
                              </button>
                            ) : row.achievementNodeUid ? (
                              <button
                                className="rplay-del-button"
                                type="button"
                                onClick={() => {
                                  if (!draftCanvas || !row.achievementNodeUid) return;
                                  let next = deleteCanvasNode(draftCanvas, row.achievementNodeUid);
                                  if (row.triggerNodeUid) {
                                    next = deleteCanvasNode(next, row.triggerNodeUid);
                                  }
                                  setDraftCanvas(next);
                                  setChangeCount((c) => c + 1);
                                  setFeedback({ tone: "info", text: `${row.name} 노드를 삭제했습니다.` });
                                }}
                              >
                                노드 삭제
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
    </>
  );
}
