export type JsonObject = Record<string, unknown>;

export type AuditIssueStatus = "truncated" | "missing" | "changed";

export type AuditIssue = {
  status: AuditIssueStatus;
  type: string;
  title: string;
  field: string;
  originalLength: number;
  exportedLength: number;
  removedLength: number;
  differenceAt: number;
  removedPreview: string;
  sourcePreview: string;
  exportedPreview: string;
};

export type AuditSummary = {
  checked: number;
  exact: number;
  truncated: number;
  missing: number;
  changed: number;
};

export type AuditReport = {
  createdAt: string;
  summary: AuditSummary;
  issues: AuditIssue[];
};

export type RplayFeedback = {
  tone: "info" | "success" | "error";
  text: string;
};

export function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

export type CanvasStoryNodeReport = {
  uid: string;
  title: string;
  isStarter: boolean;
  inbound: Array<{ from: string; condition?: string; port?: string }>;
  outbound: Array<{ to: string; condition?: string; port?: string }>;
};

export type CanvasVariableReport = {
  name: string;
  title: string;
  type: string;
  initValue: unknown;
  connectedRules: string[];
  triggerUsageCount: number;
};

export type CanvasImageNodeReport = {
  uid: string;
  title: string;
  isProfile: boolean;
  imageCount: number;
  tags: string[];
};

export type CanvasImageCharacterReport = {
  characterId: string;
  characterName: string;
  nodeTitle: string;
  totalImages: number;
  both: string[];
  imageOnly: string[];
  canvasOnly: string[];
};

export type CanvasAuditReport = {
  filename: string;
  totalNodes: number;
  totalConnections: number;
  nodeTypes: Record<string, number>;
  storyNodes: CanvasStoryNodeReport[];
  variables: CanvasVariableReport[];
  hubs: Array<{ name: string; inboundCount: number; outboundCount: number }>;
  lorebookCount: number;
  connectedLorebookCount: number;
  orphanNodes: Array<{ label: string; type: string; uid: string }>;
  imageNodes: CanvasImageNodeReport[];
  imageCharacters: CanvasImageCharacterReport[];
  unmatchedImageNodes: CanvasImageNodeReport[];
};
