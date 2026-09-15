import type { ReactNode } from "react";

function IconFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function ToolIcon({ id }: { id: string }) {
  switch (id) {
    case "hubs":
      return <IconFrame><rect x="9" y="9" width="6" height="6" rx="1" /><circle cx="4" cy="4" r="2" /><circle cx="20" cy="4" r="2" /><circle cx="12" cy="21" r="2" /><path d="m6 6 3 3m9-3-3 3m-3 6v4" /></IconFrame>;
    case "settings":
      return (
        <IconFrame>
          <circle cx="12" cy="8" r="3" />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        </IconFrame>
      );
    case "attributes":
      return (
        <IconFrame>
          <path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h9M17 18h3" />
          <circle cx="13" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="15" cy="18" r="2" />
        </IconFrame>
      );
    case "appearance":
      return (
        <IconFrame>
          <path d="m8 4-5 3 2.5 4L8 9v11h8V9l2.5 2L21 7l-5-3a4 4 0 0 1-8 0Z" />
        </IconFrame>
      );
    case "images":
      return (
        <IconFrame>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m4 17 5-5 4 4 2-2 5 4" />
        </IconFrame>
      );
    case "image-prompts":
      return (
        <IconFrame>
          <path d="m4 20 10-10M12 6l6 6M17 3v3M15.5 4.5h3M20 15v4M18 17h4" />
        </IconFrame>
      );
    case "prompts":
      return (
        <IconFrame>
          <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          <path d="M7 9h10M7 13h6" />
        </IconFrame>
      );
    case "lorebook":
      return (
        <IconFrame>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22V5.5Z" />
        </IconFrame>
      );
    case "assets":
      return (
        <IconFrame>
          <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
        </IconFrame>
      );
    case "workers":
      return (
        <IconFrame>
          <path d="M7 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2M17 5h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
          <path d="m13 3-5 10h5l-2 8 5-11h-5l2-7Z" />
        </IconFrame>
      );
    case "intros":
      return (
        <IconFrame>
          <path d="M6 3h8l4 4v14H6V3Z" />
          <path d="M14 3v5h4M9 12h6M9 16h6" />
        </IconFrame>
      );
    case "rplay":
      return (
        <IconFrame>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16M9 10h12" />
        </IconFrame>
      );
    default:
      return (
        <IconFrame>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8M8 12h8" />
        </IconFrame>
      );
  }
}
