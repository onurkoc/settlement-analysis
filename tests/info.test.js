// @ts-check
/*
Tab "Information" (app/info.js, app/index.html).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { damageTableRows } from '../app/info.js';

const HTML = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

test('damage table from DAMAGE_LIMITS', () => {
    assert.deepEqual(damageTableRows(), [
        ['0', 'Negligible', '0 – 0.05 %', '< 0.1 mm'],
        ['1', 'Very slight', '0.05 – 0.075 %', '< 1 mm'],
        ['2', 'Slight', '0.075 – 0.15 %', '1–5 mm'],
        ['3', 'Moderate', '0.15 – 0.3 %', '5–15 mm'],
        ['4–5', 'Severe to very severe', '≥ 0.3 %', '> 15 mm'],
    ]);
});

test('index.html: scripts, styles and images only from the own site', () => {
    for (const m of HTML.matchAll(/\b(src|href)="([^"]*)"/g)) {
        const [, attr, url] = m;
        if (attr === 'href' && url === 'https://apps.onurkoc.net') continue;   // link, not a resource
        assert.ok(!/^(https?:)?\/\//.test(url), `${attr}="${url}"`);
    }
});

test('index.html: all sources of the information tab, no e-mail address', () => {
    for (const name of ['Peck', "O'Reilly", 'Rankin', 'Boscardin', 'Burland', 'Mair', 'Franzius', 'Cording']) {
        assert.ok(HTML.includes(name), name);
    }
    assert.ok(!/mailto:/i.test(HTML), 'no e-mail address');
    assert.match(HTML, /does not replace a project-specific assessment/);
});
