import { useEffect, useMemo, useState } from "react";
import {
  deleteAsset,
  listAssets,
  loadAsset,
  saveAsset
} from "./api";
import {
  assetVariableDefaults,
  extractAssetVariables,
  initialAssetTemplate,
  normalizeAssetName,
  validateAssetName,
  type AssetPreviewMode,
  type AssetPreviewValue,
  type AssetPreviewVariable,
  type AssetStatus,
  type AssetSummary
} from "./model";
import { loadRplayVariables } from "../prompts/api";

export function useAssetManager(activeWorkId: string, activePlatformId: string) {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [mockData, setMockData] = useState<Record<string, AssetPreviewValue>>({});
  const [rplayVariables, setRplayVariables] = useState<AssetPreviewVariable[]>([]);
  const [variableStatus, setVariableStatus] = useState<"idle" | "loading" | "error">("idle");
  const [variableMessage, setVariableMessage] = useState("");
  const [status, setStatus] = useState<AssetStatus>("loading");
  const [message, setMessage] = useState("");

  const dirty = selectedName.length > 0 && savedContent !== draftContent;
  const previewMode: AssetPreviewMode = "rplay";
  const slotVariables = useMemo(
    () => extractAssetVariables(draftContent),
    [draftContent]
  );
  const variables = useMemo<AssetPreviewVariable[]>(
    () => previewMode === "rplay"
      ? rplayVariables
      : slotVariables.map((name) => ({
        name,
        title: name,
        type: "string",
        initialValue: assetVariableDefaults[name] ?? ""
      })),
    [previewMode, rplayVariables, slotVariables]
  );

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setMessage("");
    setAssets([]);
    setSelectedName("");
    setSavedContent("");
    setDraftContent("");
    setMockData({});
    void listAssets(activeWorkId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setAssets(result.assets);
        setStatus("idle");
        setMessage(result.message);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setMessage(
          error instanceof Error ? error.message : "에셋 목록을 불러오지 못했습니다."
        );
      });
    return () => controller.abort();
  }, [activeWorkId]);

  useEffect(() => {
    const controller = new AbortController();
    setRplayVariables([]);
    setVariableMessage("");

    if (previewMode !== "rplay") {
      setVariableStatus("idle");
      return () => controller.abort();
    }

    setVariableStatus("loading");
    void loadRplayVariables(activeWorkId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setRplayVariables(data.variables
          .filter((variable) => variable.variableName.trim().length > 0)
          .map((variable) => ({
            name: variable.variableName.trim(),
            title: variable.title.trim() || variable.variableName.trim(),
            type: variable.variableType,
            initialValue: variable.initValue
          }))
        );
        setVariableStatus("idle");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setVariableStatus("error");
        setVariableMessage(
          error instanceof Error
            ? error.message
            : "알플레이 변수 목록을 불러오지 못했습니다."
        );
      });

    return () => controller.abort();
  }, [activeWorkId, previewMode]);

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "저장하지 않은 에셋 변경사항이 있습니다.";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!variables.length) return;
    setMockData((current) => {
      const next = { ...current };
      let changed = false;
      variables.forEach((variable) => {
        if (next[variable.name] !== undefined) return;
        next[variable.name] = variable.initialValue;
        changed = true;
      });
      return changed ? next : current;
    });
  }, [variables]);

  function announce(nextMessage: string, nextStatus: AssetStatus = "idle") {
    setMessage(nextMessage);
    setStatus(nextStatus);
  }

  async function refreshAssets() {
    const result = await listAssets(activeWorkId);
    setAssets(result.assets);
    if (result.message) setMessage(result.message);
    return result.assets;
  }

  async function selectAsset(name: string) {
    if (dirty && !window.confirm("저장하지 않은 변경을 버리고 다른 에셋을 열까요?")) {
      return;
    }
    setSelectedName(name);
    announce("에셋을 불러오는 중입니다.", "loading");
    try {
      const content = await loadAsset(activeWorkId, name);
      setSavedContent(content);
      setDraftContent(content);
      announce("파일 로드됨");
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "에셋을 불러오지 못했습니다.",
        "error"
      );
    }
  }

  function updateDraft(content: string) {
    setDraftContent(content);
    setStatus("idle");
    setMessage("저장하지 않은 변경사항이 있습니다.");
  }

  function updateMockValue(variable: string, value: AssetPreviewValue) {
    setMockData((current) => ({ ...current, [variable]: value }));
  }

  function resetMockValues() {
    setMockData(Object.fromEntries(
      variables.map((variable) => [variable.name, variable.initialValue])
    ));
  }

  async function saveChanges() {
    if (!selectedName) return false;
    announce("에셋을 저장하는 중입니다.", "saving");
    try {
      await saveAsset(activeWorkId, selectedName, draftContent);
      setSavedContent(draftContent);
      announce("저장 완료");
      return true;
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "에셋을 저장하지 못했습니다.",
        "error"
      );
      return false;
    }
  }

  function cancelChanges() {
    if (!dirty) return;
    if (!window.confirm("저장하지 않은 변경을 취소할까요?")) return;
    setDraftContent(savedContent);
    announce("저장된 내용으로 되돌렸습니다.");
  }

  async function createNewAsset(rawName: string) {
    const validation = validateAssetName(rawName);
    if (validation) {
      announce(validation, "error");
      return false;
    }
    const name = normalizeAssetName(rawName);
    if (assets.some((asset) => asset.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      announce("같은 이름의 에셋이 이미 있습니다.", "error");
      return false;
    }
    announce("새 에셋을 만드는 중입니다.", "saving");
    try {
      await saveAsset(activeWorkId, name, initialAssetTemplate);
      await refreshAssets();
      setSelectedName(name);
      setSavedContent(initialAssetTemplate);
      setDraftContent(initialAssetTemplate);
      announce("새 에셋을 만들었습니다.");
      return true;
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "새 에셋을 만들지 못했습니다.",
        "error"
      );
      return false;
    }
  }

  async function removeSelectedAsset() {
    if (!selectedName) return false;
    if (!window.confirm(`"${selectedName}" 에셋을 영구 삭제할까요?`)) {
      return false;
    }
    announce("에셋을 삭제하는 중입니다.", "saving");
    try {
      await deleteAsset(activeWorkId, selectedName);
      setSelectedName("");
      setSavedContent("");
      setDraftContent("");
      await refreshAssets();
      announce("에셋을 삭제했습니다.");
      return true;
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "에셋을 삭제하지 못했습니다.",
        "error"
      );
      return false;
    }
  }

  return {
    assets,
    selectedName,
    savedContent,
    draftContent,
    mockData,
    variables,
    previewMode,
    variableStatus,
    variableMessage,
    status,
    message,
    dirty,
    selectAsset,
    updateDraft,
    updateMockValue,
    resetMockValues,
    saveChanges,
    cancelChanges,
    createNewAsset,
    removeSelectedAsset,
    announce
  };
}

export type AssetManager = ReturnType<typeof useAssetManager>;
