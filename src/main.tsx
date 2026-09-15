import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./app/router";
import { WorkProvider } from "./features/works/WorkContext";
import "./styles/global.css";
import "./styles/workspace.css";
import "./styles/sidebar.css";
import "./styles/toolbar.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("앱을 표시할 #root 요소를 찾지 못했습니다.");
}

createRoot(root).render(
  <StrictMode>
    <WorkProvider>
      <RouterProvider router={router} />
    </WorkProvider>
  </StrictMode>
);
