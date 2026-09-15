import type { RplayFeedback } from "./model";

export function RplayFeedbackPanel({
  feedback
}: {
  feedback: RplayFeedback | null;
}) {
  if (!feedback) return (
    <div className="rplay-result-placeholder">
      오른쪽 사이드바에서 파일과 작업을 선택하면 결과가 여기에 표시됩니다.
    </div>
  );
  return (
    <pre
      className={`rplay-feedback rplay-feedback--${feedback.tone}`}
      aria-live="polite"
    >
      {feedback.text}
    </pre>
  );
}
