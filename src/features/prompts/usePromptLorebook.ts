import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  loadPromptLorebook,
  savePromptLorebook
} from "./lorebookApi";
import {
  blankPromptLorebookEntry,
  normalizePromptLorebookEntry,
  normalizePromptLorebookState,
  promptLorebookBodyUnavailable,
  promptLorebookTypeLabel,
  type PromptLorebookEntry
} from "./lorebookModel";

export function usePromptLorebook(activeWorkId: string) {
  const [state, setState] = useState(() => normalizePromptLorebookState({}));
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptLorebookEntry | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setMessage("");
    setEditorOpen(false);
    setEditingId(null);
    setDraft(null);
    void loadPromptLorebook(activeWorkId, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setState(next);
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

  const entries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ko-KR");
    return state.entries
      .filter((entry) => {
        if (typeFilter !== "all" && entry.type !== typeFilter) return false;
        if (!needle) return true;
        return [
          entry.title,
          entry.body,
          entry.triggers.join(" "),
          promptLorebookTypeLabel(entry.type)
        ].some((value) => value.toLocaleLowerCase("ko-KR").includes(needle));
      })
      .sort((left, right) =>
        (right.bodyModifiedAt || right.updatedAt).localeCompare(
          left.bodyModifiedAt || left.updatedAt
        )
      );
  }, [query, state.entries, typeFilter]);

  function openEntry(id: string) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    setEditingId(id);
    setDraft({ ...entry, triggers: [...entry.triggers] });
    setEditorOpen(true);
  }

  function openCreate() {
    setEditingId(null);
    setDraft(blankPromptLorebookEntry(state.entries));
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setDraft(null);
  }

  function updateDraft(patch: Partial<PromptLorebookEntry>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  async function saveDraft() {
    if (!draft) return false;
    if (!draft.title.trim() && !draft.body.trim()) {
      setStatus("error");
      setMessage("제목 또는 본문을 입력해 주세요.");
      return false;
    }
    if (promptLorebookBodyUnavailable(draft)) {
      setStatus("error");
      setMessage(`${draft.bodyFileName} 본문을 읽지 못해 저장할 수 없습니다.`);
      return false;
    }
    const nextEntry = normalizePromptLorebookEntry({
      ...draft,
      updatedAt: new Date().toISOString()
    });
    const entries = editingId
      ? state.entries.map((entry) => entry.id === editingId ? nextEntry : entry)
      : [...state.entries, nextEntry];
    setStatus("saving");
    setMessage("");
    try {
      const next = await savePromptLorebook(activeWorkId, {
        ...state,
        entries
      });
      setState(next);
      setStatus("idle");
      setMessage("로어북 항목 저장됨");
      closeEditor();
      return true;
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "로어북을 저장하지 못했습니다."
      );
      return false;
    }
  }

  async function deleteDraft() {
    if (!draft || !editingId) return;
    const notice = draft.bodyStorage === "sidecar-md-v1"
      ? `\n${draft.fileName}과 ${draft.bodyFileName}이 함께 삭제됩니다.`
      : "";
    if (!window.confirm(`${draft.title || "제목 없음"} 항목을 삭제할까요?${notice}`)) {
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const next = await savePromptLorebook(activeWorkId, {
        ...state,
        entries: state.entries.filter((entry) => entry.id !== editingId)
      });
      setState(next);
      setStatus("idle");
      setMessage("로어북 항목 삭제됨");
      closeEditor();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "로어북을 삭제하지 못했습니다."
      );
    }
  }

  return {
    state,
    status,
    message,
    query,
    typeFilter,
    editorOpen,
    editingId,
    draft,
    entries,
    setQuery,
    setTypeFilter,
    openEntry,
    openCreate,
    closeEditor,
    updateDraft,
    saveDraft,
    deleteDraft
  };
}
