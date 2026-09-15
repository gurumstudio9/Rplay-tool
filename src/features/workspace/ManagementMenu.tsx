import type { ReactNode } from "react";
import { SidebarSection } from "./WorkspaceSidebar";

export function ManagementMenu({ children }: { children: ReactNode }) {
  return (
    <SidebarSection title="관리" order={30}>
      <div className="management-panel" role="region" aria-label="화면 관리 기능">
        {children}
      </div>
    </SidebarSection>
  );
}
