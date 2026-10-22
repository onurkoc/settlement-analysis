// @ts-check
/*
Colour scheme switch (app/ui/theme.js): stored choice, fallbacks.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeTheme, readTheme, storeTheme, THEME_KEY } from '../app/ui/theme.js';

/** Map as storage. */
function memory() {
    /** @type {Map<string, string>} */
    const m = new Map();
    return {
        m,
        getItem: (/** @type {string} */ k) => (m.has(k) ? /** @type {string} */ (m.get(k)) : null),
        setItem: (/** @type {string} */ k, /** @type {string} */ v) => { m.set(k, v); },
        removeItem: (/** @type {string} */ k) => { m.delete(k); },
    };
}

test('choices: system, light, dark; anything else is system', () => {
    assert.equal(normalizeTheme('light'), 'light');
    assert.equal(normalizeTheme('dark'), 'dark');
    for (const v of ['system', null, undefined, '', 'Dark', 'blue', 1]) {
        assert.equal(normalizeTheme(v), 'system');
    }
});

test('stored in localStorage; system removes the entry', () => {
    const s = memory();
    assert.equal(readTheme(s), 'system');
    storeTheme(s, 'dark');
    assert.equal(s.m.get(THEME_KEY), 'dark');
    assert.equal(readTheme(s), 'dark');
    storeTheme(s, 'light');
    assert.equal(readTheme(s), 'light');
    storeTheme(s, 'system');
    assert.equal(s.m.has(THEME_KEY), false);
    assert.equal(readTheme(s), 'system');
});

test('blocked storage: system, no exception', () => {
    const blocked = {
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => { throw new Error('SecurityError'); },
    };
    assert.equal(readTheme(blocked), 'system');
    assert.doesNotThrow(() => storeTheme(blocked, 'dark'));
    assert.equal(readTheme(null), 'system');
    assert.equal(readTheme(undefined), 'system');
});

test('the early script uses the same key and the same values', () => {
    const init = readFileSync(new URL('../app/theme-init.js', import.meta.url), 'utf8');
    assert.ok(init.includes(`'${THEME_KEY}'`));
    assert.match(init, /choice === 'light' \|\| choice === 'dark'/);
    const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
    // before the style sheets: no flash of the other scheme
    assert.ok(html.indexOf('theme-init.js') < html.indexOf('style.css'));
    for (const v of ['system', 'light', 'dark']) assert.ok(html.includes(`name="theme" value="${v}"`), v);
    assert.match(html, /role="radiogroup" aria-label="Colour scheme"/);
});
