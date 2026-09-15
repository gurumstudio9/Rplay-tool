const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const root = process.env.GENIT_MANAGER_ROOT || path.resolve(__dirname, '../../../..');
const viteRequire = Module.createRequire(fs.realpathSync(path.join(root, 'node_modules/vite/package.json')));
const { buildSync } = viteRequire('esbuild');
const result = buildSync({
  stdin: {
    contents: 'export * from "./src/features/lorebook/platform/genitSort"; export * from "./src/features/lorebook/platform/genitSmart";',
    resolveDir: root, loader: 'ts'
  }, bundle: true, platform: 'node', format: 'cjs', write: false
});
const compiled = new Module(__filename);
compiled._compile(result.outputFiles[0].text, __filename);
const { buildGenitSortScript, buildGenitSmartSyncScript } = compiled.exports;
const data = titles => titles.map(title => ({ id: title, mapKeys: [title], title, matchTitles: [title], category: '설정', body: '', triggers: [] }));

// Execute the actual copied scripts against a page that replaces every card on
// each move, with controllable React-like update delays and failure modes.
function page(titles, options = {}) {
  const state = { titles: [...titles], alerts: [], clicks: 0, now: 0, revision: 0, pending: null };
  function flush() {
    if (state.pending && state.now >= state.pending.at) {
      const apply = state.pending.apply;
      state.pending = null;
      apply();
      state.revision++;
    }
  }
  function inputs() {
    flush();
    return state.titles.map(title => {
      const revision = state.revision;
      const input = { value: title, closest: () => card };
      const category = { querySelector: () => ({ textContent: '설정' }) };
      const card = {
        querySelectorAll: () => [],
        querySelector(selector) {
          if (selector.includes('설정집 제목')) return input;
          if (selector === 'textarea') return { value: '' };
          if (selector.includes('data-select-label')) return { closest: () => category };
          if (selector.includes('위로 이동')) {
            if (options.missing) return null;
            return {
              disabled: Boolean(options.disabled),
              click() {
                assert.equal(revision, state.revision, 'must reacquire React-replaced cards');
                assert.equal(state.pending, null, 'must wait for the previous click');
                state.clicks++;
                if (options.noop) return;
                state.pending = { at: state.now + (options.delay ?? 0), apply() {
                  if (options.mutate) { state.titles.push('외부 추가'); return; }
                  if (options.wrong) { state.titles.reverse(); return; }
                  const index = state.titles.indexOf(title);
                  [state.titles[index - 1], state.titles[index]] = [state.titles[index], state.titles[index - 1]];
                } };
              }
            };
          }
          return null;
        }
      };
      return input;
    });
  }
  const window = {};
  const tabBar = { children: [] };
  tabBar.children = ['기본', '프롬프트', '설정집', '장기 기억', '이미지', '에셋'].map(textContent => ({
    tagName: 'BUTTON', textContent, parentElement: tabBar,
    getClientRects: () => [{}], getAttribute: () => null,
    classList: { contains: name => name === 'bg-white' && textContent === '설정집' }
  }));
  const context = {
    window,
    Date: { now: () => state.now },
    setTimeout(callback, delay) {
      setImmediate(() => {
        state.now += delay;
        options.onTick?.(state);
        callback();
      });
    },
    document: { querySelectorAll(selector) {
      if (selector.includes('설정집 제목')) return inputs();
      if (selector === 'button[type="button"]') return [...tabBar.children, {
        textContent: '설정집 추가', getClientRects: () => [{}],
        click() { throw new Error('unexpected add'); }
      }];
      return [];
    } },
    localStorage: { getItem: () => JSON.stringify(options.titleMap || {}), setItem() {} },
    alert: message => state.alerts.push(message), console: { log() {} }
  };
  return { state, window, run: script => vm.runInNewContext(script, context) };
}

