const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const { spawn } = require("node:child_process");

const codeDir = path.resolve(__dirname, "..");
const runtimeFile = path.resolve(codeDir, process.env.CHARACTER_MANAGER_RUNTIME_FILE || "../.rplay-canvas-runtime.json");
const service = "rplay-canvas-manager";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const samePath = (left, right) => typeof left === "string" && typeof right === "string"
  && path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();

function readRuntime() {
  if (!fs.existsSync(runtimeFile)) return null;
  return JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
}

function validUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password) {
    throw new Error("실행 정보의 로컬 서버 주소가 올바르지 않습니다.");
  }
  return url.origin;
}

async function health(url) {
  try {
    const response = await fetch(`${validUrl(url)}/api/health`, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return null;
    const result = await response.json();
    return result.service === service ? result : null;
  } catch { return null; }
}

function portInUse(port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", (error) => {
      socket.destroy();
      if (error.code === "ECONNREFUSED") resolve(false);
      else reject(error);
    });
    socket.setTimeout(1500, () => { socket.destroy(); reject(new Error("서버 포트 상태를 확인하지 못했습니다.")); });
  });
}

function openBrowser(url) {
  if (process.env.CHARACTER_MANAGER_NO_BROWSER === "1") return;
  const child = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", validUrl(url)], {
    windowsHide: true, detached: true, stdio: "ignore"
  });
  child.on("error", () => console.log(`브라우저에서 ${url} 를 열어 주세요.`));
  child.unref();
}

async function start() {
  const originalDataOverride = process.env.CHARACTER_MANAGER_DATA_DIR;
  const { dataDir } = require("../shared/dataPaths.cjs");
  const port = Number(process.env.PORT || 4174);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT는 1~65535 사이의 정수여야 합니다.");
  const url = `http://127.0.0.1:${port}`;
  const existing = await health(url);
  if (existing) {
    if (!samePath(existing.codeDir, codeDir) || !samePath(existing.dataDir, dataDir)) {
      throw new Error("같은 포트에서 다른 관리툴 또는 데이터 폴더가 실행 중입니다. 기존 서버를 종료한 뒤 다시 실행하세요.");
    }
    console.log(`이미 실행 중입니다: ${url}`);
    openBrowser(url);
    return;
  }
  if (await portInUse(port)) {
    throw new Error(`${port} 포트를 사용 중인 서버가 있습니다. 기존 dev 서버를 종료한 뒤 다시 실행하세요.`);
  }
  if (!fs.existsSync(path.join(codeDir, "dist", "index.html"))) {
    throw new Error("빌드된 화면이 없습니다. 개발 환경에서는 pnpm build를 실행하고, 배포본에는 dist 폴더를 포함해 주세요.");
  }
  const logDir = path.join(dataDir, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const token = crypto.randomBytes(32).toString("hex");
  const launcherId = crypto.createHash("sha256").update(token).digest("hex");
  const env = { ...process.env, HOST: "127.0.0.1", PORT: String(port), CHARACTER_MANAGER_LAUNCH_TOKEN: token };
  // dataPaths exports the effective path for scripts; let the server resolve its original source again.
  if (originalDataOverride) env.CHARACTER_MANAGER_DATA_DIR = originalDataOverride;
  else delete env.CHARACTER_MANAGER_DATA_DIR;
  const python = path.join(codeDir, "runtime", "python", "python.exe");
  if (!env.PYTHON_EXECUTABLE && fs.existsSync(python)) env.PYTHON_EXECUTABLE = python;
  const stdout = fs.openSync(path.join(logDir, "rplay-canvas.stdout.log"), "a");
  const stderr = fs.openSync(path.join(logDir, "rplay-canvas.stderr.log"), "a");
  let child;
  try {
    child = spawn(process.execPath, [path.join(codeDir, "server.js")], {
      cwd: codeDir, env, detached: true, windowsHide: true, stdio: ["ignore", stdout, stderr]
    });
  } finally {
    fs.closeSync(stdout);
    fs.closeSync(stderr);
  }
  let failure;
  child.on("error", (error) => { failure = error; });
  child.on("exit", (code) => { failure = new Error(`서버가 종료되었습니다 (${code}). 기존 dev 서버 또는 포트 충돌을 확인하세요.`); });
  child.unref();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const running = await health(url);
    if (running && running.launcherId === launcherId && samePath(running.codeDir, codeDir)) {
      try {
        fs.writeFileSync(runtimeFile, JSON.stringify({ url, token, codeDir, pid: child.pid }, null, 2) + "\n", { mode: 0o600 });
      } catch (error) {
        await fetch(`${url}/api/launcher/stop`, { method: "POST", headers: { "X-Manager-Token": token }, signal: AbortSignal.timeout(2000) }).catch(() => {});
        throw error;
      }
      console.log(`관리툴 실행: ${url}\n데이터 폴더: ${dataDir}`);
      openBrowser(url);
      return;
    }
    if (failure) throw failure;
    await pause(250);
  }
  // Only the child we just created is eligible for cleanup after a failed start.
  child.kill();
  throw new Error(`서버 준비를 확인하지 못했습니다. ${logDir}의 로그를 확인하세요.`);
}

