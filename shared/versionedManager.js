const fs = require("fs");
const path = require("path");
const { TextDecoder } = require("util");

function safeId(value) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "default";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readText(file) {
  const buffer = fs.readFileSync(file);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("euc-kr", { fatal: true }).decode(buffer);
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readText(file));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadVersionedManager(filePath, folderName, textFields, globalFields = []) {
  const data = readJson(filePath, { versions: [], activeVersionId: "" });
  const managerDir = path.join(path.dirname(filePath), folderName);

  globalFields.forEach(field => {
    const fieldFile = path.join(managerDir, `${field}.md`);
    if (fs.existsSync(fieldFile)) {
      data[field] = fs.readFileSync(fieldFile, "utf8");
    } else if (data[field]) {
      // Legacy inline content remains readable without changing shared data.
    } else {
      data[field] = "";
    }
  });

  if (Array.isArray(data.versions)) {
    data.versions = data.versions.map((version) => {
      const versionDir = path.join(managerDir, safeId(version.id));
      const loadedData = {};

      textFields.forEach((field) => {
        const fieldFile = path.join(versionDir, `${field}.md`);
        if (fs.existsSync(fieldFile)) {
          loadedData[field] = fs.readFileSync(fieldFile, "utf8");
        } else if (version[field]) {
          loadedData[field] = version[field];

        } else {
          loadedData[field] = "";
        }
      });

      return {
        ...version,
        ...loadedData
      };
    });


  }
  return data;
}

function saveVersionedManager(filePath, value, folderName, textFields, globalFields = []) {
  if (!value) return;
  const managerDir = path.join(path.dirname(filePath), folderName);
  ensureDir(managerDir);

  const clonedData = clone(value);

  globalFields.forEach(field => {
    if (typeof clonedData[field] === "string") {
      fs.writeFileSync(path.join(managerDir, `${field}.md`), clonedData[field], "utf8");
      clonedData[field] = "";
    }
  });

  if (Array.isArray(clonedData.versions)) {
    clonedData.versions = clonedData.versions.map((version) => {
      const versionId = safeId(version.id);
      const versionDir = path.join(managerDir, versionId);
      ensureDir(versionDir);

      textFields.forEach((field) => {
        const fieldFile = path.join(versionDir, `${field}.md`);
        const textValue = version[field] || "";
        fs.writeFileSync(fieldFile, textValue, "utf8");
        version[field] = "";
      });

      return version;
    });
  }

  writeJson(filePath, clonedData);
}

module.exports = {
  loadVersionedManager,
  saveVersionedManager
};
