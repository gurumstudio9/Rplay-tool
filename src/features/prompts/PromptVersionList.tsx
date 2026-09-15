import { SidebarSection } from "../workspace/WorkspaceSidebar";
import {
  versionPreviewTab,
  type PromptTab,
  type PromptVersion
} from "./model";

function previewText(version: PromptVersion, tab: PromptTab) {
  if (tab === "suggestedReplies") return version.suggestedReplies.join("\n\n");
  const field = versionPreviewTab(tab);
  return version[field];
}

function trimPreview(value: string, limit = 220) {
  const text = value.trim();
  if (!text) return "내용 없음";
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

interface PromptVersionListProps {
  versions: PromptVersion[];
  activeVersionId: string;
  activeTab: PromptTab;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onCopy: (version: PromptVersion) => void;
  onEdit: (id: string) => void;
}

export function PromptVersionList({
  versions,
  activeVersionId,
  activeTab,
  onSelect,
  onMove,
  onCopy,
  onEdit
}: PromptVersionListProps) {
  if (!versions.length) {
    return (
      <SidebarSection order={18}>
      <aside className="prompt-version-list prompt-version-list--empty">
        <strong>등록된 노드이 없습니다</strong>
        <p>관리 메뉴의 노드 추가로 첫 노드을 만드세요.</p>
      </aside>
      </SidebarSection>
    );
  }
  return (
    <SidebarSection order={18}>
    <aside className="prompt-version-list" aria-label="프롬프트 노드 목록">
      <div className="prompt-version-scroll">
        {versions.map((version, index) => {
          const text = previewText(version, activeTab);
          return (
            <article
              className={version.id === activeVersionId ? "is-active" : ""}
              key={version.id}
            >
              <button
                className="prompt-version-select"
                type="button"
                onClick={() => onSelect(version.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{version.name}</strong>
                <em>{version.nodeType === "start" ? "시작" : "일반"}</em>
                <small>{text.length.toLocaleString()}자</small>
                <p>{trimPreview(text)}</p>
                {version.notes ? <em>{version.notes}</em> : null}
              </button>
              <div className="prompt-version-actions">
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={`${version.name} 위로 이동`}
                  onClick={() => onMove(version.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === versions.length - 1}
                  aria-label={`${version.name} 아래로 이동`}
                  onClick={() => onMove(version.id, 1)}
                >
                  ↓
                </button>
                <button type="button" onClick={() => onCopy(version)}>
                  복사
                </button>
                <button type="button" onClick={() => onEdit(version.id)}>
                  수정
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
    </SidebarSection>
  );
}
