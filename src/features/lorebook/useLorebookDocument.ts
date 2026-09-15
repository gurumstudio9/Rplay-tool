import { useEffect, useMemo, useState } from "react";
import { useBlocker } from "react-router";
import { loadLorebook } from "./api";
import {
  cloneLorebookState,
  lorebookDefaultBodyLimit,
  normalizeLorebookState,
  type LorebookState
} from "./model";

export type LorebookSaveStatus = "loading" | "idle" | "saving" | "error";

export function useLorebookDocument(activeWorkId: string) {
  const [savedState, setSavedState] = useState<LorebookState>(
    () => normalizeLorebookState({}, lorebookDefaultBodyLimit(activeWorkId))
  );
  const [draftState, setDraftState] = useState<LorebookState>(
    () => normalizeLorebookState({}, lorebookDefaultBodyLimit(activeWorkId))
  );
  const [status, setStatus] = useState<LorebookSaveStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setMessage("");
    void loadLorebook(activeWorkId, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setSavedState(next);
        setDraftState(cloneLorebookState(next));
        setStatus("idle");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setMessage(
          error instanceof Error ? error.message : "로어북을 불러오지 못했습니다."
        );
      });
    return () => controller.abort();
  }, [activeWorkId]);

  const dirty = useMemo(
    () => JSON.stringify(savedState) !== JSON.stringify(draftState),
    [draftState, savedState]
  );

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const shouldDiscard = window.confirm(
      "저장하지 않은 로어북 변경사항이 있습니다.\n변경사항을 버리고 이동할까요?"
    );
    if (shouldDiscard) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "저장하지 않은 로어북 변경사항이 있습니다.";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  function announce(
    nextMessage: string,
    nextStatus: LorebookSaveStatus = "idle"
  ) {
    setMessage(nextMessage);
    setStatus(nextStatus);
  }

  return {
    savedState,
    setSavedState,
    draftState,
    setDraftState,
    status,
    setStatus,
    message,
    setMessage,
    dirty,
    announce
  };
}
