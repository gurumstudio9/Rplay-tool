const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { dataDir, configDir } = require("./shared/dataPaths.cjs");
const { handleDataDirectoryApi } = require("./shared/dataDirectorySettings.cjs");
const { URL } = require("url");
const { TextDecoder } = require("util");
const { loadVersionedManager, saveVersionedManager } = require("./shared/versionedManager.js");

const root = __dirname;
const reactRoot = path.resolve(root, "dist");
const worksFile = path.join(dataDir, "works.json");
const port = Number(process.env.PORT || 4174);

const fallbackWorks = [{ id: "default", name: "기본" }];
const storageFileNames = new Map([
  ["rplay-hubs-v1", "hubs.json"],
  ["character-prompt-manager-v1", "prompts.json"],
  ["character-rplay-variables-v1", "variables.json"]
]);
const emptyWorkData = new Map([
  ["rplay-hubs-v1", { version: 1, hubs: [] }],
  ["character-manager-roster-v1", []],
  ["character-prompt-manager-v1", { versions: [], activeVersionId: "" }],
  ["character-lorebook-manager-v1", { entries: [] }],
  ["character-rplay-variables-v1", { variables: [] }]
]);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeId(value) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "default";
}

const maxWorkNameLength = 120;
const windowsReservedNames = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`)
]);

function validateWorkName(name, id) {
  if (!name) return "work name required";
  if ([...name].length > maxWorkNameLength) {
    return `work name must be ${maxWorkNameLength} characters or fewer`;
  }
  if (id === "default") return "work name cannot produce the default id";
  if (id.length > maxWorkNameLength) {
    return `work id must be ${maxWorkNameLength} characters or fewer`;
  }
  if (windowsReservedNames.has(id)) return "work name is not available";
  return null;
}

function isSafeEntryId(value) {
  return /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u.test(String(value || "").trim());
}

function normalizeLoreFileName(value, fallbackId = "entry") {
  let fileName = String(value || `${fallbackId}.json`).trim();
  fileName = fileName.toLowerCase().endsWith(".json")
    ? `${fileName.slice(0, -5)}.json`
    : `${fileName}.json`;
  const baseName = fileName.slice(0, -5);
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
  if (
    !baseName ||
    fileName.length > 240 ||
    fileName !== path.basename(fileName) ||
    fileName.includes("..") ||
    /[<>:"/\\|?*\x00-\x1f]/.test(fileName) ||
    /[. ]$/.test(baseName) ||
    reserved.test(baseName)
  ) return null;
  return fileName;
}

function storagePath(key) {
  const parts = String(key || "").split("::");
  const baseKey = parts[0];
  const rawWorkId = parts[1] || "default";
  const rawPlatformId = parts[2] || "알플레이";
  if (rawPlatformId !== "알플레이" || !new Set(["character-manager-roster-v1", "character-prompt-manager-v1", "character-lorebook-manager-v1", "character-rplay-variables-v1", "rplay-manager-v1", "rplay-hubs-v1"]).has(baseKey)) return null;
  if (!baseKey) return null;
  const workId = safeId(rawWorkId);
  const platformId = safeId(rawPlatformId);
  if (baseKey === "character-lorebook-manager-v1") {
    return path.join(dataDir, "works", workId, platformId, "lorebook");
  }
  if (baseKey === "character-manager-roster-v1") {
    return path.join(dataDir, "works", workId, platformId, "characters");
  }
  const fileName = storageFileNames.get(baseKey) || `${safeId(baseKey)}.json`;
  return path.join(dataDir, "works", workId, platformId, fileName);
}

function workDir(workId, platformId = "알플레이") {
  return path.join(dataDir, "works", safeId(workId), safeId(platformId));
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readText(file));
  } catch {
    return fallback;
  }
}


function readText(file) {
  const buffer = fs.readFileSync(file);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("euc-kr", { fatal: true }).decode(buffer);
  }
}

function parseLegacyUpdateRules(value) {
  const text = String(value || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");
  const starts = [];
  lines.forEach((line, index) => {
    if (!/^###\s+\S/.test(line)) return;
    const nextContent = lines.slice(index + 1).find((candidate) => candidate.trim());
    if (nextContent && /^#{1,2}\s+\S/.test(nextContent)) starts.push(index);
  });
  if (!starts.length) {
    return [{ id: "update-rule-1", type: "updateRule", title: "업데이트 규칙", text, variables: [] }];
  }
  return starts.map((start, index) => ({
    id: `update-rule-${index + 1}`,
    type: "updateRule",
    title: lines[start].replace(/^###\s+/, "").trim(),
    text: lines.slice(start + 1, starts[index + 1] ?? lines.length).join("\n").trim(),
    variables: []
  }));
}

function parseUpdateRuleDocument(value, fallbackTitle) {
  const content = String(value || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = content.split("\n");
  let bodyStart = 0;
  let variables = [];
  if (lines[0]?.trim() === "---") {
    const frontmatterEnd = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (frontmatterEnd > 0) {
      const frontmatter = lines.slice(1, frontmatterEnd);
      const variablesIndex = frontmatter.findIndex((line) => /^variables\s*:/.test(line.trim()));
      if (variablesIndex >= 0 && !/^variables\s*:\s*\[\s*\]\s*$/.test(frontmatter[variablesIndex].trim())) {
        for (let index = variablesIndex + 1; index < frontmatter.length; index += 1) {
          const match = frontmatter[index].match(/^\s*-\s*(.+?)\s*$/);
          if (!match) break;
          let variableName = match[1];
          if (variableName.startsWith('"')) {
            try { variableName = JSON.parse(variableName); } catch (e) {}
          }
          variableName = String(variableName).trim();
          if (variableName) variables.push(variableName);
        }
      }
      bodyStart = frontmatterEnd + 1;
    }
  }
  while (bodyStart < lines.length && !lines[bodyStart].trim()) bodyStart += 1;
  const heading = lines[bodyStart]?.match(/^###\s+(.+)$/);
  return {
    title: heading?.[1]?.trim() || fallbackTitle,
    text: lines.slice(bodyStart + (heading ? 1 : 0)).join("\n").trim(),
    variables: [...new Set(variables)]
  };
}

function formatUpdateRuleDocument(title, text, variables) {
  const uniqueVariables = [...new Set(
    (Array.isArray(variables) ? variables : [])
      .map((variable) => String(variable || "").trim())
      .filter(Boolean)
  )];
  const frontmatter = uniqueVariables.length
    ? ["---", "variables:", ...uniqueVariables.map((variable) => `  - ${JSON.stringify(variable)}`), "---"]
    : ["---", "variables: []", "---"];
  return `${frontmatter.join("\n")}\n\n### ${title}\n${text}\n`;
}

