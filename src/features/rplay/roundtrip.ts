import {
  isJsonObject,
  type AuditIssue,
  type AuditIssueStatus,
  type AuditReport,
  type AuditSummary,
  type JsonObject
} from "./model";

type MetadataEntry = {
  key: string;
  node: JsonObject;
};

type TextCompareStatus = "exact" | AuditIssueStatus;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .trimEnd();
}

function stringField(value: JsonObject, field: string) {
  return typeof value[field] === "string" ? value[field] : "";
}

function objectArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isJsonObject) : [];
}

function metadataEntries(canvas: JsonObject): MetadataEntry[] {
  const metadataSet = isJsonObject(canvas.metadataSet) ? canvas.metadataSet : {};
  return Object.entries(metadataSet)
    .filter((entry): entry is [string, JsonObject] => isJsonObject(entry[1]))
    .map(([key, node]) => ({ key, node }));
}

function nodeIdentity(node: JsonObject) {
  return `${stringField(node, "type")}\u0000${stringField(node, "title")}`;
}

function loreEntryIdentity(entry: JsonObject) {
  const id = stringField(entry, "_id");
  if (id) return `id:${id}`;
  const key = stringField(entry, "key");
  if (key) return `key:${key}`;
  const patterns = Array.isArray(entry.patterns)
    ? entry.patterns.map(String).join("|")
    : "";
  return `patterns:${patterns}`;
}

function compareText(
  originalValue: unknown,
  exportedValue: unknown,
  exportedFieldExists: boolean
): {
  status: TextCompareStatus;
  original: string;
  exported: string;
} {
  const original = normalizeText(originalValue);
  const exported = normalizeText(exportedValue);

  if (!exportedFieldExists) return { status: "missing", original, exported };
  if (original === exported) return { status: "exact", original, exported };
  if (exported.length < original.length && original.startsWith(exported)) {
    return { status: "truncated", original, exported };
  }
  return { status: "changed", original, exported };
}

