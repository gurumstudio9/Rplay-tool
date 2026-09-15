import type { HTMLAttributes } from "react";
import { SidebarSection } from "./WorkspaceSidebar";

export function FilterBar({ className = "", children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <SidebarSection title="검색·필터" order={20}>
      <section {...props} className={`${className} workspace-filter-bar is-expanded`}>
        <div className="filter-content">{children}</div>
      </section>
    </SidebarSection>
  );
}