function updateRuleFileName(title, index, usedNames) {
  let stem = String(title || `규칙 ${index + 1}`)
    .normalize("NFC")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 180);
  if (!stem || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) {
    stem = `규칙 ${index + 1}`;
  }
  let fileName = `${stem}.md`;
  let suffix = 2;
  while (usedNames.has(fileName.toLocaleLowerCase("ko-KR"))) {
    fileName = `${stem} (${suffix++}).md`;
  }
  usedNames.add(fileName.toLocaleLowerCase("ko-KR"));
  return fileName;
}

function readUpdateRuleFiles(ruleDir, legacyFile = "") {
  if (fs.existsSync(ruleDir)) {
    const files = fs.readdirSync(ruleDir)
      .filter((fileName) => fileName.toLowerCase().endsWith(".md"))
      .sort((left, right) => left.localeCompare(right, "ko"));
    if (files.length) {
      return files.map((fileName, index) => {
        const document = parseUpdateRuleDocument(
          readText(path.join(ruleDir, fileName)),
          path.basename(fileName, ".md")
        );
        return {
          id: `update-rule-file-${index + 1}`,
          type: "updateRule",
          fileName,
          ...document
        };
      });
    }
  }
  return legacyFile && fs.existsSync(legacyFile)
    ? parseLegacyUpdateRules(readText(legacyFile))
    : [];
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const loreBodyStorage = "sidecar-md-v1";

function loreBodyFileName(jsonFileName) {
  return `${String(jsonFileName || "entry.json").replace(/\.json$/i, "")}.md`;
}

function normalizeLoreBody(value) {
  return String(value || "").replace(/\r\n?/g, "\n").replace(/\n+$/g, "");
}

function writeLoreBody(file, value) {
  ensureDir(path.dirname(file));
  const body = normalizeLoreBody(value);
  fs.writeFileSync(file, body ? `${body}\n` : "", "utf8");
}

function loreBodyRevision(value) {
  return crypto.createHash("sha256").update(normalizeLoreBody(value), "utf8").digest("hex");
}

function loreMarkdownFiles(lbDir) {
  if (!fs.existsSync(lbDir)) return new Map();
  return new Map(fs.readdirSync(lbDir)
    .filter((fileName) => /\.md$/i.test(fileName))
    .map((fileName) => [fileName.toLocaleLowerCase(), fileName]));
}

function loreSettingsPath(lbDir) {
  return path.join(path.dirname(lbDir), "lorebook-settings.json");
}

function loreTypePriorities(lbDir) {
  return readJson(loreSettingsPath(lbDir), {})?.typePriorities || {};
}

function validLoreTypePriorities(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.entries(value).every(([key, priority]) => key.trim() && key === key.trim()
      && key.length <= 80 && Number.isSafeInteger(priority) && priority >= 0);
}

function loreCollectionSnapshot(lbDir) {
  const hash = crypto.createHash("sha256");
  hash.update("lorebook-collection-v1\0", "utf8");
  const files = fs.existsSync(lbDir)
    ? fs.readdirSync(lbDir)
      .filter((fileName) => /\.(?:json|md)$/i.test(fileName))
      .sort((a, b) => a.localeCompare(b, "ko"))
    : [];
  const jsonFiles = files.filter((fileName) => /\.json$/i.test(fileName));
  const invalidJsonFiles = [];
  const settingsFile = loreSettingsPath(lbDir);
  if (fs.existsSync(settingsFile)) {
    hash.update("lorebook-settings.json\0", "utf8");
    try {
      const raw = fs.readFileSync(settingsFile);
      hash.update(raw);
      if (!validLoreTypePriorities(JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, "")).typePriorities)) {
        invalidJsonFiles.push("../lorebook-settings.json");
      }
    } catch { invalidJsonFiles.push("../lorebook-settings.json"); hash.update("!unreadable"); }
  }

  files.forEach((fileName) => {
    const filePath = path.join(lbDir, fileName);
    hash.update(fileName.normalize("NFC"), "utf8");
    hash.update("\0", "utf8");
    try {
      hash.update(fs.readFileSync(filePath));
      if (/\.json$/i.test(fileName)) {
        const metadata = JSON.parse(readText(filePath));
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
          invalidJsonFiles.push(fileName);
        }
      }
    } catch {
      hash.update("!unreadable", "utf8");
      if (/\.json$/i.test(fileName)) invalidJsonFiles.push(fileName);
    }
    hash.update("\0", "utf8");
  });

  return {
    collectionRevision: `sha256:${hash.digest("hex")}`,
    jsonFiles,
    invalidJsonFiles
  };
}

function readLoreRecord(lbDir, fileName, markdownFiles = loreMarkdownFiles(lbDir)) {
  const metadata = readJson(path.join(lbDir, fileName), null);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;

  const bodyFileName = loreBodyFileName(fileName);
  const actualBodyFileName = markdownFiles.get(bodyFileName.toLocaleLowerCase()) || "";
  const paired = metadata.bodyStorage === loreBodyStorage;
  const declaredBodyFile = String(metadata.bodyFile || "").trim();
  const bodyFileMatches = !declaredBodyFile
    || declaredBodyFile.toLocaleLowerCase() === bodyFileName.toLocaleLowerCase();
  const legacyBody = normalizeLoreBody(metadata.body);
  let body = legacyBody;
  let bodySource = "legacy-json";
  let bodyStatus = actualBodyFileName ? "unlinked-md" : "legacy";
  let bodyModifiedAt = "";

  if (paired) {
    if (!bodyFileMatches) {
      bodySource = legacyBody ? "legacy-json-fallback" : "missing";
      bodyStatus = "invalid-body-file";
    } else if (!actualBodyFileName) {
      bodySource = legacyBody ? "legacy-json-fallback" : "missing";
      bodyStatus = "missing-md";
    } else {
      const bodyPath = path.join(lbDir, actualBodyFileName);
      try {
        body = normalizeLoreBody(readText(bodyPath));
        bodySource = "markdown";
        bodyStatus = "ok";
        bodyModifiedAt = fs.statSync(bodyPath).mtime.toISOString();
      } catch {
        body = legacyBody;
        bodySource = legacyBody ? "legacy-json-fallback" : "missing";
        bodyStatus = "unreadable-md";
      }
    }
  }

  return {
    fileName,
    metadata,
    paired,
    bodyFileName,
    actualBodyFileName,
    entry: {
      ...metadata,
      body,
      bodyStorage: paired ? loreBodyStorage : "legacy-json",
      bodyFileName,
      sourceBodyFileName: actualBodyFileName || bodyFileName,
      bodySource,
      bodyStatus,
      bodyRevision: loreBodyRevision(body),
      bodyModifiedAt
    }
  };
}

