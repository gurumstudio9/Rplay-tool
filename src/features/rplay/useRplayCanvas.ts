import { useEffect, useState } from "react";
import { downloadJson, readJsonFile, safeFilenamePart } from "./files";
import {
  type AuditReport,
  type RplayFeedback
} from "./model";
import { compareCanvases, formatAuditReport } from "./roundtrip";

export function useRplayCanvas(workId: string) {
  const [auditSourceFile, setAuditSourceFile] = useState<File | null>(null);
  const [auditExportedFile, setAuditExportedFile] = useState<File | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditFeedback, setAuditFeedback] =
    useState<RplayFeedback | null>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);

  useEffect(() => {
    setAuditSourceFile(null);
    setAuditExportedFile(null);
    setAuditReport(null);
    setAuditFeedback(null);
  }, [workId]);

  async function auditCanvases() {
    if (!auditSourceFile || !auditExportedFile) {
      setAuditFeedback({
        tone: "error",
        text: "업로드 직전 생성본과 알플레이 재내보내기본을 모두 선택해 주세요."
      });
      return;
    }

    setAuditBusy(true);
    setAuditReport(null);
    setAuditFeedback({
      tone: "info",
      text: "두 캔버스의 로어북·캐릭터·스타터 본문을 대응시켜 비교하고 있습니다."
    });
    try {
      const [sourceCanvas, exportedCanvas] = await Promise.all([
        readJsonFile(auditSourceFile),
        readJsonFile(auditExportedFile)
      ]);
      const report = compareCanvases(sourceCanvas, exportedCanvas);
      setAuditReport(report);
      setAuditFeedback({
        tone: report.issues.length ? "error" : "success",
        text: formatAuditReport(report)
      });
    } catch (error) {
      setAuditFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "왕복 검증 중 오류가 발생했습니다."
      });
    } finally {
      setAuditBusy(false);
    }
  }

  function downloadAuditReport() {
    if (!auditReport) return;
    downloadJson(
      `rplay_roundtrip_audit_${safeFilenamePart(workId)}.json`,
      auditReport
    );
  }

  return {
    auditSourceFile,
    auditExportedFile,
    auditBusy,
    auditFeedback,
    auditReport,
    setAuditSourceFile,
    setAuditExportedFile,
    auditCanvases,
    downloadAuditReport
  };
}
