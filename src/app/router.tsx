import { createBrowserRouter } from "react-router";
import { AppShell } from "./AppShell";
import { AssetsPage } from "../pages/AssetsPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LorebookPage } from "../pages/LorebookPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PromptsPage } from "../pages/PromptsPage";
import { RplayPage } from "../pages/RplayPage";
import { SettingsPage } from "../pages/SettingsPage";
import { HubsPage } from "../pages/HubsPage";
import { tools } from "../features/tools/tools";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      {
        index: true,
        Component: DashboardPage
      },
      ...tools.map((tool) => ({
        path: tool.path,
        element: tool.id === "settings" ? <SettingsPage />
          : tool.id === "prompts" ? <PromptsPage />
          : tool.id === "lorebook" ? <LorebookPage />
          : tool.id === "assets" ? <AssetsPage />
          : tool.id === "hubs" ? <HubsPage />
          : tool.id === "rplay" ? <RplayPage /> : <NotFoundPage />
      })),
      {
        path: "*",
        Component: NotFoundPage
      }
    ]
  }
]);