function loreMetadata(entry, fileName, paired) {
  const metadata = { ...entry };
  [
    "fileName", "sourceFileName", "bodyFileName", "sourceBodyFileName", "bodySource",
    "bodyStatus", "bodyRevision", "bodyModifiedAt", "migrateBodyToMarkdown", "repairMissingBody", "_typePriority"
  ].forEach((field) => delete metadata[field]);
  if (paired) {
    delete metadata.body;
    metadata.bodyStorage = loreBodyStorage;
    metadata.bodyFile = loreBodyFileName(fileName);
  } else {
    metadata.body = normalizeLoreBody(entry.body);
    delete metadata.bodyStorage;
    delete metadata.bodyFile;
  }
  return metadata;
}

function writeCaseAwareFile(directory, sourceFileName, targetFileName, index, writeTarget) {
  const caseOnlyRename = sourceFileName
    && sourceFileName !== targetFileName
    && sourceFileName.toLocaleLowerCase() === targetFileName.toLocaleLowerCase();
  if (!caseOnlyRename) {
    writeTarget(path.join(directory, targetFileName));
    return;
  }

  const sourcePath = path.join(directory, sourceFileName);
  if (!fs.existsSync(sourcePath)) {
    writeTarget(path.join(directory, targetFileName));
    return;
  }
  const tempPath = path.join(directory, `.__case-rename-${Date.now()}-${index}.tmp`);
  fs.renameSync(sourcePath, tempPath);
  try {
    writeTarget(path.join(directory, targetFileName));
    fs.unlinkSync(tempPath);
  } catch (error) {
    if (fs.existsSync(tempPath) && !fs.existsSync(sourcePath)) fs.renameSync(tempPath, sourcePath);
    throw error;
  }
}

