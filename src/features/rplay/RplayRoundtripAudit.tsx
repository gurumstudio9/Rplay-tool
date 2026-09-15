import { ToolbarSlot, SidebarSection } from "../workspace/WorkspaceSidebar";
import type { AuditReport, RplayFeedback } from "./model";
import { RplayFeedbackPanel } from "./RplayFeedbackPanel";

type RplayRoundtripAuditProps = {
  busy: boolean;
  exportedFile: File | null;
  feedback: RplayFeedback | null;
  report: AuditReport | null;
  sourceFile: File | null;
  onAudit: () => void;
  onDownloadReport: () => void;
  onExportedFileChange: (file: File | null) => void;
  onSourceFileChange: (file: File | null) => void;
};

function AuditFilePicker({
  index,
  label,
  file,
  disabled,
  onChange
}: {
  index: string;
  label: string;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="rplay-audit-file">
      <span>{index}</span>
      <div>
        <strong>{label}</strong>
        <small>{file?.name ?? "JSON 파일을 선택하세요"}</small>
      </div>
      <input
        type="file"
        accept=".json,application/json"
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export function RplayRoundtripAudit({
  busy,
  exportedFile,
  feedback,
  report,
  sourceFile,
  onAudit,
  onDownloadReport,
  onExportedFileChange,
  onSourceFileChange
}: RplayRoundtripAuditProps) {
  return (
    <section className="rplay-panel">
      <SidebarSection order={18}><header className="rplay-panel-heading">
        <span>02</span>
        <div>
          <strong>알플레이 왕복 잘림 검증기</strong>
          <p>
            업로드 직전 생성본과 알플레이 재내보내기본을 비교하여
            로어북·캐릭터·스타터 본문의 잘림과 누락을 찾습니다.
          </p>
        </div>
        <em>ROUNDTRIP AUDIT</em>
      </header></SidebarSection>

      <div className="rplay-panel-body">
        <SidebarSection order={20}><div className="rplay-audit-files">
          <AuditFilePicker
            index="①"
            label="업로드 직전 생성본"
            file={sourceFile}
            disabled={busy}
            onChange={onSourceFileChange}
          />
          <AuditFilePicker
            index="②"
            label="알플레이 재내보내기본"
            file={exportedFile}
            disabled={busy}
            onChange={onExportedFileChange}
          />
        </div></SidebarSection>

        <SidebarSection order={21}><div className="rplay-audit-actions">
          <ToolbarSlot slot="actions"><button
            className="rplay-primary-button"
            type="button"
            disabled={busy || !sourceFile || !exportedFile}
            onClick={onAudit}
          >
            {busy ? "왕복 검증 중…" : "왕복 잘림 검증"}
          </button></ToolbarSlot>
          {report ? (
            <ToolbarSlot slot="actions"><button
              className="rplay-secondary-button"
              type="button"
              onClick={onDownloadReport}
            >
              검증 JSON 다운로드
            </button></ToolbarSlot>
          ) : null}
        </div></SidebarSection>

        {report ? (
          <div className="rplay-audit-summary" aria-label="왕복 검증 요약">
            <span><small>검사</small><strong>{report.summary.checked}</strong></span>
            <span><small>정상</small><strong>{report.summary.exact}</strong></span>
            <span><small>잘림</small><strong>{report.summary.truncated}</strong></span>
            <span><small>누락</small><strong>{report.summary.missing}</strong></span>
            <span><small>변경</small><strong>{report.summary.changed}</strong></span>
          </div>
        ) : null}

        <RplayFeedbackPanel feedback={feedback} />
      </div>
    </section>
  );
}
