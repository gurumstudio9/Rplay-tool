import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { helpTopics, type HelpTopicId } from "./topics";
import "../../styles/help.css";

export function HelpButton({ topic, label }: { topic: HelpTopicId; label?: string }) {
  const [open, setOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState(topic);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const summaryId = useId();
  const help = helpTopics[activeTopic];

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [open]);

  return <>
    <button ref={buttonRef} type="button" className={label ? "feature-help-button feature-help-button--label" : "feature-help-button"}
      aria-label={label ?? `${helpTopics[topic].title} 도움말`} aria-haspopup="dialog" aria-expanded={open}
      title={`${helpTopics[topic].title} 도움말`}
      onClick={(event) => { event.stopPropagation(); setActiveTopic(topic); setOpen(true); }}>
      <span aria-hidden="true">?</span>{label && <span>{label}</span>}
    </button>
    {open && createPortal(
      <dialog ref={dialogRef} className="feature-help-dialog" aria-labelledby={titleId} aria-describedby={summaryId}
        onClose={() => { setOpen(false); buttonRef.current?.focus(); }}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
        <div className="feature-help-content">
          <header className="feature-help-header">
            <div><small>알플레이 캔버스툴 · 사용 도움말</small><h2 id={titleId}>{help.title}</h2></div>
            <button type="button" className="feature-help-close" aria-label="도움말 닫기" autoFocus onClick={() => dialogRef.current?.close()}>×</button>
          </header>
          <p id={summaryId} className="feature-help-summary">{help.summary}</p>
          <ol className="feature-help-steps">{help.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          {"note" in help && <p className="feature-help-note">{help.note}</p>}
          <footer className="feature-help-footer">
            {activeTopic !== "guide" ? <button type="button" onClick={() => setActiveTopic("guide")}>처음 사용 순서 보기</button>
              : topic !== "guide" && <button type="button" onClick={() => setActiveTopic(topic)}>이 기능 도움말로 돌아가기</button>}
            <a href="/사용가이드.md" download="알플레이_캔버스툴_사용가이드.md">전체 가이드 내려받기 (.md)</a>
          </footer>
        </div>
      </dialog>, document.body
    )}
  </>;
}
