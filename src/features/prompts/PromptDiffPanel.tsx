import { usePromptLabels } from "./usePromptLabels";
import {
  type PromptDiffLine,
  type PromptTab
} from "./model";

export function PromptDiffPanel({
  open,
  tab,
  lines,
  versionCount
}: {
  open: boolean;
  tab: PromptTab;
  lines: PromptDiffLine[];
  versionCount: number;
}) {
  const promptTabLabels = usePromptLabels();
  if (!open) return null;
  return (
    <section className="prompt-diff-panel" aria-label="프롬프트 차이">
      <header>
        <div>
          <span>LINE DIFF</span>
          <strong>{promptTabLabels[tab]} · 첫 두 버전 비교</strong>
        </div>
      </header>
      {versionCount < 2 ? (
        <div className="prompt-diff-empty">비교할 버전이 2개 필요합니다.</div>
      ) : (
        <div className="prompt-diff-output">
          {lines.map((line, index) => (
            <div className={`prompt-diff-line prompt-diff-line--${line.type}`} key={index}>
              <span>{line.prefix}</span>
              <code>{line.text || " "}</code>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
