import { ToolbarSlot, SidebarSection } from "../workspace/WorkspaceSidebar";
import { useState } from "react";
import type { CanvasAuditReport, RplayFeedback } from "./model";
import { analyzeCanvasJson } from "./analyzer";
import { RplayFeedbackPanel } from "./RplayFeedbackPanel";

interface RplayCanvasAnalyzerProps {
  workId: string;
}

export function RplayCanvasAnalyzer({ workId }: RplayCanvasAnalyzerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<RplayFeedback | null>(null);
  const [report, setReport] = useState<CanvasAuditReport | null>(null);

  const handleFileChange = (newFile: File | null) => {
    setFile(newFile);
    setReport(null);
    setFeedback(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setBusy(true);
    setFeedback(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = analyzeCanvasJson(file.name, json);
      setReport(result);
      setFeedback({
        tone: result.orphanNodes.length === 0 ? "success" : "info",
        text: `분석 완료: 총 ${result.totalNodes}개 노드, ${result.totalConnections}개 연결선, 고립 노드 ${result.orphanNodes.length}개`
      });
    } catch (err) {
      setFeedback({
        tone: "error",
        text: `캔버스 JSON 파싱 실패: ${err instanceof Error ? err.message : String(err)}`
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rplay-panel">
      <SidebarSection order={18}><header className="rplay-panel-heading">
        <span>03</span>
        <div>
          <strong>알플레이 캔버스 노드 분석기</strong>
          <p>
            캔버스 내보내기 JSON을 분석하여 스토리 노드 전이 흐름,
            변수 바인딩, 허브 결선, 고립 노드를 전수 진단합니다.
          </p>
        </div>
        <em>CANVAS NODE AUDIT</em>
      </header></SidebarSection>

      <div className="rplay-panel-body">
        <SidebarSection order={20}><div className="rplay-file-action">
          <label className="rplay-file-picker">
            <span>캔버스 내보내기 JSON</span>
            <strong>{file?.name ?? "canvas-export-*.json 파일을 선택하세요"}</strong>
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
          <ToolbarSlot slot="actions"><button
            className="rplay-primary-button"
            type="button"
            disabled={busy || !file}
            onClick={() => void handleAnalyze()}
          >
            {busy ? "캔버스 분석 중…" : "캔버스 노드 분석"}
          </button></ToolbarSlot>
        </div></SidebarSection>

        <RplayFeedbackPanel feedback={feedback} />

        {report && (
          <div className="rplay-analyzer-report" style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
            {/* 1. Summary Badges */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem" }}>
              <div className="rplay-stat-box">
                <span className="rplay-stat-label">총 노드</span>
                <strong className="rplay-stat-value">{report.totalNodes}개</strong>
              </div>
              <div className="rplay-stat-box">
                <span className="rplay-stat-label">총 연결선</span>
                <strong className="rplay-stat-value">{report.totalConnections}개</strong>
              </div>
              <div className="rplay-stat-box">
                <span className="rplay-stat-label">로어북 결선</span>
                <strong className="rplay-stat-value" style={{ color: report.connectedLorebookCount === report.lorebookCount ? "#4ade80" : "#f59e0b" }}>
                  {report.connectedLorebookCount} / {report.lorebookCount} ({report.lorebookCount > 0 ? Math.round(report.connectedLorebookCount / report.lorebookCount * 100) : 0}%)
                </strong>
              </div>
              <div className="rplay-stat-box">
                <span className="rplay-stat-label">고립 노드</span>
                <strong className="rplay-stat-value" style={{ color: report.orphanNodes.length === 0 ? "#4ade80" : "#dc2626" }}>
                  {report.orphanNodes.length}개
                </strong>
              </div>
            </div>

            {/* 2. Story Nodes & Transition Flows */}
            <div className="rplay-analysis-section">
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#c5a059", fontSize: "0.95rem" }}>🔄 스토리 노드 전이 및 연결망</h4>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {report.storyNodes.map(sn => (
                  <div key={sn.uid} className="rplay-flow-card">
                    <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem", color: "#f5eedf" }}>
                      {sn.isStarter && <span style={{ background: "#f59e0b", color: "#000", padding: "1px 6px", borderRadius: "4px", fontSize: "0.75rem" }}>START</span>}
                      {sn.title}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#a89680", marginTop: "0.3rem", display: "grid", gap: "0.2rem" }}>
                      {sn.inbound.map((ib, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <span style={{ color: "#38bdf8" }}>◀ 수신:</span> {ib.from} {ib.condition && <span style={{ color: "#f59e0b" }}>({ib.condition})</span>} {ib.port && <small style={{ color: "#6e5f4f" }}>[{ib.port}]</small>}
                        </div>
                      ))}
                      {sn.outbound.map((ob, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <span style={{ color: "#4ade80" }}>▶ 전이:</span> {ob.to} {ob.condition && <span style={{ color: "#f59e0b" }}>({ob.condition})</span>} {ob.port && <small style={{ color: "#6e5f4f" }}>[{ob.port}]</small>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Variables Table */}
            <div className="rplay-analysis-section">
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#c5a059", fontSize: "0.95rem" }}>⚡ 등록 변수 점검표 ({report.variables.length}개)</h4>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #422d1b", color: "#a89680" }}>
                      <th style={{ padding: "6px" }}>변수명</th>
                      <th style={{ padding: "6px" }}>타이틀</th>
                      <th style={{ padding: "6px" }}>타입</th>
                      <th style={{ padding: "6px" }}>초기값</th>
                      <th style={{ padding: "6px" }}>연결된 룰</th>
                      <th style={{ padding: "6px" }}>트리거 사용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.variables.map(v => (
                      <tr key={v.name} style={{ borderBottom: "1px solid rgba(66, 45, 27, 0.4)" }}>
                        <td style={{ padding: "6px", fontWeight: 700, color: "#f5eedf" }}>{v.name}</td>
                        <td style={{ padding: "6px", color: "#a89680" }}>{v.title}</td>
                        <td style={{ padding: "6px", color: "#38bdf8" }}>{v.type}</td>
                        <td style={{ padding: "6px", color: "#4ade80" }}>{JSON.stringify(v.initValue)}</td>
                        <td style={{ padding: "6px", color: "#a89680" }}>{v.connectedRules.join(", ") || "-"}</td>
                        <td style={{ padding: "6px", color: v.triggerUsageCount > 0 ? "#f59e0b" : "#6e5f4f" }}>{v.triggerUsageCount}회</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Hubs Status */}
            {report.hubs.length > 0 && (
              <div className="rplay-analysis-section">
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#c5a059", fontSize: "0.95rem" }}>🔌 허브(Hub) 결선 현황 ({report.hubs.length}개)</h4>
                <div style={{ display: "grid", gap: "0.4rem" }}>
                   {report.hubs.map((h, idx) => (
                    <div key={idx} style={{ background: "rgba(0,0,0,0.3)", padding: "8px 12px", borderRadius: "6px", fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{h.name}</strong>
                      <span style={{ color: "#a89680" }}>수신 {h.inboundCount}개 노드 ➔ 송출 {h.outboundCount}개 스토리 노드</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Orphans Alert */}
            {report.orphanNodes.length > 0 && (
              <div style={{ background: "rgba(220, 38, 38, 0.15)", border: "1px solid #dc2626", padding: "10px", borderRadius: "6px" }}>
                <h4 style={{ margin: "0 0 0.4rem 0", color: "#dc2626", fontSize: "0.9rem" }}>⚠️ 고립(미연결) 노드 발견 ({report.orphanNodes.length}개)</h4>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem", color: "#f5eedf" }}>
                  {report.orphanNodes.map(on => (
                    <li key={on.uid}>{on.label}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 6. Image Nodes */}
          </div>
        )}
      </div>
    </section>
  );
}
