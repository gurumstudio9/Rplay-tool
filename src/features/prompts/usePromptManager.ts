import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent
} from "react";
import {
  activePromptVersion,
  blankPromptVersion,
  buildPromptLineDiff,
  normalizePromptState,
  promptId,
  promptTabsForNode,
  promptTextForTab,
  uniquePromptId,
  type PromptState,
  type PromptTab,
  type PromptVersion
} from "./model";
import {
  copyText
} from "./platform";
import { usePromptPersistence } from "./usePromptPersistence";

export type PromptInsertionRequest = {
  id: number;
  text: string;
} | null;

function downloadJson(value: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function versionText(version: PromptVersion, tab: PromptTab): string {
  if (tab === "suggestedReplies") return version.suggestedReplies.join("\n\n");
  if (tab === "mainPrompt") return version.additionalPrompt;
  if (tab === "variables") return "";
  return typeof version[tab] === "string" ? version[tab] as string : "";
}

export function usePromptManager(activeWorkId: string) {
  const persistence = usePromptPersistence(activeWorkId);
  const { state, stateRef, replaceState, announce } = persistence;
  const [activeTab, setActiveTab] = useState<PromptTab>("mainPrompt");
  const [showDiff, setShowDiff] = useState(false);
  const [focusMode, setFocusMode] = useState(
    () => localStorage.getItem("prompt-manager-focus-output") === "true"
  );
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [versionDraft, setVersionDraft] = useState(blankPromptVersion);
  const [versionDraftTab, setVersionDraftTab] = useState<
    "additionalPrompt" | "starterPrompt" | "starterMessage"
  >("starterPrompt");
  const [insertionRequest, setInsertionRequest] =
    useState<PromptInsertionRequest>(null);

  const activeVersion = useMemo(
    () => activePromptVersion(state),
    [state]
  );
  const activeText = useMemo(
    () => promptTextForTab(state, activeTab, activeVersion),
    [activeTab, activeVersion, state]
  );
  const diffLines = useMemo(() => {
    if (state.versions.length < 2) return [];
    return buildPromptLineDiff(
      versionText(state.versions[0], activeTab),
      versionText(state.versions[1], activeTab)
    );
  }, [activeTab, state.versions]);

  useEffect(() => {
    setActiveTab("mainPrompt");
    setShowDiff(false);
    setVersionDialogOpen(false);
    setEditingVersionId(null);
    setInsertionRequest(null);
  }, [activeWorkId]);

  useEffect(() => {
    if (activeTab === "variables" || activeTab === "achievements") return;
    if (!promptTabsForNode(activeVersion?.nodeType ?? "start").includes(activeTab)) setActiveTab("mainPrompt");
  }, [activeVersion?.nodeType, activeTab]);

  function selectVersion(id: string) {
    if (!stateRef.current.versions.some((version) => version.id === id)) return;
    replaceState({ ...stateRef.current, activeVersionId: id });
  }

  function updateActiveText(value: string) {
    const current = stateRef.current;
    if (activeTab === "mainPrompt") {
      replaceState({ ...current, mainPrompt: value });
      return;
    }
    if (activeTab === "suggestedReplies" || activeTab === "variables") return;
    const versions = current.versions.map((version) =>
      version.id === current.activeVersionId
        ? {
            ...version,
            [activeTab]: value,
            updatedAt: new Date().toISOString()
          }
        : version
    );
    replaceState({ ...current, versions });
  }

  function updateSuggestedReply(index: number, value: string) {
    const current = stateRef.current;
    const versions = current.versions.map((version) => {
      if (version.id !== current.activeVersionId) return version;
      const replies = [...version.suggestedReplies] as [
        string,
        string,
        string
      ];
      replies[index] = value.slice(0, 500);
      return {
        ...version,
        suggestedReplies: replies,
        updatedAt: new Date().toISOString()
      };
    });
    replaceState({ ...current, versions });
  }

  function moveVersion(id: string, direction: -1 | 1) {
    const current = stateRef.current;
    const index = current.versions.findIndex((version) => version.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.versions.length) {
      return;
    }
    const versions = [...current.versions];
    [versions[index], versions[targetIndex]] = [
      versions[targetIndex],
      versions[index]
    ];
    replaceState({ ...current, versions });
  }

  function dialogTab(): "additionalPrompt" | "starterPrompt" | "starterMessage" {
    if (
      activeTab === "starterPrompt"
      || activeTab === "starterMessage"
      || activeTab === "additionalPrompt"
    ) {
      return activeTab;
    }
    return "additionalPrompt";
  }

  function openCreateVersion() {
    setEditingVersionId(null);
    setVersionDraft({ ...blankPromptVersion(), worldStory: stateRef.current.worldStory });
    setVersionDraftTab(dialogTab());
    setVersionDialogOpen(true);
  }

  function openEditVersion(id: string) {
    const version = stateRef.current.versions.find((item) => item.id === id);
    if (!version) return;
    setEditingVersionId(id);
    setVersionDraft({
      ...version,
      suggestedReplies: [...version.suggestedReplies]
    });
    setVersionDraftTab(dialogTab());
    setVersionDialogOpen(true);
  }

  function closeVersionDialog() {
    setVersionDialogOpen(false);
    setEditingVersionId(null);
  }

  function updateVersionDraft(patch: Partial<PromptVersion>) {
    setVersionDraft((current) => ({ ...current, ...patch }));
  }

  function saveVersionDraft() {
    const name = versionDraft.name.trim();
    if (!name) {
      announce("노드 이름을 입력해 주세요.", true);
      return false;
    }
    const current = stateRef.current;
    const requestedId = versionDraft.id.trim()
      ? promptId(versionDraft.id)
      : uniquePromptId(current, name);
    if (
      !editingVersionId
      && current.versions.some((version) => version.id === requestedId)
    ) {
      announce("같은 ID의 프롬프트 노드가 이미 있습니다.", true);
      return false;
    }
    if (current.versions.some(version => version.id !== editingVersionId && version.name.trim() === name)) {
      announce("같은 이름의 노드가 이미 있습니다.", true);
      return false;
    }
    const next: PromptVersion = {
      ...versionDraft,
      id: editingVersionId || requestedId,
      name,
      notes: versionDraft.notes.trim(),
      updatedAt: new Date().toISOString()
    };
    const versions = editingVersionId
      ? current.versions.map((version) =>
          version.id === editingVersionId ? next : version
        )
      : [...current.versions, next];
    replaceState({
      ...current,
      versions,
      activeVersionId: next.id
    });
    closeVersionDialog();
    return true;
  }

  function deleteVersion(id: string) {
    const current = stateRef.current;
    const version = current.versions.find((item) => item.id === id);
    if (!version || !window.confirm(`${version.name} 노드를 삭제할까요?`)) {
      return;
    }
    const versions = current.versions.filter((item) => item.id !== id);
    replaceState({
      ...current,
      versions,
      activeVersionId: current.activeVersionId === id
        ? versions[0]?.id ?? ""
        : current.activeVersionId
    });
    closeVersionDialog();
  }

  async function copyActive() {
    await copyText(activeText);
    announce(`${activeVersion?.name || "메인 프롬프트"} 복사됨`);
  }

  async function copyAll() {
    const value = activeTab === "mainPrompt"
      ? stateRef.current.mainPrompt
      : stateRef.current.versions.map((version) =>
          `[${version.name}]\n${versionText(version, activeTab)}`
        ).join("\n\n");
    await copyText(value);
    announce(`전체 ${stateRef.current.versions.length}개 버전 복사됨`);
  }

  async function exportJson() {
    const json = JSON.stringify(stateRef.current, null, 2);
    await copyText(json);
    downloadJson(stateRef.current, `${activeWorkId}-prompts.json`);
    announce("프롬프트 JSON 다운로드·복사됨");
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const next = normalizePromptState(JSON.parse(await file.text()));
      if (
        !window.confirm(
          `현재 ${stateRef.current.versions.length}개 노드를 가져온 ${next.versions.length}개 버전으로 교체할까요?`
        )
      ) {
        return;
      }
      replaceState(next);
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "프롬프트 JSON 형식이 아닙니다.",
        true
      );
    }
  }

  function toggleFocusMode() {
    setFocusMode((current) => {
      const next = !current;
      localStorage.setItem("prompt-manager-focus-output", String(next));
      return next;
    });
  }

  function requestInsertion(text: string) {
    if (!text) return;
    if (activeTab === "suggestedReplies" || activeTab === "variables") {
      announce("해당 탭에서는 로어북 본문을 삽입할 수 없습니다.", true);
      return;
    }
    setInsertionRequest({ id: Date.now(), text });
  }

  function consumeInsertion(start: number, end: number) {
    if (!insertionRequest) return null;
    const before = activeText.slice(0, start);
    const after = activeText.slice(end);
    const next = `${before}${insertionRequest.text}${after}`;
    const position = start + insertionRequest.text.length;
    updateActiveText(next);
    setInsertionRequest(null);
    return position;
  }

  return {
    ...persistence,
    activeTab,
    activeVersion,
    activeText,
    showDiff,
    diffLines,
    focusMode,
    versionDialogOpen,
    editingVersionId,
    versionDraft,
    versionDraftTab,
    insertionRequest,
    setActiveTab,
    selectVersion,
    updateActiveText,
    updateSuggestedReply,
    moveVersion,
    openCreateVersion,
    openEditVersion,
    closeVersionDialog,
    updateVersionDraft,
    saveVersionDraft,
    deleteVersion,
    copyActive,
    copyAll,
    exportJson,
    importJson,
    setShowDiff,
    toggleFocusMode,
    requestInsertion,
    consumeInsertion
  };
}