function clone(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function sameJsonValue(a, b) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function isLoreEntryContentChanged(newEntry, oldEntry) {
  if (!oldEntry) return true;
  return (
    newEntry.id !== oldEntry.id ||
    newEntry.title !== oldEntry.title ||
    newEntry.body !== oldEntry.body ||
    newEntry.type !== oldEntry.type ||
    newEntry.priority !== oldEntry.priority ||
    !sameJsonValue(newEntry.triggers, oldEntry.triggers)
  );
}

function ensureWorkFiles(workId, platformId = "알플레이") {
  const dir = workDir(workId, platformId);
  ensureDir(dir);
  ensureDir(path.join(dir, "characters"));
  ensureDir(path.join(dir, "lorebook"));
  for (const [baseKey, fileName] of storageFileNames) {
    if (baseKey === "character-lorebook-manager-v1") {
      continue;
    }
    const file = path.join(dir, fileName);
    if (!fs.existsSync(file)) writeJson(file, clone(emptyWorkData.get(baseKey)));
  }
}

function ensureWorksFiles(works) {
  works.forEach((work) => {
    const workId = safeId(work.id || work.name);
    const platforms = readWorkPlatforms(workId);
    platforms.forEach((platformId) => ensureWorkFiles(workId, platformId));
  });
}

function workNameFromId(id) {
  return String(id || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part === "c급" ? "C급" : part)
    .join(" ");
}

function readWorkPlatforms(workId) {
  const workRoot = path.join(dataDir, "works", safeId(workId));
  if (!fs.existsSync(workRoot)) return ["젠잇"];
  const reservedFolders = new Set([
    "assets",
    "workers",
    "characters",
    "lorebook",
    "look",
    "prompts",
    "intros",
    "이미지프롬프트",
    "이미지태그",
    "이미지",
    "images"
  ]);
  const dirs = fs.readdirSync(workRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !reservedFolders.has(entry.name.toLowerCase()))
    .map((entry) => entry.name)
    .filter(Boolean);
  return dirs.length ? dirs : ["젠잇"];
}

function readWorkDirectories() {
  const worksRoot = path.join(dataDir, "works");
  if (!fs.existsSync(worksRoot)) return [];
  return fs.readdirSync(worksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => safeId(entry.name))
    .filter((id) => id !== "default")
    .filter(Boolean);
}

function readWorks() {
  ensureDir(dataDir);
  const saved = readJson(worksFile, []);
  const savedWorks = Array.isArray(saved) ? saved : [];
  const savedById = new Map(savedWorks.map((work) => [safeId(work.id || work.name), work]));
  const folderWorks = readWorkDirectories().map((id) => {
    const savedWork = savedById.get(id);
    return {
      id,
      name: String(savedWork?.name || workNameFromId(id) || id).trim(),
      platforms: readWorkPlatforms(id)
    };
  });
  const merged = [...folderWorks, ...savedWorks];
  const seen = new Set();
  const works = merged
    .map((work) => ({
      id: safeId(work.id || work.name),
      name: String(work.name || work.id || "기본").trim(),
      platforms: readWorkPlatforms(safeId(work.id || work.name))
    }))
    .filter((work) => {
      if (seen.has(work.id)) return false;
      seen.add(work.id);
      return true;
    });
  const result = works.length ? works : fallbackWorks;
  return result;
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteLength = 0;
    request.on("data", (chunk) => {
      chunks.push(chunk);
      byteLength += chunk.length;
      if (byteLength > 10 * 1024 * 1024) {
        reject(new Error("request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        const bodyStr = fullBuffer.toString("utf8");
        const body = bodyStr ? JSON.parse(bodyStr) : {};
        const platform = body.platformId || body.platform || String(body.workId || "").split("::")[1];
        if (platform && platform !== "알플레이") throw new Error("알플레이 데이터만 사용할 수 있습니다.");
        resolve(body);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function loadPrompts(filePath) {
  const value = loadVersionedManager(filePath, "prompts", ["additionalPrompt", "starterPrompt", "starterMessage"], ["mainPrompt", "worldStory"]);
  value.versions = (Array.isArray(value.versions) ? value.versions : []).map(version => {
    const backgroundFile = path.join(path.dirname(filePath), "prompts", safeId(version.id), "worldStory.md");
    return { ...version, worldStory: fs.existsSync(backgroundFile) ? readText(backgroundFile)
      : typeof version.worldStory === "string" ? version.worldStory : value.worldStory };
  });
  return value;
}

function savePrompts(filePath, value) {
  saveVersionedManager(filePath, value, "prompts", ["additionalPrompt", "starterPrompt", "starterMessage", "worldStory"], ["mainPrompt", "worldStory"]);
}

function loadRplayManager(filePath) {
  return loadVersionedManager(filePath, "rplay", ["mainPrompt", "updateRules", "variables"]);
}

function saveRplayManager(filePath, value) {
  saveVersionedManager(filePath, value, "rplay", ["mainPrompt", "updateRules", "variables"]);
}


function findAssetDir(rawWorkId) {
  if (!rawWorkId) return null;
  const parts = String(rawWorkId).split("::");
  const workId = safeId(parts[0]);
  const platformId = parts[1] ? safeId(parts[1]) : "알플레이";

  const platformAssetDir = path.join(dataDir, "works", workId, platformId, "assets");
  if (fs.existsSync(platformAssetDir)) return platformAssetDir;

  const workAssetDir = path.join(dataDir, "works", workId, "assets");
  if (fs.existsSync(workAssetDir)) return workAssetDir;

  return platformAssetDir;
}


async function handleApi(request, response, url) {
  const requestedWork = url.searchParams.get("workId") || "";
  const requestedPlatform = url.searchParams.get("platformId") || requestedWork.split("::")[1];
  if (requestedPlatform && requestedPlatform !== "알플레이") {
    sendJson(response, 400, { error: "알플레이 데이터만 사용할 수 있습니다." });
    return true;
  }
  if (await handleDataDirectoryApi(request, response, url)) return true;
  if (url.pathname === "/api/health" || url.pathname === "/api/launcher/stop") {
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress)) {
      sendJson(response, 403, { error: "Local requests only" });
      return true;
    }
    const token = process.env.CHARACTER_MANAGER_LAUNCH_TOKEN;
    if (url.pathname === "/api/health" && request.method === "GET") {
      sendJson(response, 200, {
        service: "rplay-canvas-manager", codeDir: root, dataDir, pid: process.pid,
        launcherId: token ? crypto.createHash("sha256").update(token).digest("hex") : null
      });
    } else if (url.pathname === "/api/launcher/stop" && request.method === "POST") {
      const supplied = request.headers["x-manager-token"];
      if (!token || typeof supplied !== "string" || Buffer.byteLength(supplied) !== Buffer.byteLength(token)
        || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) {
        sendJson(response, 403, { error: "Invalid launcher token" });
      } else {
        sendJson(response, 200, { stopping: true });
        setImmediate(() => server.close(() => process.exit(0)));
      }
    } else sendJson(response, 405, { error: "Method not allowed" });
    return true;
  }
  if (url.pathname === "/api/export/work-markdown" && request.method === "GET") {
    const workId = url.searchParams.get("workId") || "";
    const platformId = url.searchParams.get("platformId") || "";
    if (!workId || !platformId || safeId(workId) !== workId || safeId(platformId) !== platformId) {
      sendJson(response, 400, { error: "작품과 플랫폼을 선택해 주세요." });
      return true;
    }
    if (!fs.existsSync(workDir(workId, platformId))) {
      sendJson(response, 404, { error: "선택한 작품·플랫폼 폴더가 없습니다." });
      return true;
    }
    const { execFile } = require("child_process");
    await new Promise((resolve) => {
      execFile(process.env.PYTHON_EXECUTABLE || "python", [
        path.join(root, "assemble_work.py"), workId,
        "--platform", platformId, "--data-dir", dataDir, "--stdout"
      ], { encoding: "utf8", windowsHide: true, timeout: 60000, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          sendJson(response, 500, {
            error: error.code === "ENOENT"
              ? "Python 실행 파일을 찾지 못했습니다. Python 설치 또는 PYTHON_EXECUTABLE 설정을 확인해 주세요."
              : stderr.trim() || "작품 MD 조립에 실패했습니다."
          });
        } else {
          const filename = `${workId}_${platformId}_전체.md`;
          response.writeHead(200, {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="work.md"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            "Cache-Control": "no-store"
          });
          response.end(stdout);
        }
        resolve();
      });
    });
    return true;
  }
  // 알플레이 업데이트 규칙 API (prompts/updateRules/<규칙 제목>.md)
  if (url.pathname === "/api/update-rules" && request.method === "GET") {
    let workId = url.searchParams.get("workId") || "default";
    try { workId = decodeURIComponent(workId); } catch (e) {}
    const parts = String(workId).split("::");
    const cleanWorkId = safeId(parts[0]);
    const platformId = parts[1] ? safeId(parts[1]) : "알플레이";
    const promptsDir = path.join(dataDir, "works", cleanWorkId, platformId, "prompts");
    const rules = readUpdateRuleFiles(
      path.join(promptsDir, "updateRules"),
      path.join(promptsDir, "updateRules.md")
    );
    sendJson(response, 200, { success: true, rules });
    return true;
  }

  if (url.pathname === "/api/update-rules" && request.method === "PUT") {
    try {
      const body = await readBody(request);
      let { workId = "default", rules = [] } = body;
      try { workId = decodeURIComponent(workId); } catch (e) {}
      const parts = String(workId).split("::");
      const cleanWorkId = safeId(parts[0]);
      const platformId = parts[1] ? safeId(parts[1]) : "알플레이";
      const promptsDir = path.join(dataDir, "works", cleanWorkId, platformId, "prompts");
      const ruleDir = path.join(promptsDir, "updateRules");
      ensureDir(ruleDir);
      rules = Array.isArray(rules) ? rules : [];
      const usedNames = new Set();
      const savedRules = rules.map((rule, index) => {
        const title = String(rule?.title || `규칙 ${index + 1}`).trim() || `규칙 ${index + 1}`;
        const text = String(rule?.text || "").replace(/\r\n?/g, "\n").trim();
        const variables = [...new Set(
          (Array.isArray(rule?.variables) ? rule.variables : [])
            .map((variable) => String(variable || "").trim())
            .filter(Boolean)
        )];
        const fileName = updateRuleFileName(title, index, usedNames);
        fs.writeFileSync(
          path.join(ruleDir, fileName),
          formatUpdateRuleDocument(title, text, variables),
          "utf8"
        );
        return { id: String(rule?.id || `update-rule-${index + 1}`), type: "updateRule", fileName, title, text, variables };
      });
      const activeNames = new Set(savedRules.map((rule) => rule.fileName.toLocaleLowerCase("ko-KR")));
      fs.readdirSync(ruleDir)
        .filter((fileName) => fileName.toLowerCase().endsWith(".md"))
        .filter((fileName) => !activeNames.has(fileName.toLocaleLowerCase("ko-KR")))
        .forEach((fileName) => fs.unlinkSync(path.join(ruleDir, fileName)));
      const legacyFile = path.join(promptsDir, "updateRules.md");
      if (fs.existsSync(legacyFile)) fs.unlinkSync(legacyFile);
      sendJson(response, 200, { success: true, rules: savedRules });
      return true;
    } catch (err) {
      sendJson(response, 500, { error: err.message });
      return true;
    }
  }

  // 알플레이 업적 관리 API (achievements.json)
  if (url.pathname === "/api/achievements" && request.method === "GET") {
    let workId = url.searchParams.get("workId") || "default";
    try { workId = decodeURIComponent(workId); } catch (e) {}
    const parts = String(workId).split("::");
    const cleanWorkId = safeId(parts[0]);
    const platformId = parts[1] ? safeId(parts[1]) : "알플레이";

    const achvPath = path.join(dataDir, "works", cleanWorkId, platformId, "achievements.json");
    if (fs.existsSync(achvPath)) {
      try {
        const data = JSON.parse(readText(achvPath));
        sendJson(response, 200, { success: true, achievements: Array.isArray(data) ? data : (data.achievements || []) });
        return true;
      } catch (err) {
        sendJson(response, 500, { error: "achievements.json 파싱 실패" });
        return true;
      }
    }
    sendJson(response, 200, { success: true, achievements: [] });
    return true;
  }

  if (url.pathname === "/api/achievements" && request.method === "POST") {
    try {
      const body = await readBody(request);
      let { workId = "default", achievements = [] } = body;
      try { workId = decodeURIComponent(workId); } catch (e) {}
      const parts = String(workId).split("::");
      const cleanWorkId = safeId(parts[0]);
      const platformId = parts[1] ? safeId(parts[1]) : "알플레이";

      const targetDir = path.join(dataDir, "works", cleanWorkId, platformId);
      ensureDir(targetDir);
      const achvPath = path.join(targetDir, "achievements.json");
      writeJson(achvPath, { achievements });
      sendJson(response, 200, { success: true, achievements });
      return true;
    } catch (err) {
      sendJson(response, 500, { error: err.message });
      return true;
    }
  }

  if (url.pathname === "/api/assets" && request.method === "GET") {
    const workId = url.searchParams.get("workId");
    const assetDir = findAssetDir(workId);
    if (!assetDir || !fs.existsSync(assetDir)) {
      sendJson(response, 200, { success: false, assets: [], message: "Asset directory not found" });
      return true;
    }
    const files = fs.readdirSync(assetDir)
      .filter(f => f.endsWith(".html"))
      .map(name => ({ name }));
    sendJson(response, 200, { success: true, assets: files });
    return true;
  }


  if (url.pathname === "/api/asset-content" && request.method === "GET") {
    const workId = url.searchParams.get("workId");
    const name = url.searchParams.get("name");
    const assetDir = findAssetDir(workId);
    if (!assetDir) {
      sendJson(response, 400, { error: "Asset directory not found" });
      return true;
    }
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      sendJson(response, 400, { error: "Invalid filename" });
      return true;
    }
    const filePath = path.join(assetDir, name);
    if (!fs.existsSync(filePath)) {
      sendJson(response, 404, { error: "File not found" });
      return true;
    }
    const content = fs.readFileSync(filePath, "utf8");
    sendJson(response, 200, { success: true, name, content });
    return true;
  }

  if (url.pathname === "/api/asset-content" && request.method === "PUT") {
    const body = await readBody(request);
    const { workId, name, content } = body;
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      sendJson(response, 400, { error: "Invalid filename" });
      return true;
    }
    const assetDir = findAssetDir(workId);
    if (!assetDir) {
      sendJson(response, 400, { error: "Asset directory not found" });
      return true;
    }
    ensureDir(assetDir);
    const filePath = path.join(assetDir, name);
    fs.writeFileSync(filePath, content, "utf8");
    sendJson(response, 200, { success: true });
    return true;
  }

  if (url.pathname === "/api/asset-content" && request.method === "DELETE") {
    const workId = url.searchParams.get("workId");
    const name = url.searchParams.get("name");
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      sendJson(response, 400, { error: "Invalid filename" });
      return true;
    }
    const assetDir = findAssetDir(workId);
    if (!assetDir) {
      sendJson(response, 400, { error: "Asset directory not found" });
      return true;
    }
    const filePath = path.join(assetDir, name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    sendJson(response, 200, { success: true });
    return true;
  }

  if (url.pathname === "/api/works" && request.method === "GET") {
    sendJson(response, 200, { works: readWorks() });
    return true;
  }

  if (url.pathname === "/api/works" && request.method === "POST") {
    const body = await readBody(request);
    const name = String(body.name || "").trim();
    const id = safeId(body.id || name);
    const platformName = String(body.platform || "알플레이").trim() || "알플레이";
    const platformId = safeId(platformName);

    const validationError = validateWorkName(name, id);
    if (validationError) {
      sendJson(response, 400, { error: validationError });
      return true;
    }

    const currentWorks = readWorks();
    if (currentWorks.some((work) => work.id === id)) {
      sendJson(response, 409, { error: "work already exists" });
      return true;
    }

    const savedWorks = readJson(worksFile, []);
    const nextWorks = [
      ...(Array.isArray(savedWorks) ? savedWorks : []),
      { id, name, platforms: [platformName] }
    ];
    writeJson(worksFile, nextWorks);
    ensureWorkFiles(id, platformId);

    const work = readWorks().find((candidate) => candidate.id === id);
    sendJson(response, 201, { ok: true, work, works: readWorks() });
    return true;
  }

  const renameWorkMatch = url.pathname.match(/^\/api\/works\/([^/]+)$/);
  if (renameWorkMatch && request.method === "PATCH") {
    let currentId;
    try {
      currentId = safeId(decodeURIComponent(renameWorkMatch[1]));
    } catch {
      sendJson(response, 400, { error: "invalid work id" });
      return true;
    }

    const body = await readBody(request);
    const name = String(body.name || "").trim();
    const nextId = safeId(body.id || name);
    const validationError = validateWorkName(name, nextId);
    if (validationError) {
      sendJson(response, 400, { error: validationError });
      return true;
    }

    const currentWorks = readWorks();
    const currentWork = currentWorks.find((work) => work.id === currentId);
    if (!currentWork) {
      sendJson(response, 404, { error: "work not found" });
      return true;
    }
    if (nextId !== currentId && currentWorks.some((work) => work.id === nextId)) {
      sendJson(response, 409, { error: "같은 이름의 작품 폴더가 이미 있습니다." });
      return true;
    }

    const worksRoot = path.resolve(dataDir, "works");
    const currentRoot = path.resolve(worksRoot, currentId);
    const nextRoot = path.resolve(worksRoot, nextId);
    if (path.dirname(currentRoot) !== worksRoot || path.dirname(nextRoot) !== worksRoot) {
      sendJson(response, 400, { error: "invalid work folder" });
      return true;
    }
    if (!fs.existsSync(currentRoot)) {
      sendJson(response, 404, { error: "작품 폴더를 찾을 수 없습니다." });
      return true;
    }
    if (nextId !== currentId && fs.existsSync(nextRoot)) {
      sendJson(response, 409, { error: "같은 이름의 작품 폴더가 이미 있습니다." });
      return true;
    }

    const nextWorks = currentWorks.map((work) => work.id === currentId
      ? { ...work, id: nextId, name }
      : work
    );
    let moved = false;
    try {
      if (nextId !== currentId) {
        fs.renameSync(currentRoot, nextRoot);
        moved = true;
      }
      writeJson(worksFile, nextWorks);
    } catch (error) {
      if (moved && fs.existsSync(nextRoot) && !fs.existsSync(currentRoot)) {
        try {
          fs.renameSync(nextRoot, currentRoot);
        } catch (rollbackError) {
          console.error("작품 폴더 이름 변경 롤백 실패:", rollbackError);
        }
      }
      sendJson(response, 500, { error: `작품 이름 변경 실패: ${error.message}` });
      return true;
    }

    const works = readWorks();
    const work = works.find((candidate) => candidate.id === nextId);
    sendJson(response, 200, { ok: true, work, works });
    return true;
  }


  if (url.pathname === "/api/storage") {
    const key = url.searchParams.get("key");
    const [baseKey] = String(key || "").split("::");
    const file = storagePath(key);
    if (!file) {
      sendJson(response, 400, { error: "missing key" });
      return true;
    }

    if (request.method === "GET") {
      if (baseKey === "character-manager-roster-v1") {
        const charDir = file;
        if (fs.existsSync(charDir)) {
          const files = fs.readdirSync(charDir).filter(f => /\.json$/i.test(f));
          const value = files.map(f => {
            const charData = readJson(path.join(charDir, f), null);
            if (!charData) return null;
            const mdFilePath = path.join(charDir, `${path.basename(f, ".json")}.md`);
            if (fs.existsSync(mdFilePath)) {
              charData.prompt = readText(mdFilePath);
            }
            return charData;
          }).filter(Boolean);
          sendJson(response, 200, { found: true, value });
        } else {
          sendJson(response, 200, { found: true, value: [] });
        }
      } else if (baseKey === "character-lorebook-manager-v1") {
        const lbDir = path.join(path.dirname(file), "lorebook");
        console.log("DEBUG: [GET] lbDir =", lbDir, "| Exists =", fs.existsSync(lbDir));
        const snapshot = loreCollectionSnapshot(lbDir);
        console.log("DEBUG: [GET] snapshot jsonFiles =", snapshot.jsonFiles.length, "| invalidJsonFiles =", snapshot.invalidJsonFiles.length);
        if (fs.existsSync(lbDir)) {
          const files = snapshot.jsonFiles;
          const markdownFiles = loreMarkdownFiles(lbDir);
          const entries = files.map((fileName) => {
            const record = readLoreRecord(lbDir, fileName, markdownFiles);
            if (!record) console.log("DEBUG: readLoreRecord returned null for file:", fileName);
            return record ? { ...record.entry, fileName, sourceFileName: fileName } : null;
          }).filter(Boolean);
          console.log("DEBUG: [GET] final entries length =", entries.length);
          entries.sort((a, b) => {
            const orderA = String(a.no || "");
            const orderB = String(b.no || "");
            if (orderA !== orderB) return orderA.localeCompare(orderB);
            return a.fileName.localeCompare(b.fileName, "ko");
          });
          sendJson(response, 200, {
            found: true,
            value: {
              entries,
              typePriorities: loreTypePriorities(lbDir),
              collectionRevision: snapshot.collectionRevision,
              invalidJsonFiles: snapshot.invalidJsonFiles
            }
          });
        } else {
          sendJson(response, 200, {
            found: true,
            value: {
              entries: [],
              typePriorities: loreTypePriorities(lbDir),
              collectionRevision: snapshot.collectionRevision,
              invalidJsonFiles: snapshot.invalidJsonFiles
            }
          });
        }
      } else if (baseKey === "character-rplay-variables-v1") {
        const varData = fs.existsSync(file) ? readJson(file, { variables: [] }) : { variables: [] };
        const variables = Array.isArray(varData?.variables) ? varData.variables : (Array.isArray(varData) ? varData : []);
        sendJson(response, 200, { found: true, value: { variables } });
      } else {
        if (!fs.existsSync(file)) {
          sendJson(response, 200, { found: false, value: null });
        } else {
          let value;
          if (baseKey === "character-prompt-manager-v1") {
            value = loadPrompts(file);
          } else if (baseKey === "rplay-manager-v1") {
            value = loadRplayManager(file);
          } else {
            value = readJson(file, null);
          }
          sendJson(response, 200, { found: true, value });
        }
      }
      return true;
    }

    if (request.method === "PUT") {
      const body = await readBody(request);
      let valueToSave = body.value;
      let responseValue = null;

      if (baseKey === "character-prompt-manager-v1") {
        savePrompts(file, valueToSave);
      } else if (baseKey === "character-rplay-variables-v1") {
        const variables = Array.isArray(valueToSave?.variables) ? valueToSave.variables : [];
        writeJson(file, { variables });
      } else if (baseKey === "rplay-manager-v1") {
        saveRplayManager(file, valueToSave);
      } else if (baseKey === "character-manager-roster-v1") {
        const charDir = file;
        ensureDir(charDir);
        const activeIds = new Set();
        if (Array.isArray(valueToSave)) {
          const seenIds = new Set();
          const invalid = valueToSave.find((character) => {
            const id = String(character?.id || "").trim();
            const key = id.toLocaleLowerCase();
            if (!isSafeEntryId(id) || seenIds.has(key)) return true;
            seenIds.add(key);
            return false;
          });
          if (invalid) {
            sendJson(response, 400, { error: "캐릭터 ID는 한글·영문·숫자와 ._-만 사용할 수 있으며 중복될 수 없습니다." });
            return true;
          }
          valueToSave.forEach(char => {
            const charId = String(char.id || "").trim();
            if (charId) {
              activeIds.add(`${charId}.json`.toLocaleLowerCase());
              activeIds.add(`${charId}.md`.toLocaleLowerCase());
              const charToSave = { ...char };
              const promptText = typeof charToSave.prompt === "string" ? charToSave.prompt : "";
              const mdFilePath = path.join(charDir, `${charId}.md`);
              fs.writeFileSync(mdFilePath, promptText, "utf8");
              charToSave.prompt = "";
              writeJson(path.join(charDir, `${charId}.json`), charToSave);
            }
          });
          const files = fs.readdirSync(charDir).filter(f => /\.(json|md)$/i.test(f));
          files.forEach(f => {
            if (!activeIds.has(f.toLocaleLowerCase())) {
              try { fs.unlinkSync(path.join(charDir, f)); } catch (e) {}
            }
          });
        }
      } else if (baseKey === "character-lorebook-manager-v1") {
        const lbDir = path.join(path.dirname(file), "lorebook");
        ensureDir(lbDir);
        if (valueToSave && Array.isArray(valueToSave.entries)) {
          const snapshot = loreCollectionSnapshot(lbDir);
          if (snapshot.invalidJsonFiles.length) {
            sendJson(response, 409, {
              error: `파싱할 수 없는 로어북 JSON이 있어 저장을 중단했습니다: ${snapshot.invalidJsonFiles.join(", ")}`
            });
            return true;
          }
          if (!valueToSave.collectionRevision
            || valueToSave.collectionRevision !== snapshot.collectionRevision) {
            sendJson(response, 409, {
              error: "로어북 파일이 다른 창이나 외부 편집기에서 변경되었습니다. 새로고침한 뒤 변경 내용을 다시 적용해 주세요."
            });
            return true;
          }
          const typePriorities = valueToSave.typePriorities ?? loreTypePriorities(lbDir);
          if (!validLoreTypePriorities(typePriorities) || valueToSave.entries.some(entry => entry?.priority != null
            && (!Number.isSafeInteger(entry.priority) || entry.priority < 0))) {
            sendJson(response, 400, { error: "타입 이름은 1~80자, 우선순위는 0 이상의 정수로 입력하세요." });
            return true;
          }
          const files = snapshot.jsonFiles;
          const markdownFiles = loreMarkdownFiles(lbDir);
          const oldRecords = files
            .map((fileName) => readLoreRecord(lbDir, fileName, markdownFiles))
            .filter(Boolean);
          const oldByFileName = new Map(oldRecords.map((record) => [record.fileName.toLocaleLowerCase(), record]));
          const oldById = new Map(oldRecords
            .filter((record) => record.entry.id)
            .map((record) => [String(record.entry.id).toLocaleLowerCase(), record]));
          const managedBodyFiles = new Set(oldRecords
            .filter((record) => record.paired && record.actualBodyFileName)
            .map((record) => record.actualBodyFileName.toLocaleLowerCase()));
          const seenIds = new Set();
          const seenFileNames = new Set();
          const nowIso = new Date().toISOString();
          const prepared = [];
          const migrateAll = valueToSave.migrateLegacyBodies === true;
          let migratedCount = 0;

          for (let index = 0; index < valueToSave.entries.length; index += 1) {
            const rawEntry = valueToSave.entries[index] || {};
            const id = String(rawEntry.id || "").trim();
            const idKey = id.toLocaleLowerCase();
            const fileName = normalizeLoreFileName(rawEntry.fileName, id);
            const sourceFileName = rawEntry.sourceFileName
              ? normalizeLoreFileName(rawEntry.sourceFileName, id)
              : null;
            const fileKey = String(fileName || "").toLocaleLowerCase();
            if (!isSafeEntryId(id) || seenIds.has(idKey)) {
              sendJson(response, 400, { error: `로어북 ID가 비어 있거나 중복/잘못된 형식입니다: ${id || "(빈 ID)"}` });
              return true;
            }
            if (!fileName || (rawEntry.sourceFileName && !sourceFileName) || seenFileNames.has(fileKey)) {
              sendJson(response, 400, { error: `로어북 파일명이 비어 있거나 중복/잘못된 형식입니다: ${rawEntry.fileName || "(빈 파일명)"}` });
              return true;
            }
            seenIds.add(idKey);
            seenFileNames.add(fileKey);

            const oldRecord = (sourceFileName && oldByFileName.get(sourceFileName.toLocaleLowerCase()))
              || oldById.get(idKey)
              || oldByFileName.get(fileKey)
              || null;
            const oldEntry = oldRecord?.entry || null;
            if (oldRecord && rawEntry.bodyRevision
              && rawEntry.bodyRevision !== oldEntry.bodyRevision) {
              sendJson(response, 409, {
                error: `${oldRecord.bodyFileName} 본문이 관리툴을 연 뒤 외부에서 변경되었습니다. 새로고침 후 다시 수정해 주세요.`
              });
              return true;
            }
            if (oldRecord?.paired
              && ["missing-md", "unreadable-md", "invalid-body-file"].includes(oldEntry.bodyStatus)
              && rawEntry.repairMissingBody !== true) {
              sendJson(response, 409, {
                error: `${oldRecord.bodyFileName} 본문을 안전하게 읽지 못했습니다. 빈 본문으로 덮어쓰지 않도록 저장을 중단했습니다.`
              });
              return true;
            }

            const migrateBody = migrateAll || rawEntry.migrateBodyToMarkdown === true;
            const paired = Boolean(oldRecord?.paired
              || rawEntry.bodyStorage === loreBodyStorage
              || migrateBody
              || !oldRecord);
            const bodyFileName = loreBodyFileName(fileName);
            const existingTargetBody = markdownFiles.get(bodyFileName.toLocaleLowerCase()) || "";
            if (paired && existingTargetBody
              && !managedBodyFiles.has(existingTargetBody.toLocaleLowerCase())) {
              sendJson(response, 409, {
                error: `${bodyFileName} 파일이 기존 JSON과 연결되지 않은 상태로 이미 존재합니다. 파일을 확인한 뒤 다시 시도해 주세요.`
              });
              return true;
            }

            const entry = {
              ...rawEntry,
              id,
              no: String(rawEntry.no || "").trim(),
              body: normalizeLoreBody(Object.prototype.hasOwnProperty.call(rawEntry, "body")
                ? rawEntry.body
                : oldEntry?.body || "")
            };
            delete entry.fileName;
            delete entry.sourceFileName;
            entry.updatedAt = !oldEntry || isLoreEntryContentChanged(entry, oldEntry)
              ? nowIso
              : oldEntry.updatedAt || entry.updatedAt || nowIso;
            const metadata = loreMetadata(entry, fileName, paired);
            const sourceBodyFileName = oldRecord?.paired
              ? oldRecord.actualBodyFileName || oldRecord.bodyFileName
              : "";
            if (oldRecord && !oldRecord.paired && paired) migratedCount += 1;
            prepared.push({
              fileName,
              sourceFileName: oldRecord?.fileName || sourceFileName || "",
              bodyFileName,
              sourceBodyFileName,
              paired,
              entry,
              metadata,
              oldRecord,
              oldEntry,
              bodyChanged: !oldEntry || loreBodyRevision(entry.body) !== oldEntry.bodyRevision
            });
          }

          if (loreCollectionSnapshot(lbDir).collectionRevision !== snapshot.collectionRevision) {
            sendJson(response, 409, {
              error: "저장 준비 중 로어북 파일이 외부에서 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요."
            });
            return true;
          }

          prepared.forEach((record, index) => {
            if (!record.paired) return;
            const bodyRenamed = record.sourceBodyFileName
              && record.sourceBodyFileName !== record.bodyFileName;
            const targetBodyPath = path.join(lbDir, record.bodyFileName);
            if (!record.oldRecord?.paired || bodyRenamed || record.bodyChanged || !fs.existsSync(targetBodyPath)) {
              writeCaseAwareFile(
                lbDir,
                record.sourceBodyFileName,
                record.bodyFileName,
                `body-${index}`,
                (targetPath) => writeLoreBody(targetPath, record.entry.body)
              );
            }
          });

          prepared.forEach((record, index) => {
            const targetPath = path.join(lbDir, record.fileName);
            const renamed = record.sourceFileName && record.sourceFileName !== record.fileName;
            const metadataChanged = !record.oldRecord
              || JSON.stringify(record.metadata) !== JSON.stringify(record.oldRecord.metadata);
            if (renamed || !fs.existsSync(targetPath) || metadataChanged) {
              writeCaseAwareFile(
                lbDir,
                record.sourceFileName,
                record.fileName,
                `metadata-${index}`,
                (writePath) => writeJson(writePath, record.metadata)
              );
            }
          });

          const activeFileNames = new Set(prepared.map((record) => record.fileName.toLocaleLowerCase()));
          const activeBodyFileNames = new Set(prepared
            .filter((record) => record.paired)
            .map((record) => record.bodyFileName.toLocaleLowerCase()));
          const cleanupErrors = [];
          files.forEach((fileName) => {
            if (!activeFileNames.has(fileName.toLocaleLowerCase())) {
              try {
                fs.unlinkSync(path.join(lbDir, fileName));
              } catch (error) {
                cleanupErrors.push(`${fileName}: ${error.message}`);
              }
            }
          });
          oldRecords.forEach((record) => {
            if (!record.paired) return;
            const oldBodyFileName = record.actualBodyFileName || record.bodyFileName;
            if (!activeBodyFileNames.has(oldBodyFileName.toLocaleLowerCase())) {
              try {
                fs.unlinkSync(path.join(lbDir, oldBodyFileName));
              } catch (error) {
                cleanupErrors.push(`${oldBodyFileName}: ${error.message}`);
              }
            }
          });
          if (cleanupErrors.length) {
            sendJson(response, 500, {
              error: `로어북의 이전 파일을 정리하지 못했습니다. 새로고침 후 파일 상태를 확인해 주세요: ${cleanupErrors.join(" | ")}`
            });
            return true;
          }

          if (JSON.stringify(typePriorities) !== JSON.stringify(loreTypePriorities(lbDir))) {
            const settingsFile = loreSettingsPath(lbDir);
            writeJson(settingsFile, { ...readJson(settingsFile, {}), typePriorities });
          }
          const refreshedMarkdownFiles = loreMarkdownFiles(lbDir);
          const responseEntries = prepared.map((record) => {
            const refreshed = readLoreRecord(lbDir, record.fileName, refreshedMarkdownFiles);
            return refreshed ? {
              ...refreshed.entry,
              fileName: record.fileName,
              sourceFileName: record.fileName
            } : null;
          }).filter(Boolean);
          const { migrateLegacyBodies, migration: ignoredMigration, ...responseState } = valueToSave;
          responseValue = {
            ...responseState,
            typePriorities,
            entries: responseEntries,
            collectionRevision: loreCollectionSnapshot(lbDir).collectionRevision,
            invalidJsonFiles: [],
            migration: { migrated: migratedCount }
          };
        }
      } else {
        writeJson(file, valueToSave);
      }
      sendJson(response, 200, responseValue ? { ok: true, value: responseValue } : { ok: true });
      return true;
    }

    if (request.method === "DELETE") {
      if (
        baseKey !== "character-lorebook-manager-v1"
        && baseKey !== "character-manager-roster-v1"
        && fs.existsSync(file)
      ) {
        fs.unlinkSync(file);
      }
      // 관련 폴더들도 같이 삭제
      if (baseKey === "character-manager-roster-v1") {
        const charDir = file;
        if (fs.existsSync(charDir)) {
          const files = fs.readdirSync(charDir).filter(f => /\.json$/i.test(f));
          files.forEach(f => {
            try { fs.unlinkSync(path.join(charDir, f)); } catch (e) {}
          });
        }
      }
      if (baseKey === "character-lorebook-manager-v1") {
        const lbDir = path.join(path.dirname(file), "lorebook");
        if (fs.existsSync(lbDir)) {
          const snapshot = loreCollectionSnapshot(lbDir);
          if (snapshot.invalidJsonFiles.length) {
            sendJson(response, 409, {
              error: `파싱할 수 없는 로어북 JSON이 있어 전체 삭제를 중단했습니다: ${snapshot.invalidJsonFiles.join(", ")}`
            });
            return true;
          }
          const files = snapshot.jsonFiles;
          const markdownFiles = loreMarkdownFiles(lbDir);
          const records = files.map((fileName) => readLoreRecord(lbDir, fileName, markdownFiles)).filter(Boolean);
          const cleanupErrors = [];
          records.forEach((record) => {
            try {
              fs.unlinkSync(path.join(lbDir, record.fileName));
            } catch (error) {
              cleanupErrors.push(`${record.fileName}: ${error.message}`);
            }
            if (record.paired) {
              const bodyFileName = record.actualBodyFileName || record.bodyFileName;
              try {
                fs.unlinkSync(path.join(lbDir, bodyFileName));
              } catch (error) {
                cleanupErrors.push(`${bodyFileName}: ${error.message}`);
              }
            }
          });
          if (cleanupErrors.length) {
            sendJson(response, 500, {
              error: `일부 로어북 파일을 삭제하지 못했습니다. 파일 상태를 확인해 주세요: ${cleanupErrors.join(" | ")}`
            });
            return true;
          }
        }
      }
      sendJson(response, 200, { ok: true });
      return true;
    }
  }


  return false;
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function serveFile(response, file, cacheControl = "no-store") {
  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": cacheControl
  });
  fs.createReadStream(file).pipe(response);
}

function redirectLegacyTool(response, url) {
  const requested = decodeURIComponent(url.pathname);
  const match = requested.match(
    /^\/(설정|프롬프트|로어북|에셋|알플레이)\/index\.html$/
  );
  if (!match) return false;

  response.writeHead(308, {
    Location: encodeURI(`/${match[1]}`),
    "Cache-Control": "no-store"
  });
  response.end();
  return true;
}

function serveReact(response, url) {
  if (!fs.existsSync(path.join(reactRoot, "index.html"))) {
    response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("React UI build not found. Run npm run build:ui.");
    return;
  }

  const requested = decodeURIComponent(
    url.pathname === "/" ? "/index.html" : url.pathname
  );
  const file = path.resolve(reactRoot, `.${requested}`);
  if (!isInside(reactRoot, file)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const cacheControl = requested.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-store";
    serveFile(response, file, cacheControl);
    return;
  }

  if (path.extname(requested)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  serveFile(response, path.join(reactRoot, "index.html"));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      if (await handleApi(request, response, url)) return;
      sendJson(response, 404, { error: "API route not found" });
      return;
    }
    if (redirectLegacyTool(response, url)) return;
    serveReact(response, url);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, process.env.HOST || "127.0.0.1", () => {
  console.log(`Rplay canvas manager: http://localhost:${port}/`);
  console.log(`Data directory: ${dataDir}`);
});
