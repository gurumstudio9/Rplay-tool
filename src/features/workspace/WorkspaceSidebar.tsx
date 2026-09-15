import { createContext, useContext, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const sidebarOrders = [0, 1, 2, 3, 10, 12, 18, 20, 21, 22, 24, 25, 30, 40, 42, 44] as const;
export const rightSidebarOrders: readonly number[] = [12, 42, 44, 22, 24, 25, 40];
export const WorkspaceSidebarContext = createContext<Partial<Record<number, HTMLElement | null>>>({});
const SidebarActiveContext = createContext(true);

/** Move the original control, including its handler and disabled state, into the action sidebar. */
export function ToolbarSlot({ children, slot = "actions" }: {
  children: ReactNode;
  slot?: "actions" | "status" | "save";
}) {
  const host = useContext(WorkspaceSidebarContext)[{ actions: 0, status: 1, save: 2 }[slot]];
  const active = useContext(SidebarActiveContext);
  return host && active ? createPortal(children, host) : null;
}

/** Keep inactive tools mounted without showing their controls in the shared sidebar. */
export function SidebarScope({ active, children }: { active: boolean; children: ReactNode }) {
  return <SidebarActiveContext value={active}>{children}</SidebarActiveContext>;
}

/** Page-owned controls keep their state and event handlers when rendered in the shell. */
export function SidebarSection({ children, title, order = 20 }: {
  children: ReactNode;
  title?: string;
  order?: number;
}) {
  const host = useContext(WorkspaceSidebarContext)[order];
  const active = useContext(SidebarActiveContext);
  const titleId = useId();
  if (!host || !active) return null;
  return createPortal(
    <section className="workspace-sidebar-section" aria-labelledby={title ? titleId : undefined}>
      {title && <h2 className="workspace-sidebar-heading" id={titleId}>{title}</h2>}
      {children}
    </section>,
    host
  );
}
