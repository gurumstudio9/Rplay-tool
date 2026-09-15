import { ToolbarSlot } from "../workspace/WorkspaceSidebar";
import { AutoTextarea } from "../workspace/AutoTextarea";
import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  promptTabLabels,
  type PromptTab,
  type PromptVersion
} from "./model";
import type { PromptInsertionRequest } from "./usePromptManager";

interface PromptEditorProps {
  versions: PromptVersion[];
  activeVersion: PromptVersion | null;
  activeTab: PromptTab;
  activeText: string;
  focusMode: boolean;
  insertionRequest: PromptInsertionRequest;
  onSelectVersion: (id: string) => void;
  onTextChange: (value: string) => void;
  onSuggestedReplyChange: (index: number, value: string) => void;
  onConsumeInsertion: (start: number, end: number) => number | null;
  onToggleFocus: () => void;
  onCopyActive: () => void;
  onCopyAll: () => void;
  onToggleDiff: () => void;
  diffOpen: boolean;
}

export function PromptEditor({
  versions,
  activeVersion,
  activeTab,
  activeText,
  focusMode,
  insertionRequest,
  onSelectVersion,
  onTextChange,
  onSuggestedReplyChange,
  onConsumeInsertion,
  onToggleFocus,
  onCopyActive,
  onCopyAll,
  onToggleDiff,
  diffOpen
}: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const matches = useMemo(() => {
    const needle = query.toLocaleLowerCase("ko-KR");
    if (!needle || activeTab === "suggestedReplies") return [];
    const source = activeText.toLocaleLowerCase("ko-KR");
    const result: number[] = [];
    let index = source.indexOf(needle);
    while (index !== -1) {
      result.push(index);
      index = source.indexOf(needle, index + Math.max(1, needle.length));
    }
    return result;
  }, [activeTab, activeText, query]);

  useEffect(() => {
    setMatchIndex(0);
  }, [activeTab, activeVersion?.id, query]);

  useEffect(() => {
    if (!insertionRequest || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const position = onConsumeInsertion(
      textarea.selectionStart,
      textarea.selectionEnd
    );
    if (position === null) return;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(position, position);
    });
  }, [insertionRequest?.id]);

  function selectMatch(index: number) {
    if (!matches.length || !textareaRef.current) return;
    const nextIndex = (index + matches.length) % matches.length;
    setMatchIndex(nextIndex);
    const start = matches[nextIndex];
    const textarea = textareaRef.current;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(start, start + query.length);
    const mirror = document.createElement("div");
    const style = window.getComputedStyle(textarea);
    for (const property of ["font", "line-height", "letter-spacing", "padding", "border", "box-sizing", "tab-size"]) {
      mirror.style.setProperty(property, style.getPropertyValue(property));
    }
    Object.assign(mirror.style, { position: "absolute", visibility: "hidden", width: `${textarea.offsetWidth}px`, whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
    mirror.textContent = activeText.slice(0, start);
    const marker = document.createElement("span");
    marker.textContent = activeText.slice(start, start + query.length) || " ";
    mirror.append(marker);
    document.body.append(mirror);
    const offset = marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
    mirror.remove();
    textarea.scrollTop = Math.max(0, offset - textarea.clientHeight / 2);
    textarea.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <section className={focusMode ? "prompt-editor is-focused" : "prompt-editor"}>
      <header className="prompt-editor-head" aria-label="본문 도구">
        <div className="prompt-editor-context">
          <span>{promptTabLabels[activeTab]}</span>
          {activeTab === "mainPrompt" ? (
            <strong>작품 공통 · 모든 노드에 적용</strong>
          ) : (
            <label>
              <span className="sr-only">선택 노드</span>
              <select
                value={activeVersion?.id ?? ""}
                disabled={!versions.length}
                onChange={(event) => onSelectVersion(event.target.value)}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="prompt-editor-tools">
          <label className="prompt-search">
            <span className="sr-only">본문 검색</span>
            <input
              type="search"
              value={query}
              disabled={activeTab === "suggestedReplies"}
              placeholder="본문 검색"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                selectMatch(matchIndex + (event.shiftKey ? -1 : 1));
              }}
            />
            <span>{query ? `${matches.length ? matchIndex + 1 : 0}/${matches.length}` : ""}</span>
            <button
              type="button"
              disabled={!matches.length}
              aria-label="이전 검색 결과"
              onClick={() => selectMatch(matchIndex - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={!matches.length}
              aria-label="다음 검색 결과"
              onClick={() => selectMatch(matchIndex + 1)}
            >
              ↓
            </button>
          </label>
          <ToolbarSlot slot="actions"><button type="button" onClick={onCopyActive}>선택 복사</button></ToolbarSlot>
          <button type="button" onClick={onCopyAll}>전체 복사</button>
          <button
            className={diffOpen ? "is-active" : ""}
            type="button"
            onClick={onToggleDiff}
          >
            diff
          </button>
          <button
            className={focusMode ? "is-active" : ""}
            type="button"
            aria-pressed={focusMode}
            onClick={onToggleFocus}
          >
            집중
          </button>
          <strong>{activeText.length.toLocaleString()}자</strong>
        </div>
      </header>

      {activeTab === "suggestedReplies" ? (
        <div className="prompt-replies">
          {[0, 1, 2].map((index) => {
            const value = activeVersion?.suggestedReplies[index] ?? "";
            return (
              <label key={index}>
                <span>
                  추천 답변 {index + 1}
                  <small>{value.length}/500자</small>
                </span>
                <AutoTextarea
                  value={value}
                  maxLength={500}
                  disabled={!activeVersion}
                  placeholder={`추천 답변 ${index + 1}을 입력하세요`}
                  onChange={(event) =>
                    onSuggestedReplyChange(index, event.target.value)}
                />
              </label>
            );
          })}
        </div>
      ) : (
        <AutoTextarea
          ref={textareaRef}
          className="prompt-main-textarea"
          value={activeText}
          disabled={activeTab !== "mainPrompt" && !activeVersion}
          spellCheck={false}
          aria-label={promptTabLabels[activeTab]}
          placeholder={activeTab === "mainPrompt"
            ? "작품 전체에 적용할 메인 프롬프트를 입력하세요."
            : "선택한 노드의 내용을 입력하세요."}
          onChange={(event) => onTextChange(event.target.value)}
        />
      )}
    </section>
  );
}
