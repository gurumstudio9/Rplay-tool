const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const viteRequire = Module.createRequire(fs.realpathSync(path.resolve(__dirname, '../../../node_modules/vite/package.json')));
const { transformSync } = viteRequire('esbuild');
const result = transformSync(fs.readFileSync(path.join(__dirname, 'logWorkerRegistry.ts'), 'utf8'), { loader: 'ts', format: 'cjs' });
const compiled = new Module(__filename);
compiled._compile(result.code, __filename);
const { readWorkerRegistry, readWorkSelection, getRegisteredWorkerHosts, filterLogsByWorks, LOG_WORKER_REGISTRY_STORAGE_KEY, LOG_WORK_SELECTION_STORAGE_KEY } = compiled.exports;
const storage = (values) => ({ getItem: (key) => values[key] ?? null });

test('legacy hosts retain all valid entries in the unassigned group', () => {
  const registry = readWorkerRegistry(storage({ 'cloudflare-log-worker-hosts': 'https://A.example.com/?x=1\nb.example.com\na.example.com/?' }));
  assert.deepEqual(registry, { '': 'a.example.com/?\nb.example.com/?' });
});

test('explicitly empty new registry does not revive legacy hosts', () => {
  assert.deepEqual(readWorkerRegistry(storage({ [LOG_WORKER_REGISTRY_STORAGE_KEY]: '{}', 'cloudflare-log-worker-hosts': 'old.example.com' })), {});
});

test('saved works remain separate after reload, including an empty work', () => {
  const registry = { first: 'a.example.com/?', second: 'b.example.com/?', empty: '' };
  assert.deepEqual(readWorkerRegistry(storage({ [LOG_WORKER_REGISTRY_STORAGE_KEY]: JSON.stringify(registry) })), registry);
});

test('unreadable registry falls back to old patterns without losing them', () => {
  assert.deepEqual(readWorkerRegistry(storage({ [LOG_WORKER_REGISTRY_STORAGE_KEY]: '{broken', 'cloudflare-log-filter-patterns': 'old.example.com/?' })), { '': 'old.example.com/?' });
});

const registry = { first: 'a.example.com/?\nshared.example.com/?', second: 'b.example.com/?\nshared.example.com/?', empty: '', '': 'old.example.com/?' };
const logs = ['a.example.com', 'b.example.com', 'shared.example.com', 'other.example.com', 'old.example.com'].map((targetHostname, id) => ({ targetHostname, id }));

test('one checked work excludes other works and unassigned hosts', () => {
  assert.deepEqual(filterLogsByWorks(logs, registry, ['first']).map((log) => log.id), [0, 2]);
});

test('multiple checked works combine their hosts without duplicating shared requests', () => {
  assert.deepEqual(filterLogsByWorks(logs, registry, ['first', 'second']).map((log) => log.id), [0, 1, 2]);
  assert.equal(getRegisteredWorkerHosts(registry, ['first', 'second']).size, 3);
});

test('all logs, no selection and an unregistered work have distinct results', () => {
  assert.equal(filterLogsByWorks(logs, registry, null), logs);
  assert.deepEqual(filterLogsByWorks(logs, registry, []), []);
  assert.deepEqual(filterLogsByWorks(logs, registry, ['empty']), []);
  assert.deepEqual(filterLogsByWorks(logs, registry, ['deleted']), []);
});

test('work selection restores multiple works and preserves explicit deselection', () => {
  assert.deepEqual(readWorkSelection(storage({ [LOG_WORK_SELECTION_STORAGE_KEY]: '["first","second"]' })), ['first', 'second']);
  assert.deepEqual(readWorkSelection(storage({ [LOG_WORK_SELECTION_STORAGE_KEY]: '[]' })), []);
  assert.equal(readWorkSelection(storage({})), null);
  assert.equal(readWorkSelection(storage({ [LOG_WORK_SELECTION_STORAGE_KEY]: 'bad' })), null);
});
