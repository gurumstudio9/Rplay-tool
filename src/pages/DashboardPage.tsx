import { ToolbarSlot, SidebarSection } from "../features/workspace/WorkspaceSidebar";
import { ManagementMenu } from "../features/workspace/ManagementMenu";
import { useState } from "react";
import { Link } from "react-router";
import { toolGroups, tools } from "../features/tools/tools";
import { useWorks } from "../features/works/WorkContext";
import { HelpButton } from "../features/help/HelpButton";

export function DashboardPage() {
  const { activeWork, activeWorkId, activePlatformId, status } = useWorks();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  async function exportMarkdown() {
    setExporting(true);
    setExportMessage("");
    try {
      const query = new URLSearchParams({ workId: activeWorkId, platformId: activePlatformId });
      const response = await fetch(`/api/export/work-markdown?${query}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "작품 MD 저장에 실패했습니다.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${activeWorkId}_${activePlatformId}_전체.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setExportMessage(`${activeWork?.name || activeWorkId} · ${activePlatformId} MD 다운로드를 시작했습니다.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "작품 MD 저장에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page-stack">
      <SidebarSection order={10}>
      <section className="hero-panel dashboard-hero">
        <div>
          <span className="eyebrow">CHARACTER WORKSPACE</span>
          <h1>{activeWork?.name ?? "작품"} 관리 공간</h1>
          <p>
            캐릭터, 프롬프트, 캔버스 구성 중 필요한 도구를 선택하세요.
          </p>
          {exportMessage && <p role="status">{exportMessage}</p>}
        </div>
        <ManagementMenu>
          <div className="dashboard-export">
            <ToolbarSlot slot="actions"><span className="feature-help-pair"><button type="button" disabled={exporting || status !== "ready"} onClick={() => void exportMarkdown()}>
              {exporting ? "MD 조립 중…" : "작품 전체 MD 저장"}
            </button><HelpButton topic="markdown" /></span></ToolbarSlot>
            <small>{activePlatformId} · 저장된 모든 시작상황, 공통 로어북, 캐릭터 MD</small>
          </div>
        </ManagementMenu>
      </section>
      </SidebarSection>

      {toolGroups.map((group) => (
        <section className="tool-section" key={group}>
          <div className="section-heading">
            <h2>{group}</h2>
            <span>{tools.filter((tool) => tool.group === group).length}개 도구</span>
          </div>
          <div className="tool-grid">
            {tools
              .filter((tool) => tool.group === group)
              .map((tool) => (
                <Link className="tool-card" to={`/${tool.path}`} key={tool.id}>
                  <span className="tool-card-mark" aria-hidden="true">{tool.shortLabel}</span>
                  <span className="tool-card-copy">
                    <strong>{tool.label}</strong>
                    <small>{tool.description}</small>
                  </span>
                  <span className="tool-card-arrow" aria-hidden="true">→</span>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
