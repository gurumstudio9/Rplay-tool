import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router";
import type { SaveState } from "../settings/SettingsCommandBar";
import { useWorks } from "../works/WorkContext";
import { loadPromptState, savePromptState } from "./api";
import { normalizePromptState, type PromptState } from "./model";
import { promptContentSignature } from "./promptDirty";

const emptyState = normalizePromptState({});

export function usePromptPersistence(activeWorkId: string) {
  const [state, setState] = useState<PromptState>(emptyState);
  const [savedState, setSavedState] = useState<PromptState>(emptyState);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const stateRef = useRef(state);
  const savedStateRef = useRef(savedState);
  const loadedRef = useRef(false);
  const savingRef = useRef(false);
  const scopeRef = useRef(0);
  const dirtyRef = useRef(false);
  const { registerWorkspaceGuard } = useWorks();
  const dirty = useMemo(
    () => promptContentSignature(state) !== promptContentSignature(savedState),
    [state, savedState]
  );

  const setCurrentState = useCallback((next: PromptState) => {
    stateRef.current = next;
    dirtyRef.current = promptContentSignature(next) !== promptContentSignature(savedStateRef.current);
    setState(next);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    ++scopeRef.current;
    loadedRef.current = false;
    savingRef.current = false;
    dirtyRef.current = false;
    savedStateRef.current = emptyState;
    setSavedState(emptyState);
    setCurrentState(emptyState);
    setLoaded(false);
    setSaveState("loading");
    setStatusMessage("");
    void loadPromptState(activeWorkId, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        savedStateRef.current = next;
        setSavedState(next);
        setCurrentState(next);
        loadedRef.current = true;
        setLoaded(true);
        setSaveState("idle");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSaveState("error");
        setStatusMessage(error instanceof Error ? error.message : "프롬프트 데이터를 불러오지 못했습니다.");
      });
    return () => {
      controller.abort();
      ++scopeRef.current;
    };
  }, [activeWorkId, loadVersion, setCurrentState]);

  const replaceState = useCallback((value: PromptState) => {
    if (!loadedRef.current) return;
    setCurrentState(value);
    if (!savingRef.current) setSaveState("idle");
    setStatusMessage("");
  }, [setCurrentState]);

  const saveNow = useCallback(async () => {
    if (!loadedRef.current || savingRef.current || !dirtyRef.current) return false;
    const next = normalizePromptState(stateRef.current);
    const scope = scopeRef.current;
    const draftAtSave = stateRef.current;
    savingRef.current = true;
    setSaveState("saving");
    setStatusMessage("");
    try {
      await savePromptState(activeWorkId, next);
      if (scope !== scopeRef.current) return true;
      savedStateRef.current = next;
      setSavedState(next);
      // Edits made during the request remain in the draft and stay unsaved.
      setCurrentState(stateRef.current === draftAtSave ? next : stateRef.current);
      setSaveState("saved");
      return true;
    } catch (error) {
      if (scope !== scopeRef.current) return false;
      setSaveState("error");
      setStatusMessage(error instanceof Error ? error.message : "프롬프트 데이터를 저장하지 못했습니다.");
      return false;
    } finally {
      if (scope === scopeRef.current) savingRef.current = false;
    }
  }, [activeWorkId, setCurrentState]);

  const discardChanges = useCallback(() => {
    if (savingRef.current || !dirtyRef.current) return;
    if (!window.confirm("저장하지 않은 작품 프롬프트 변경사항을 취소하고 마지막 저장 내용으로 되돌릴까요?")) return;
    const saved = savedStateRef.current;
    const selectedId = stateRef.current.activeVersionId;
    setCurrentState({
      ...saved,
      activeVersionId: saved.versions.some((version) => version.id === selectedId)
        ? selectedId : saved.activeVersionId
    });
    setSaveState("idle");
    setStatusMessage("마지막 저장 내용으로 되돌렸습니다.");
  }, [setCurrentState]);

  const confirmLeave = useCallback(() => {
    if (savingRef.current) {
      window.alert("작품 프롬프트를 저장 중입니다. 저장이 끝난 뒤 이동해 주세요.");
      return false;
    }
    return !dirtyRef.current || window.confirm("저장하지 않은 작품 프롬프트 변경사항이 있습니다.\n변경사항을 버리고 이동할까요?");
  }, []);

  useEffect(() => registerWorkspaceGuard(confirmLeave), [registerWorkspaceGuard, confirmLeave]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (dirty || saveState === "saving") && currentLocation.pathname !== nextLocation.pathname
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (confirmLeave()) blocker.proceed();
    else blocker.reset();
  }, [blocker, confirmLeave]);

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current && !savingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function saveShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void saveNow();
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("keydown", saveShortcut);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("keydown", saveShortcut);
    };
  }, [saveNow]);

  const announce = useCallback((message: string, error = false) => {
    if (!savingRef.current) setSaveState(error ? "error" : "idle");
    setStatusMessage(message);
  }, []);

  return {
    state, stateRef, dirty, loaded, saveState, statusMessage,
    replaceState, saveNow, discardChanges, announce,
    reload: () => setLoadVersion((current) => current + 1)
  };
}
