import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from "react";
import { loadCharacters, saveCharacters } from "./api";
import {
  characterToForm,
  emptyCharacterForm,
  filterCharacters,
  formToCharacter,
  formatCharacterSummary,
  makeId,
  normalizeCharacter,
  normalizeList,
  type CharacterForm,
  type CharacterGender,
  type CharacterGroup,
  type CharacterRecord
} from "./model";
import type { SaveState } from "./SettingsCommandBar";

function downloadJson(value: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.readOnly = true;
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}

export function useCharacterSettings(activeWorkId: string) {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draftMode, setDraftMode] = useState(false);
  const [form, setForm] = useState<CharacterForm>(emptyCharacterForm);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<CharacterGroup | "all">("all");
  const [genderFilter, setGenderFilter] = useState<CharacterGender | "all">("all");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const charactersRef = useRef<CharacterRecord[]>([]);
  const formRef = useRef<CharacterForm>(form);
  const selectedIdRef = useRef("");
  const draftModeRef = useRef(false);
  const activeWorkIdRef = useRef(activeWorkId);
  const idAutofillRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveSequenceRef = useRef(0);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedId),
    [characters, selectedId]
  );
  const filtered = useMemo(
    () => filterCharacters(characters, query, groupFilter, genderFilter),
    [characters, genderFilter, groupFilter, query]
  );
  const summaryCharacter = useMemo(() => {
    if (!form.name.trim() && !form.id.trim()) return null;
    return formToCharacter(form, draftMode ? undefined : selectedCharacter);
  }, [draftMode, form, selectedCharacter]);
  const summaryText = summaryCharacter
    ? formatCharacterSummary(summaryCharacter)
    : "캐릭터를 선택하거나 새 캐릭터를 추가하세요.";

  const setFormState = useCallback((next: CharacterForm) => {
    formRef.current = next;
    setForm(next);
  }, []);

  const setSelection = useCallback((character?: CharacterRecord) => {
    if (!character) {
      selectedIdRef.current = "";
      draftModeRef.current = true;
      idAutofillRef.current = true;
      setSelectedId("");
      setDraftMode(true);
      setFormState(emptyCharacterForm());
      return;
    }
    selectedIdRef.current = character.id;
    draftModeRef.current = false;
    idAutofillRef.current = false;
    setSelectedId(character.id);
    setDraftMode(false);
    setFormState(characterToForm(character));
  }, [setFormState]);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const controller = new AbortController();
    activeWorkIdRef.current = activeWorkId;
    setSaveState("loading");
    setStatusMessage("");
    setCharacters([]);
    charactersRef.current = [];

    void loadCharacters(activeWorkId, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        charactersRef.current = loaded;
        setCharacters(loaded);
        setSelection(loaded[0]);
        setSaveState("idle");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSaveState("error");
        setStatusMessage(error instanceof Error ? error.message : "캐릭터 설정을 불러오지 못했습니다.");
      });

    return () => controller.abort();
  }, [activeWorkId, setSelection]);

  const enqueueSave = useCallback((next: CharacterRecord[], workId: string) => {
    const sequence = ++saveSequenceRef.current;
    setSaveState("saving");
    setStatusMessage("");
    const operation = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveCharacters(workId, next));
    saveQueueRef.current = operation;
    void operation
      .then(() => {
        if (sequence !== saveSequenceRef.current || activeWorkIdRef.current !== workId) return;
        setSaveState("saved");
      })
      .catch((error: unknown) => {
        if (sequence !== saveSequenceRef.current || activeWorkIdRef.current !== workId) return;
        setSaveState("error");
        setStatusMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
      });
  }, []);

  const commitForm = useCallback((snapshot = formRef.current) => {
    if (!snapshot.name.trim() && !snapshot.id.trim()) return false;
    const current = charactersRef.current;
    const isDraft = draftModeRef.current;
    const previous = isDraft
      ? undefined
      : current.find((character) => character.id === selectedIdRef.current);
    const nextCharacter = formToCharacter(snapshot, previous);

    if (isDraft && current.some((character) => character.id === nextCharacter.id)) {
      setSaveState("error");
      setStatusMessage("같은 ID의 캐릭터가 이미 있습니다.");
      return false;
    }

    const next = isDraft
      ? [...current, nextCharacter]
      : current.map((character) =>
        character.id === selectedIdRef.current ? nextCharacter : character
      );
    charactersRef.current = next;
    setCharacters(next);
    selectedIdRef.current = nextCharacter.id;
    draftModeRef.current = false;
    idAutofillRef.current = false;
    setSelectedId(nextCharacter.id);
    setDraftMode(false);
    setFormState(characterToForm(nextCharacter));
    enqueueSave(next, activeWorkIdRef.current);
    return true;
  }, [enqueueSave, setFormState]);

  const flushPendingSave = useCallback(() => {
    if (!saveTimerRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    commitForm(formRef.current);
  }, [commitForm]);

  const scheduleCommit = useCallback((next: CharacterForm, immediate = false) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("typing");
    setStatusMessage("");
    if (immediate) {
      saveTimerRef.current = null;
      commitForm(next);
      return;
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      commitForm(next);
    }, 450);
  }, [commitForm]);

  function updateFormField(
    field: keyof CharacterForm,
    value: string,
    immediate = false
  ) {
    const next = { ...formRef.current, [field]: value } as CharacterForm;
    if (field === "name" && draftModeRef.current && idAutofillRef.current) {
      next.id = value.trim() ? makeId(value) : "";
    }
    if (field === "id" && draftModeRef.current) idAutofillRef.current = false;
    setFormState(next);
    scheduleCommit(next, immediate);
  }

  function selectCharacter(id: string) {
    flushPendingSave();
    const character = charactersRef.current.find((item) => item.id === id);
    if (character) setSelection(character);
  }

  function createCharacter() {
    flushPendingSave();
    setSelection(undefined);
    setSaveState("idle");
    setStatusMessage("새 캐릭터를 입력하세요.");
  }

  function deleteCharacter() {
    flushPendingSave();
    const character = charactersRef.current.find((item) => item.id === selectedIdRef.current);
    if (!character || !window.confirm(`${character.name} 설정을 삭제할까요?`)) return;
    const next = charactersRef.current.filter((item) => item.id !== character.id);
    charactersRef.current = next;
    setCharacters(next);
    setSelection(next[0]);
    enqueueSave(next, activeWorkIdRef.current);
  }

  function duplicateCharacter() {
    flushPendingSave();
    const character = charactersRef.current.find((item) => item.id === selectedIdRef.current);
    if (!character) return;
    let suffix = 1;
    let id = `${character.id}-copy`;
    while (charactersRef.current.some((item) => item.id === id)) {
      suffix += 1;
      id = `${character.id}-copy-${suffix}`;
    }
    const name = `${character.name} 복제`;
    const duplicate = normalizeCharacter({
      ...character,
      id,
      name,
      aliases: normalizeList([id, name, character.aliases])
    });
    const next = [...charactersRef.current, duplicate];
    charactersRef.current = next;
    setCharacters(next);
    setSelection(duplicate);
    enqueueSave(next, activeWorkIdRef.current);
  }

  async function copyWithStatus(value: string, message: string) {
    try {
      await copyText(value);
      setSaveState("idle");
      setStatusMessage(message);
    } catch {
      setSaveState("error");
      setStatusMessage("클립보드에 복사하지 못했습니다.");
    }
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const rawList = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "characters" in parsed
          ? (parsed as { characters?: unknown }).characters
          : null;
      if (!Array.isArray(rawList)) throw new Error("캐릭터 배열이 없습니다.");
      const next = rawList.map(normalizeCharacter).filter((character) => character.id);
      const ids = new Set(next.map((character) => character.id.toLocaleLowerCase()));
      if (ids.size !== next.length) throw new Error("중복된 캐릭터 ID가 있습니다.");
      if (!window.confirm(`현재 ${charactersRef.current.length}명을 가져온 ${next.length}명으로 교체할까요?`)) return;
      charactersRef.current = next;
      setCharacters(next);
      setSelection(next[0]);
      enqueueSave(next, activeWorkIdRef.current);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "캐릭터 설정 JSON 형식이 아닙니다.");
    }
  }

  function submitForm() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    commitForm();
  }

  return {
    characters,
    selectedId,
    draftMode,
    form,
    query,
    groupFilter,
    genderFilter,
    saveState,
    statusMessage,
    filtered,
    summaryCharacter,
    summaryText,
    setQuery,
    setGroupFilter,
    setGenderFilter,
    createCharacter,
    copyWithStatus,
    importJson,
    exportJson: () =>
      downloadJson(charactersRef.current, `${activeWorkId}-character-settings.json`),
    selectCharacter,
    duplicateCharacter,
    deleteCharacter,
    updateFormField,
    submitForm,
    flushPendingSave,
  };
}