for (const [label, build] of [
  ['standalone', entries => buildGenitSortScript(entries, 'test')],
  ['smart sync', entries => buildGenitSmartSyncScript(entries, 500, 'test')]
]) {
  test(`${label}: reversed cards sort with delayed rerenders and minimum adjacent moves`, async () => {
    const browser = page(['D', 'C', 'B', 'A'], { delay: 96 });
    await browser.run(build(data(['A', 'B', 'C', 'D'])));
    assert.deepEqual(browser.state.titles, ['A', 'B', 'C', 'D']);
    assert.equal(browser.state.clicks, 6);
    assert.ok(browser.state.now >= 576);
    assert.match(browser.state.alerts.at(-1), /완료되었습니다/);
    assert.equal(browser.window.__characterManagerGenitSorting, undefined);
  });
  test(`${label}: ignored clicks time out without retrying or reporting success`, async () => {
    const browser = page(['B', 'A'], { noop: true });
    await browser.run(build(data(['A', 'B'])));
    assert.equal(browser.state.clicks, 1);
    assert.match(browser.state.alerts.at(-1), /이동 결과를 확인하지 못했습니다: A/);
    assert.match(browser.state.alerts.at(-1), /미정렬 2개/);
    assert.doesNotMatch(browser.state.alerts.at(-1), /완료되었습니다/);
    assert.equal(browser.window.__characterManagerGenitSorting, undefined);
  });
}

test('already sorted skips all clicks; unknown cards retain their relative order', async () => {
  const browser = page(['A', 'B', '기타2', '기타1']);
  await browser.run(buildGenitSortScript(data(['A', 'B']), 'test'));
  assert.equal(browser.state.clicks, 0);
  assert.match(browser.state.alerts[0], /이미 관리툴 순서/);
  const mixed = page(['기타2', 'B', '기타1', 'A']);
  await mixed.run(buildGenitSortScript(data(['A', 'B']), 'test'));
  assert.deepEqual(mixed.state.titles, ['A', 'B', '기타2', '기타1']);
});

for (const flag of ['disabled', 'missing', 'mutate', 'wrong']) {
  test(`stops safely on ${flag} without reporting completion`, async () => {
    const browser = page(['C', 'B', 'A'], { [flag]: true });
    await browser.run(buildGenitSortScript(data(['A', 'B', 'C']), 'test'));
    assert.match(browser.state.alerts[0], /정렬을 중단했습니다/);
    assert.doesNotMatch(browser.state.alerts[0], /완료되었습니다/);
    assert.ok(browser.state.clicks <= 1);
    assert.equal(browser.window.__characterManagerGenitSorting, undefined);
  });
}

test('duplicate normalized titles and missing editor cards fail before clicking', async () => {
  for (const titles of [['A', ' a '], []]) {
    const browser = page(titles);
    await browser.run(buildGenitSortScript(data(['A']), 'test'));
    assert.equal(browser.state.clicks, 0);
    assert.match(browser.state.alerts[0], /중복|찾을 수 없습니다/);
  }
});

test('final verification detects a change after the last move', async () => {
  const browser = page(['B', 'A'], { onTick(state) {
    if (state.now >= 32 && !state.pending) state.titles.push('외부 추가');
  } });
  await browser.run(buildGenitSortScript(data(['A', 'B']), 'test'));
  assert.match(browser.state.alerts[0], /최종 순서가/);
  assert.doesNotMatch(browser.state.alerts[0], /완료되었습니다/);
});

test('historical title aliases still identify cards', async () => {
  const browser = page(['B', '옛 제목'], { titleMap: { A: '옛 제목' } });
  await browser.run(buildGenitSortScript(data(['A', 'B']), 'test'));
  assert.deepEqual(browser.state.titles, ['옛 제목', 'B']);
});

test('overlapping sorts cannot click concurrently and release the lock on completion', async () => {
  const browser = page(['B', 'A'], { delay: 96 });
  const script = buildGenitSortScript(data(['A', 'B']), 'test');
  await Promise.all([browser.run(script), browser.run(script)]);
  assert.equal(browser.state.clicks, 1);
  assert.ok(browser.state.alerts.some(message => message.includes('이미 정렬이 진행 중')));
  assert.deepEqual(browser.state.titles, ['A', 'B']);
  assert.equal(browser.window.__characterManagerGenitSorting, undefined);
});