function commonPrefixLength(left: string, right: string) {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

function preview(value: string, start = 0, length = 140) {
  return value
    .slice(start, start + length)
    .replace(/\n/g, " ↵ ")
    .replace(/\t/g, " ⇥ ");
}

export function compareCanvases(
  sourceCanvas: JsonObject,
  exportedCanvas: JsonObject
): AuditReport {
  const sourceEntries = metadataEntries(sourceCanvas)
    .filter(({ node }) => ["lorebook", "character", "story"].includes(
      stringField(node, "type")
    ));
  const exportedEntries = metadataEntries(exportedCanvas);

  const exportedByUid = new Map<string, MetadataEntry>();
  const exportedByIdentity = new Map<string, MetadataEntry[]>();
  exportedEntries.forEach((entry) => {
    const uid = stringField(entry.node, "nodeUid") || entry.key;
    exportedByUid.set(uid, entry);
    const identity = nodeIdentity(entry.node);
    const entries = exportedByIdentity.get(identity) ?? [];
    entries.push(entry);
    exportedByIdentity.set(identity, entries);
  });

  const usedExportedKeys = new Set<string>();
  const issues: AuditIssue[] = [];
  const summary: AuditSummary = {
    checked: 0,
    exact: 0,
    truncated: 0,
    missing: 0,
    changed: 0
  };

  function record(
    sourceNode: JsonObject,
    field: string,
    originalValue: unknown,
    exportedValue: unknown,
    exportedFieldExists: boolean
  ) {
    const result = compareText(
      originalValue,
      exportedValue,
      exportedFieldExists
    );
    summary.checked += 1;
    summary[result.status] += 1;
    if (result.status === "exact") return;

    const differenceAt = commonPrefixLength(result.original, result.exported);
    issues.push({
      status: result.status,
      type: stringField(sourceNode, "type"),
      title: stringField(sourceNode, "title") || "(제목 없음)",
      field,
      originalLength: result.original.length,
      exportedLength: result.exported.length,
      removedLength: Math.max(0, result.original.length - result.exported.length),
      differenceAt,
      removedPreview: result.status === "truncated"
        ? preview(result.original, result.exported.length)
        : "",
      sourcePreview: result.status === "changed"
        ? preview(result.original, differenceAt)
        : "",
      exportedPreview: result.status === "changed"
        ? preview(result.exported, differenceAt)
        : ""
    });
  }

  function findExportedNode(sourceEntry: MetadataEntry) {
    const sourceType = stringField(sourceEntry.node, "type");
    const uid = stringField(sourceEntry.node, "nodeUid") || sourceEntry.key;
    const uidMatch = exportedByUid.get(uid);
    if (uidMatch && stringField(uidMatch.node, "type") === sourceType) {
      usedExportedKeys.add(uidMatch.key);
      return uidMatch;
    }

    const candidates = exportedByIdentity.get(nodeIdentity(sourceEntry.node)) ?? [];
    const available = candidates.filter(
      (entry) => !usedExportedKeys.has(entry.key)
    );
    if (!available.length) return null;

    if (sourceType === "lorebook" && available.length > 1) {
      const sourceLoreKeys = new Set(
        objectArray(sourceEntry.node.entries).map(loreEntryIdentity)
      );
      available.sort((left, right) => {
        const score = (entry: MetadataEntry) => objectArray(entry.node.entries)
          .map(loreEntryIdentity)
          .filter((key) => sourceLoreKeys.has(key)).length;
        return score(right) - score(left);
      });
    }

    usedExportedKeys.add(available[0].key);
    return available[0];
  }

  sourceEntries.forEach((sourceEntry) => {
    const sourceNode = sourceEntry.node;
    const exportedEntry = findExportedNode(sourceEntry);
    if (!exportedEntry) {
      summary.checked += 1;
      summary.missing += 1;
      issues.push({
        status: "missing",
        type: stringField(sourceNode, "type"),
        title: stringField(sourceNode, "title") || "(제목 없음)",
        field: "node",
        originalLength: 0,
        exportedLength: 0,
        removedLength: 0,
        differenceAt: 0,
        removedPreview: "",
        sourcePreview: "",
        exportedPreview: ""
      });
      return;
    }

    const exportedNode = exportedEntry.node;
    const sourceType = stringField(sourceNode, "type");
    if (sourceType === "story") {
      ["coreContext", "text", "prologue", "prologueGuide"].forEach(field => {
        if (!Object.hasOwn(sourceNode, field)) return;
        record(sourceNode, field, sourceNode[field], exportedNode[field], Object.hasOwn(exportedNode, field));
      });
      return;
    }

    if (sourceType === "character") {
      ["coreContext", "text"].forEach((field) => {
        const original = normalizeText(sourceNode[field]);
        if (!original) return;
        record(
          sourceNode,
          field,
          sourceNode[field],
          exportedNode[field],
          Object.hasOwn(exportedNode, field)
        );
      });
      return;
    }

    const exportedLoreEntries = objectArray(exportedNode.entries);
    const exportedLoreByIdentity = new Map(
      exportedLoreEntries.map((entry) => [loreEntryIdentity(entry), entry])
    );

    objectArray(sourceNode.entries).forEach((sourceLoreEntry, index) => {
      const original = normalizeText(sourceLoreEntry.text);
      if (!original) return;
      const identity = loreEntryIdentity(sourceLoreEntry);
      const exportedLoreEntry = exportedLoreByIdentity.get(identity)
        ?? exportedLoreEntries[index];
      const field = `entries[${stringField(sourceLoreEntry, "key") || index + 1}].text`;
      record(
        sourceNode,
        field,
        sourceLoreEntry.text,
        exportedLoreEntry?.text,
        Boolean(exportedLoreEntry) && Object.hasOwn(exportedLoreEntry, "text")
      );
    });
  });

  const statusOrder: Record<AuditIssueStatus, number> = {
    truncated: 0,
    missing: 1,
    changed: 2
  };
  issues.sort((left, right) =>
    statusOrder[left.status] - statusOrder[right.status]
    || left.type.localeCompare(right.type, "ko")
    || left.title.localeCompare(right.title, "ko")
    || left.field.localeCompare(right.field, "ko")
  );

  return {
    createdAt: new Date().toISOString(),
    summary,
    issues
  };
}

export function formatAuditReport(report: AuditReport) {
  const { summary, issues } = report;
  const lines = [
    "알플레이 왕복 검증 완료",
    `검사 ${summary.checked}개 | 정상 ${summary.exact} | 잘림 ${summary.truncated} | 누락 ${summary.missing} | 변경 ${summary.changed}`
  ];

  if (!issues.length) {
    lines.push("", "✅ 잘림·누락·비정상 변경이 없습니다.");
    return lines.join("\n");
  }

  const labels: Record<AuditIssueStatus, string> = {
    truncated: "잘림",
    missing: "누락",
    changed: "변경"
  };
  issues.forEach((issue) => {
    lines.push(
      "",
      `[${labels[issue.status]}] ${issue.type} / ${issue.title} / ${issue.field}`
    );
    if (issue.field !== "node") {
      lines.push(
        `  길이: ${issue.originalLength} → ${issue.exportedLength}`
        + (issue.removedLength ? ` (-${issue.removedLength})` : "")
      );
    }
    if (issue.status === "truncated" && issue.removedPreview) {
      lines.push(`  잘린 시작: ${issue.removedPreview}`);
    }
    if (issue.status === "changed") {
      lines.push(`  최초 차이 위치: ${issue.differenceAt}`);
      lines.push(`  생성본: ${issue.sourcePreview}`);
      lines.push(`  재내보내기: ${issue.exportedPreview}`);
    }
  });
  return lines.join("\n");
}

export { normalizeText };
