const path = require("node:path");
const fs = require("node:fs");

const codeDir = path.resolve(__dirname, "..");
const settingsFile = path.resolve(codeDir, process.env.CHARACTER_MANAGER_SETTINGS_FILE || "../rplay-canvas-settings.json");

function canonicalPath(target) {
  let existing = target;
  const suffix = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    suffix.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(fs.realpathSync(existing), ...suffix);
}

function readConfiguredDirectory() {
  if (!fs.existsSync(settingsFile)) return undefined;
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(`개인 설정 파일을 읽을 수 없습니다: ${settingsFile} (${error.message})`);
  }
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error(`개인 설정 파일은 JSON 객체여야 합니다: ${settingsFile}`);
  }
  if (settings.dataDirectory === undefined) return undefined;
  if (typeof settings.dataDirectory !== "string" || !settings.dataDirectory.trim()) {
    throw new Error(`개인 설정의 dataDirectory는 비어 있지 않은 경로여야 합니다: ${settingsFile}`);
  }
  return settings.dataDirectory;
}

const environmentDirectory = process.env.CHARACTER_MANAGER_DATA_DIR;
const configuredDirectory = environmentDirectory || readConfiguredDirectory();
const dataDirectorySource = environmentDirectory ? "environment" : configuredDirectory ? "settings" : "default";
// Relative overrides are resolved from the code directory, never the shell cwd.
const resolvedDirectory = path.resolve(codeDir, configuredDirectory || "../data");
const dataDir = canonicalPath(resolvedDirectory);
const relative = path.relative(canonicalPath(codeDir), dataDir);
if (!relative || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))) {
  throw new Error("데이터 폴더는 관리툴 코드 폴더 밖의 경로여야 합니다.");
}
if (!fs.existsSync(dataDir)) {
  if (configuredDirectory) throw new Error(`선택한 데이터 폴더가 없습니다: ${dataDir}`);
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.statSync(dataDir).isDirectory()) {
  throw new Error(`데이터 경로가 폴더가 아닙니다: ${dataDir}`);
}

require("dotenv").config({ path: path.join(dataDir, ".env") });
// Python subprocesses use the same resolved root as the server.
process.env.CHARACTER_MANAGER_DATA_DIR = dataDir;

module.exports = {
  codeDir,
  settingsFile,
  dataDirectorySource,
  dataDir,
  configDir: path.join(dataDir, "config"),
  exportsDir: path.join(dataDir, "exports"),
  reportsDir: path.join(dataDir, "reports"),
};