async function stop() {
  const runtime = readRuntime();
  if (!runtime) {
    console.log("실행.cmd로 켠 서버가 없습니다. dev로 켠 서버는 해당 터미널에서 종료하세요.");
    return;
  }
  if (!samePath(runtime.codeDir, codeDir) || typeof runtime.token !== "string") {
    throw new Error("다른 관리툴의 실행 정보입니다. 해당 관리툴에서 종료하세요.");
  }
  const url = validUrl(runtime.url);
  const running = await health(url);
  const launcherId = crypto.createHash("sha256").update(runtime.token).digest("hex");
  if (running && (!samePath(running.codeDir, codeDir) || running.launcherId !== launcherId)) {
    throw new Error("실행 정보와 현재 서버가 다릅니다. 이 서버는 종료하지 않습니다.");
  }
  if (running) {
    const response = await fetch(`${url}/api/launcher/stop`, {
      method: "POST", headers: { "X-Manager-Token": runtime.token }, signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error("서버 종료 요청이 거부되었습니다.");
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (!await health(url)) break;
      if (attempt === 39) throw new Error("서버가 아직 종료 중입니다. 잠시 후 다시 시도하세요.");
      await pause(250);
    }
  }
  // Keep a newer launcher's state if another start completed while stopping.
  if (readRuntime()?.token === runtime.token) fs.unlinkSync(runtimeFile);
  console.log("관리툴 서버를 종료했습니다.");
}

async function selectData() {
  const { readSettings, saveDataDirectory } = require("../shared/dataDirectorySettings.cjs");
  const { pickFolder } = require("../shared/directoryPicker.cjs");
  const settings = readSettings();
  const result = await pickFolder(typeof settings.dataDirectory === "string"
    ? path.resolve(codeDir, settings.dataDirectory) : path.resolve(codeDir, "../data"), "데이터 저장 폴더 선택");
  if (result) saveDataDirectory(result);
  console.log(result ? "데이터 폴더를 저장했습니다. 다음 실행부터 적용됩니다." : "폴더 선택을 취소했습니다.");
}

if (require.main === module) {
  const actions = { start, stop, "select-data": selectData };
  const action = actions[process.argv[2] || "start"];
  Promise.resolve().then(() => {
    if (!action) throw new Error("지원하지 않는 실행 명령입니다.");
    return action();
  }).catch((error) => {
    console.error(error.message);
    console.error("저장 위치를 다시 지정하려면 '데이터 폴더 변경.cmd'를 실행하세요.");
    process.exitCode = 1;
  });
}

module.exports = { start, stop, health, validUrl };
