const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

async function pickFolder(initialDirectory, title) {
  if (process.platform !== 'win32') throw new Error('폴더 경로를 직접 입력해 주세요.');
  const { stdout } = await promisify(execFile)('powershell.exe', [
    '-NoProfile', '-STA', '-File', path.join(__dirname, '../scripts/pick_directory.ps1')
  ], {
    windowsHide: true,
    timeout: 180000,
    env: { ...process.env, CHARACTER_MANAGER_PICKER_START: typeof initialDirectory === 'string' ? initialDirectory : '', CHARACTER_MANAGER_PICKER_TITLE: typeof title === 'string' ? title : '' }
  });
  return stdout.trim() ? Buffer.from(stdout.trim(), 'base64').toString('utf8') : null;
}

module.exports = { pickFolder };
