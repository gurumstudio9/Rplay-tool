const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const codeDir = path.resolve(__dirname, '..');
const settingsFile = path.resolve(codeDir, process.env.CHARACTER_MANAGER_SETTINGS_FILE || '../rplay-canvas-settings.json');
const { pickFolder } = require('./directoryPicker.cjs');

function readSettings(file = settingsFile) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON 객체가 아닙니다.');
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`개인 설정 파일을 읽지 못했습니다: ${error.message}`);
  }
}

function validateExternalDirectory(directory, codeDirectory = codeDir) {
  if (typeof directory !== 'string' || !directory.trim()) throw new Error('데이터 폴더를 선택해 주세요.');
  const resolved = fs.realpathSync(path.resolve(codeDirectory, directory));
  if (!fs.statSync(resolved).isDirectory()) throw new Error('선택한 경로가 폴더가 아닙니다.');
  const relative = path.relative(fs.realpathSync(codeDirectory), resolved);
  if (!relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))) {
    throw new Error('데이터 폴더는 관리툴 코드 폴더 밖에 있어야 합니다.');
  }
  return resolved;
}

function saveDirectorySetting(directory, file = settingsFile) {
  const settings = readSettings(file);
  if (directory === null) delete settings.dataDirectory;
  else settings.dataDirectory = validateExternalDirectory(directory);
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return settings;
}

function snapshot() {
  const paths = require('./dataPaths.cjs');
  const settings = readSettings();
  const defaultPath = path.resolve(paths.codeDir, '../data');
  return {
    currentPath: paths.dataDir,
    savedPath: typeof settings.dataDirectory === 'string' ? path.resolve(paths.codeDir, settings.dataDirectory) : defaultPath,
    defaultPath,
    source: paths.dataDirectorySource,
    canChange: paths.dataDirectorySource !== 'environment'
  };
}

function localRequest(request, url) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) return false;
  let actual;
  try { actual = new URL(`http://${request.headers.host}`); } catch { return false; }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(actual.hostname) || actual.host !== url.host) return false;
  if (request.headers.origin && request.headers.origin !== actual.origin) return false;
  return request.headers['sec-fetch-site'] !== 'cross-site';
}

let updating = false;
async function handleDataDirectoryApi(request, response, url) {
  if (!['/api/data-directory', '/api/data-directory/pick', '/api/data-directory/reset'].includes(url.pathname)) return false;
  const send = (status, value) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  if (!localRequest(request, url)) { send(403, { error: '이 컴퓨터의 관리툴에서 실행해 주세요.' }); return true; }
  if (request.method === 'GET' && url.pathname === '/api/data-directory') {
    try { send(200, snapshot()); } catch (error) { send(500, { error: error.message }); }
    return true;
  }
  if (request.method !== 'POST' || url.pathname === '/api/data-directory') { send(405, { error: '지원하지 않는 요청입니다.' }); return true; }
  if ((request.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') { send(415, { error: 'JSON 요청이 필요합니다.' }); return true; }
  const paths = require('./dataPaths.cjs');
  if (paths.dataDirectorySource === 'environment') { send(409, { error: '환경변수로 데이터 폴더가 지정되어 있습니다. 실행 환경 설정에서 변경해 주세요.' }); return true; }
  if (updating) { send(409, { error: '폴더 선택 또는 저장이 진행 중입니다.' }); return true; }
  updating = true;
  try {
    request.resume();
    if (url.pathname.endsWith('/reset')) {
      saveDirectorySetting(null);
    } else {
      const selected = await pickFolder(snapshot().savedPath, '데이터 저장 폴더 선택');
      if (!selected) { send(200, { ...snapshot(), cancelled: true }); return true; }
      saveDirectorySetting(selected);
    }
    send(200, { ...snapshot(), saved: true });
  } catch (error) { send(400, { error: error.message }); }
  finally { updating = false; }
  return true;
}

module.exports = { codeDir, settingsFile, readSettings, validateExternalDirectory, validateDirectory: validateExternalDirectory, saveDirectorySetting, saveDataDirectory: saveDirectorySetting, handleDataDirectoryApi };
