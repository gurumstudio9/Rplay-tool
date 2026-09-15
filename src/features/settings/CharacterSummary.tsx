import { AutoTextarea } from "../workspace/AutoTextarea";
interface CharacterSummaryProps {
  value: string;
  hasCharacter: boolean;
}

export function CharacterSummary({ value, hasCharacter }: CharacterSummaryProps) {
  return (
    <aside className="settings-panel settings-summary-panel">
      <header className="settings-panel-header">
        <div>
          <span>SUMMARY</span>
          <strong>복사용 설정 요약</strong>
        </div>
        <span>{hasCharacter ? "선택 1명" : ""}</span>
      </header>
      <AutoTextarea readOnly value={value} spellCheck={false} />
    </aside>
  );
}
