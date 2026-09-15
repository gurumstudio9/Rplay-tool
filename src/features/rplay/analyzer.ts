import type { CanvasAuditReport, CanvasImageCharacterReport, CanvasImageNodeReport, CanvasStoryNodeReport, CanvasVariableReport, JsonObject } from "./model";

export function analyzeCanvasJson(filename: string, data: JsonObject, imagesData?: JsonObject): CanvasAuditReport {
  const nodes = Array.isArray(data.nodes) ? (data.nodes as JsonObject[]) : [];
  const connections = Array.isArray(data.connections) ? (data.connections as JsonObject[]) : [];
  const metadataSet = (data.metadataSet && typeof data.metadataSet === "object")
    ? (data.metadataSet as Record<string, JsonObject>)
    : {};

  const nodeByUid = new Map<string, JsonObject>();
  nodes.forEach(n => {
    if (typeof n.uid === "string") {
      nodeByUid.set(n.uid, n);
    }
  });

  function getMeta(uid: string): JsonObject {
    return metadataSet[uid] ?? {};
  }

  function getNodeLabel(uid: string): string {
    const n = nodeByUid.get(uid);
    const meta = getMeta(uid);
    const ntype = (typeof n?.type === "string") ? n.type : "unknown";
    const name = String(meta.title || meta.name || n?.name || meta.variableName || n?.hash || uid);
    return `[${ntype}] ${name}`;
  }

  // 1. Node types breakdown
  const nodeTypes: Record<string, number> = {};
  nodes.forEach(n => {
    const t = typeof n.type === "string" ? n.type : "unknown";
    nodeTypes[t] = (nodeTypes[t] || 0) + 1;
  });

  // 2. Story nodes & transitions
  const storyNodesReport: CanvasStoryNodeReport[] = [];
  nodes.filter(n => n.type === "story").forEach(sn => {
    const uid = String(sn.uid);
    const meta = getMeta(uid);
    const title = String(meta.title || sn.name || sn.hash || uid);
    const isStarter = meta.isStart === true;

    const inConns = connections.filter(c => c.targetNodeId === uid);
    const outConns = connections.filter(c => c.sourceNodeId === uid);

    const inbound: CanvasStoryNodeReport["inbound"] = [];
    inConns.forEach(ic => {
      const srcUid = String(ic.sourceNodeId);
      const srcNode = nodeByUid.get(srcUid);
      const srcMeta = getMeta(srcUid);
      const srcType = srcNode?.type;
      const port = typeof ic.targetInputPortName === "string" ? ic.targetInputPortName : undefined;

      if (srcType === "trigger") {
        const cb = Array.isArray(srcMeta.conditionBlocks) ? srcMeta.conditionBlocks : [];
        const condStr = cb.map(b => `${b.variableName} == ${b.numberValue ?? b.stringValue ?? b.booleanValue}`).join(", ");
        // Where did this trigger come from?
        const trigIn = connections.filter(c => c.targetNodeId === srcUid);
        const fromStory = trigIn
          .map(c => String(c.sourceNodeId))
          .filter(id => nodeByUid.get(id)?.type === "story")
          .map(id => getNodeLabel(id));

        inbound.push({
          from: fromStory.length > 0 ? fromStory.join(" ") : getNodeLabel(srcUid),
          condition: condStr || undefined,
          port
        });
      } else {
        inbound.push({
          from: getNodeLabel(srcUid),
          port
        });
      }
    });

    const outbound: CanvasStoryNodeReport["outbound"] = [];
    outConns.forEach(oc => {
      const tgtUid = String(oc.targetNodeId);
      const tgtNode = nodeByUid.get(tgtUid);
      const tgtMeta = getMeta(tgtUid);
      const tgtType = tgtNode?.type;
      const port = typeof oc.sourceOutputPortName === "string" ? oc.sourceOutputPortName : undefined;

      if (tgtType === "trigger") {
        const cb = Array.isArray(tgtMeta.conditionBlocks) ? tgtMeta.conditionBlocks : [];
        const condStr = cb.map(b => `${b.variableName} == ${b.numberValue ?? b.stringValue ?? b.booleanValue}`).join(", ");
        const trigOut = connections.filter(c => c.sourceNodeId === tgtUid);
        const toStory = trigOut
          .map(c => String(c.targetNodeId))
          .filter(id => nodeByUid.get(id)?.type === "story")
          .map(id => getNodeLabel(id));

        outbound.push({
          to: toStory.length > 0 ? toStory.join(" ") : getNodeLabel(tgtUid),
          condition: condStr || undefined,
          port
        });
      } else {
        outbound.push({
          to: getNodeLabel(tgtUid),
          port
        });
      }
    });

    storyNodesReport.push({
      uid,
      title,
      isStarter,
      inbound,
      outbound
    });
  });

  // 3. Variables
  const variablesReport: CanvasVariableReport[] = [];
  const triggerNodes = nodes.filter(n => n.type === "trigger");

  nodes.filter(n => n.type === "variable").forEach(vn => {
    const uid = String(vn.uid);
    const meta = getMeta(uid);
    const vname = String(meta.variableName || vn.name || "");
    const vtype = String(meta.variableType || "string");
    const initValue = meta.initValue;
    const title = String(meta.title || "");

    const outConns = connections.filter(c => c.sourceNodeId === uid);
    const connectedRules: string[] = [];
    outConns.forEach(c => {
      const tgtUid = String(c.targetNodeId);
      const tgtNode = nodeByUid.get(tgtUid);
      const tgtMeta = getMeta(tgtUid);
      if (tgtNode?.type === "updateRule") {
        connectedRules.push(String(tgtMeta.title || tgtNode.name || tgtUid));
      }
    });

    let triggerUsageCount = 0;
    triggerNodes.forEach(tn => {
      const tmeta = getMeta(String(tn.uid));
      const cb = Array.isArray(tmeta.conditionBlocks) ? tmeta.conditionBlocks : [];
      if (cb.some(b => b.variableName === vname || b.variableNodeUid === uid)) {
        triggerUsageCount++;
      }
    });

    variablesReport.push({
      name: vname,
      title,
      type: vtype,
      initValue,
      connectedRules,
      triggerUsageCount
    });
  });

  // 4. Hubs
  const hubsReport: CanvasAuditReport["hubs"] = [];
  nodes.filter(n => n.type === "hub").forEach(hn => {
    const uid = String(hn.uid);
    const meta = getMeta(uid);
    const name = String(meta.name || hn.name || "hub-node");
    const inConns = connections.filter(c => c.targetNodeId === uid);
    const outConns = connections.filter(c => c.sourceNodeId === uid);
    hubsReport.push({
      name,
      inboundCount: inConns.length,
      outboundCount: outConns.length
    });
  });

  // 5. Lorebooks
  const lorebookNodes = nodes.filter(n => n.type === "lorebook");
  const connectedLorebookCount = lorebookNodes.filter(lbn => {
    const uid = String(lbn.uid);
    return connections.some(c => c.targetNodeId === uid || c.sourceNodeId === uid);
  }).length;

  // 6. Orphans
  const connectedUids = new Set<string>();
  connections.forEach(c => {
    if (typeof c.sourceNodeId === "string") connectedUids.add(c.sourceNodeId);
    if (typeof c.targetNodeId === "string") connectedUids.add(c.targetNodeId);
  });

  const orphanNodes = nodes
    .filter(n => typeof n.uid === "string" && !connectedUids.has(n.uid))
    .map(n => ({
      uid: String(n.uid),
      type: String(n.type || "unknown"),
      label: getNodeLabel(String(n.uid))
    }));

  // 7. Image nodes
  const imageNodesReport: CanvasImageNodeReport[] = [];
  nodes.filter(n => n.type === "image").forEach(imgNode => {
    const uid = String(imgNode.uid);
    const meta = getMeta(uid);
    const title = String(meta.title || imgNode.name || uid);
    const isProfile = Boolean(meta.isProfile);
    const images = Array.isArray(meta.images) ? (meta.images as JsonObject[]) : [];
    const tagSet = new Set<string>();
    images.forEach(img => {
      if (Array.isArray(img.tags)) {
        (img.tags as string[]).forEach(t => { if (typeof t === "string") tagSet.add(t); });
      }
    });
    imageNodesReport.push({
      uid,
      title,
      isProfile,
      imageCount: images.length,
      tags: [...tagSet]
    });
  });

  // 8. Image character comparison (images.json 제공 시)
  const imageCharactersReport: CanvasImageCharacterReport[] = [];
  const unmatchedImageNodes: CanvasImageNodeReport[] = [];
  if (imagesData) {
    const imagesCharacters = Array.isArray(imagesData.characters)
      ? (imagesData.characters as JsonObject[]).map((character) => ({
        id: String(character.id || ""),
        name: String(character.name || character.id || ""),
        aliases: Array.isArray(character.aliases)
          ? character.aliases.map((alias) => String(alias))
          : []
      })).filter((character) => character.id)
      : [];
    const imagesCounts = (imagesData.counts && typeof imagesData.counts === "object")
      ? (imagesData.counts as Record<string, Record<string, number>>)
      : {};
    const registeredTags = Array.isArray(imagesData.tags)
      ? (imagesData.tags as JsonObject[])
        .map((tag) => ({
          id: String(tag.id || ""),
          label: String(tag.label || tag.id || "")
        }))
        .filter((tag) => tag.id)
      : [];
    const characterByName = new Map<string, string>();
    const normalizedName = (value: unknown) => String(value || "")
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("ko-KR");

    imagesCharacters.forEach((character) => {
      [character.id, character.name, ...character.aliases].forEach((name) => {
        const key = normalizedName(name);
        if (key && !characterByName.has(key)) characterByName.set(key, character.id);
      });
    });

    const imageNodesByCharacter = new Map<string, CanvasImageNodeReport[]>();
    imageNodesReport.forEach((imageNode) => {
      const ownerUids = connections
        .filter((connection) =>
          connection.sourceNodeId === imageNode.uid || connection.targetNodeId === imageNode.uid
        )
        .map((connection) => String(
          connection.sourceNodeId === imageNode.uid
            ? connection.targetNodeId
            : connection.sourceNodeId
        ))
        .filter((uid) => nodeByUid.get(uid)?.type === "character");
      const characterId = ownerUids
        .map((uid) => getMeta(uid))
        .map((metadata) => [metadata.name, metadata.title])
        .flat()
        .map(normalizedName)
        .map((name) => characterByName.get(name))
        .find((id): id is string => Boolean(id));

      if (!characterId) {
        unmatchedImageNodes.push(imageNode);
        return;
      }
      const nodesForCharacter = imageNodesByCharacter.get(characterId) ?? [];
      nodesForCharacter.push(imageNode);
      imageNodesByCharacter.set(characterId, nodesForCharacter);
    });

    imagesCharacters.forEach(character => {
      const matchingNodes = imageNodesByCharacter.get(character.id) ?? [];

      const canvasTags = new Set<string>();
      let totalImages = 0;
      matchingNodes.forEach(n => {
        n.tags.forEach(t => canvasTags.add(t));
        totalImages += n.imageCount;
      });

      const charCounts = imagesCounts[character.id] ?? {};
      const sourceTags = registeredTags.filter(
        (tag) => Number(charCounts[tag.id] ?? 0) > 0
      );
      const sourceByCanvasValue = new Map<string, typeof sourceTags[number]>();
      sourceTags.forEach((tag) => {
        sourceByCanvasValue.set(tag.id, tag);
        sourceByCanvasValue.set(tag.label, tag);
      });
      const matchedSourceIds = new Set<string>();
      const canvasOnly: string[] = [];
      canvasTags.forEach((canvasTag) => {
        const sourceTag = sourceByCanvasValue.get(canvasTag);
        if (sourceTag) matchedSourceIds.add(sourceTag.id);
        else canvasOnly.push(canvasTag);
      });
      const both = sourceTags
        .filter((tag) => matchedSourceIds.has(tag.id))
        .map((tag) => tag.label);
      const imageOnly = sourceTags
        .filter((tag) => !matchedSourceIds.has(tag.id))
        .map((tag) => tag.label);

      imageCharactersReport.push({
        characterId: character.id,
        characterName: character.name,
        nodeTitle: matchingNodes.map(n => n.title).join(", "),
        totalImages,
        both,
        imageOnly,
        canvasOnly
      });
    });
  }

  return {
    filename,
    totalNodes: nodes.length,
    totalConnections: connections.length,
    nodeTypes,
    storyNodes: storyNodesReport,
    variables: variablesReport,
    hubs: hubsReport,
    lorebookCount: lorebookNodes.length,
    connectedLorebookCount,
    orphanNodes,
    imageNodes: imageNodesReport,
    imageCharacters: imageCharactersReport,
    unmatchedImageNodes
  };
}
