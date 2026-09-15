import { SidebarSection, SidebarScope } from "../features/workspace/WorkspaceSidebar";
import { useState } from "react";
import { RplayRoundtripAudit } from "../features/rplay/RplayRoundtripAudit";
import { RplayCanvasAnalyzer } from "../features/rplay/RplayCanvasAnalyzer";
import { RplayCanvasContentEditor } from "../features/rplay/RplayCanvasContentEditor";
import { useRplayCanvas } from "../features/rplay/useRplayCanvas";
import { useWorks } from "../features/works/WorkContext";
import "../styles/rplay.css";

export function RplayPage() {
  const { activeWorkId, activePlatformId, activeWork } = useWorks();
  const workKey = `${activeWorkId}::${activePlatformId}`;
  const manager = useRplayCanvas(workKey);
  const [activeTool, setActiveTool] = useState(0);
  const toolLabels = ["콘텐츠 편집", "왕복 검증", "노드 분석"];
  const workName = activeWork?.name ?? "현재 작품";

  return (
    <div className="rplay-page">
      <SidebarSection order={10}>
      <section className="rplay-hero">
        <div className="rplay-hero-mark" aria-hidden="true">R</div>
        <div>
          <span>RPLAY CANVAS PIPELINE</span>
          <h1>알플레이 캔버스 도구</h1>
          <p>
            {workName}의 관리 데이터를 캔버스 노드에 주입하고,
            알플레이 왕복 과정에서 본문이 잘리거나 누락되지 않았는지 검사합니다.
          </p>
        </div>
        <dl>
          <div>
            <dt>작품</dt>
            <dd>{workName}</dd>
          </div>
          <div>
            <dt>구성</dt>
            <dd>편집 · 검증 · 분석</dd>
          </div>
        </dl>
        <SidebarSection order={12} title="작업 선택">
          <div className="workspace-action-group">
            <span>작업 선택</span>
            {toolLabels.map((label, index) => <button className="workspace-action" type="button" aria-pressed={activeTool === index} key={label} onClick={() => setActiveTool(index)}>{label}</button>)}
          </div>
        </SidebarSection>
      </section>
      </SidebarSection>
      {activeTool !== 0 && <p className="rplay-current-tool">현재 도구 · <strong>{toolLabels[activeTool]}</strong></p>}

      <SidebarScope active={activeTool === 1}><div hidden={activeTool !== 1}>
      <RplayRoundtripAudit
        busy={manager.auditBusy}
        exportedFile={manager.auditExportedFile}
        feedback={manager.auditFeedback}
        report={manager.auditReport}
        sourceFile={manager.auditSourceFile}
        onAudit={() => void manager.auditCanvases()}
        onDownloadReport={manager.downloadAuditReport}
        onExportedFileChange={manager.setAuditExportedFile}
        onSourceFileChange={manager.setAuditSourceFile}
      />
      </div></SidebarScope>

      <SidebarScope active={activeTool === 2}><div hidden={activeTool !== 2}>
      <RplayCanvasAnalyzer workId={workKey} />
      </div></SidebarScope>

      <SidebarScope active={activeTool === 0}><div hidden={activeTool !== 0}>
      <RplayCanvasContentEditor
        key={workKey}
        workId={workKey}
        workName={workName}
      />
      </div></SidebarScope>
    </div>
  );
}


