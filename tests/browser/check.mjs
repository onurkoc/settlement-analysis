// Headless check of the app in Microsoft Edge (Chrome DevTools Protocol).
// Not part of "npm test" (needs Edge and Python); run with
//
//     node tests/browser/check.mjs [--edge <path to msedge.exe>] [--python <path>]
//
// It starts serve.py on a free port, opens the app and checks: no console
// errors, no requests to other hosts, zero of both y axes aligned after
// input changes and zoom, result panel equal to assessBuilding() for the
// default with one and two tunnels, invalid input, URL hash. Screenshots
// go to docs/screenshots/web/.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = join(ROOT, 'docs', 'screenshots', 'web');
const arg = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : fallback;
};
const EDGE = arg('--edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const PYTHON = arg('--python', 'C:/ProgramData/anaconda3/python.exe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** free TCP port */
function freePort() {
    return new Promise((resolve) => {
        const s = createServer();
        s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    });
}

let failures = 0;
let frameStalls = 0;
function check(name, ok, info) {
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info === undefined ? '' : ' – ' + (typeof info === 'string' ? info : JSON.stringify(info))}`);
}

const appPort = await freePort();
const cdpPort = await freePort();
const profile = mkdtempSync(join(tmpdir(), 'settlement-edge-'));
const server = spawn(PYTHON, [join(ROOT, 'serve.py'), '--no-browser', '--port', String(appPort)], { stdio: 'ignore' });
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const ORIGIN = `http://127.0.0.1:${appPort}`;

let ws;
try {
    let tabs = [];
    for (let i = 0; i < 100 && !tabs.some((t) => t.type === 'page'); i++) {
        try { tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json(); } catch { /* not yet */ }
        await sleep(100);
    }
    ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0;
    const pending = new Map();
    const errors = [];
    const requests = [];
    const failed = [];
    ws.addEventListener('message', (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(m.params.type)) {
            errors.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
        }
        if (m.method === 'Runtime.exceptionThrown') {
            errors.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
        }
        if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
            errors.push(`log: ${m.params.entry.text} ${m.params.entry.url ?? ''}`);
        }
        if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
        if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
            failed.push(`${m.params.response.status} ${m.params.response.url}`);
        }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const i = ++id;
        const timer = setTimeout(() => {
            pending.delete(i);
            reject(new Error(`no answer to ${method} within 20 s`));
        }, 20000);
        pending.set(i, (m) => { clearTimeout(timer); resolve(m); });
        ws.send(JSON.stringify({ id: i, method, params }));
    });
    const evaluate = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails) throw new Error(`${expression.slice(0, 80)}: ${r.result.exceptionDetails.exception?.description}`);
        return r.result?.result?.value;
    };
    const viewport = async (width, height, mobile) => {
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
        await send('Page.bringToFront');
    };
    const settle = async () => {
        // two frames, but at most 1 s: a headless tab may skip frames
        const how = await evaluate(`new Promise((r) => {
            setTimeout(() => r('timeout'), 1000);
            requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r('frames'), 150)));
        })`);
        if (how !== 'frames') frameStalls++;
    };
    /** full page screenshot */
    const shot = async (name, width, height, mobile) => {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
        const h = await evaluate('Math.ceil(document.documentElement.scrollHeight)');
        await viewport(width, Math.max(height, h), mobile);
        await settle();
        await sleep(300);
        const r = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.result.data, 'base64'));
        await viewport(width, height, mobile);
        await settle();
        console.log(`     screenshot ${name}.png`);
    };

    // page-side helpers: compare the panel with a fresh calculation
    const PANEL_CHECK = `(async () => {
        const model = await import('./model.js');
        const core = await import('./core/building.js');
        const s = window.app.state;
        const r = model.compute(s);
        const rows = model.summaryRows(s, r);
        const diffs = [];
        for (const row of rows) {
            if (row.hidden) continue;
            const td = document.querySelector('tr[data-key="' + row.key + '"] td.value');
            if (!td || td.textContent !== row.text) diffs.push(row.key + ': ' + (td && td.textContent) + ' != ' + row.text);
        }
        const tunnels = model.coreTunnels(s);
        const b = s.buildingMode === 'centre' ? { center: s.center, L: s.L } : { xL: s.xL, xR: s.xR };
        const fresh = core.assessBuilding(tunnels, b, { dx: s.dx,
            fieldWidth: s.fieldMode === 'pointwise' ? 'pointwise' : s.b, fL: s.floorsTied ? 0 : s.fL });
        const same = JSON.stringify(fresh) === JSON.stringify(window.app.result.building);
        return { diffs, same, rows: rows.filter((q) => !q.hidden).length,
                 gov: fresh.governing, cat: fresh.category.label + ' ' + fresh.category.name };
    })()`;
    const ZERO = `(() => {
        const v = window.app.plots.debug.views.get_one(window.app.plots.debug.trough.plot);
        const f = v.frame;
        const a = f.y_scale.compute(0), b = f.y_scales.get('depth').compute(0);
        return { left: a, right: b, ok: Math.abs(a - b) < 1e-6 };
    })()`;
    // screen position of x = xL and x = xR in the building and trough plots
    const ALIGN = `(() => {
        const d = window.app.plots.debug;
        const e = window.app.result.building.edges;
        const px = (plot, x) => {
            const v = d.views.get_one(plot);
            return v.el.getBoundingClientRect().left + v.frame.x_scale.compute(x);
        };
        // building edges and the middle of the visible range (on screen after a zoom)
        const mid = (d.sharedX.start + d.sharedX.end) / 2;
        const res = [e.xL, e.xR, mid].map((x) => [px(d.building.plot, x), px(d.trough.plot, x)]);
        return { px: res.map((q) => q.map((v) => Math.round(v * 10) / 10)),
                 ok: res.every(([a, b]) => Math.abs(a - b) <= 1) };
    })()`;
    const checkAlign = async (label) => {
        await sleep(200);
        const a = await evaluate(ALIGN);
        check(`x axes aligned (xL, xR within 1 px): ${label}`, a.ok, a.px);
    };
    // contrast of the category label (WCAG): text on its background
    const CONTRAST = `(() => {
        const chip = document.querySelector('tr[data-key="category"] .chip');
        const cs = getComputedStyle(chip);
        const rgb = (c) => c.match(/[0-9.]+/g).slice(0, 3).map(Number);
        const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const a = lum(cs.color), b = lum(cs.backgroundColor);
        return Math.round((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * 100) / 100;
    })()`;
    const setHash = async (hash) => {
        await evaluate(`location.hash = ${JSON.stringify(hash)}`);
        await settle();
    };

    await send('Runtime.enable');
    await send('Log.enable');
    await send('Network.enable');
    await send('Page.enable');
    // keep the tab visible: a hidden headless tab renders no frames and
    // delivers media query events only when it becomes visible again
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Page.bringToFront');
    mkdirSync(SHOTS, { recursive: true });

    // ---- desktop, one tunnel (default) ---------------------------------
    await viewport(1366, 900, false);
    await send('Page.navigate', { url: `${ORIGIN}/` });
    for (let i = 0; i < 100 && !(await evaluate('Boolean(window.app && window.app.ready)')); i++) await sleep(100);
    await settle();
    check('app started', await evaluate('Boolean(window.app && window.app.result)'));
    check('each plot in its own element', await evaluate(`['plot-building', 'plot-trough', 'plot-damage'].every((id) => document.getElementById(id).querySelectorAll(':scope > .bk-Figure').length === 1)`),
          await evaluate(`['plot-building', 'plot-trough', 'plot-damage'].map((id) => [...document.getElementById(id).children].map((c) => c.tagName + '.' + c.className))`));
    check('hash written for the default',
          (await evaluate('location.hash')) === '#n=1&t1=0,30,10,1,0.35&bm=c&b=0,20&fw=p&fl=1&dx=0.1');
    let panel = await evaluate(PANEL_CHECK);
    check('panel = assessBuilding(), 1 tunnel', panel.diffs.length === 0 && panel.same,
          { diffs: panel.diffs, rows: panel.rows, cat: panel.cat, epsP: panel.gov.epsP });
    check('zero of both y axes aligned, 1 tunnel', (await evaluate(ZERO)).ok, await evaluate(ZERO));
    check('mode shown', (await evaluate(`document.querySelector('tr[data-key="mode"] td.value').textContent`)) ===
          'Pointwise (b = Δx = 0.1 m)');
    // hover on the trough
    const rect = await evaluate(`(() => { const r = document.getElementById('plot-trough').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
    for (let k = 0; k < 6; k++) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + rect.w * 0.58 + k, y: rect.y + rect.h * 0.55 });
        await sleep(40);
    }
    await sleep(300);
    const tip = await evaluate(`(() => { const out = []; const walk = (n) => { if (n.shadowRoot) walk(n.shadowRoot); for (const c of n.children ?? []) walk(c); if (n.classList && [...n.classList].some((c) => /tooltip/i.test(c)) && n.offsetParent !== null) out.push(n.textContent); }; walk(document.body); return out.join(' | '); })()`);
    check('hover shows x, S, slope, Sh, ε_h', /x.*S.*Slope.*1\/\d+.*Sh.*ε_h/s.test(tip), tip.replace(/\s+/g, ' ').slice(0, 160));
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    await checkAlign('desktop, 1 tunnel');
    check('pointwise: governing field as line in its category colour',
          await evaluate(`(() => { const d = window.app.plots.debug.trough; const p = d.plot; const spans = p.center.filter((m) => m.type === 'Span' && m.line_width === 2.5); const box = p.center.find((m) => m.type === 'BoxAnnotation' && m.fill_alpha === 0.25); const cat = getComputedStyle(document.documentElement).getPropertyValue('--cat' + window.app.result.building.category.level).trim(); return spans.length === 1 && spans[0].visible && spans[0].line_color === cat && !box.visible; })()`));
    check('governing marker fully inside the damage plot', await evaluate(`(() => { const d = window.app.plots.debug.damage.plot; const g = window.app.result.building.governing; return d.y_range.start < 0 && d.x_range.start < 0 && g.epsLEff * 1000 >= 0; })()`));
    const c1 = await evaluate(CONTRAST);
    check('category label contrast >= 4.5 (light)', c1 >= 4.5, c1);
    await shot('desktop_1tunnel', 1366, 900, false);

    // ---- input change through the form: H of tunnel 1 = 22 -------------
    await evaluate(`(() => { const e = document.getElementById('in-tunnels-0-H'); e.focus(); e.value = '22'; e.dispatchEvent(new Event('input', { bubbles: true })); e.blur(); })()`);
    await settle();
    check('typed H = 22 reaches the state', (await evaluate('window.app.state.tunnels[0].H')) === 22);
    check('zero aligned after input change', (await evaluate(ZERO)).ok, await evaluate(ZERO));
    panel = await evaluate(PANEL_CHECK);
    check('panel = assessBuilding() after input change', panel.diffs.length === 0 && panel.same, panel.diffs);

    // ---- zoom: wheel and box zoom on the trough plot --------------------
    await evaluate(`(() => { const p = window.app.plots.debug.trough.plot; p.toolbar.active_scroll = p.toolbar.tools.find((t) => t.type === 'WheelZoomTool'); })()`);
    for (let k = 0; k < 3; k++) {
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: rect.x + rect.w * 0.7, y: rect.y + rect.h * 0.35, deltaX: 0, deltaY: -240 });
        await sleep(200);
    }
    const yAfterWheel = await evaluate('[window.app.plots.debug.trough.yRange.start, window.app.plots.debug.trough.yRange.end]');
    check('zero aligned after wheel zoom', (await evaluate(ZERO)).ok, { ...(await evaluate(ZERO)), y: yAfterWheel });
    await evaluate(`(() => { const p = window.app.plots.debug.trough.plot; p.toolbar.active_drag = p.toolbar.tools.find((t) => t.type === 'BoxZoomTool'); })()`);
    const bx = rect.x + rect.w * 0.4, by = rect.y + rect.h * 0.4;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bx, y: by, button: 'left', clickCount: 1 });
    for (let k = 1; k <= 10; k++) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bx + 14 * k, y: by + 9 * k, button: 'left', buttons: 1 });
        await sleep(20);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bx + 140, y: by + 90, button: 'left', clickCount: 1 });
    await sleep(300);
    const yAfterBox = await evaluate('[window.app.plots.debug.trough.yRange.start, window.app.plots.debug.trough.yRange.end]');
    check('zero aligned after box zoom', (await evaluate(ZERO)).ok && yAfterBox[0] !== yAfterWheel[0],
          { ...(await evaluate(ZERO)), y: yAfterBox });

    // pan: the shared x range moves both plots
    await evaluate(`(() => { const p = window.app.plots.debug.trough.plot; p.toolbar.active_drag = p.toolbar.tools.find((t) => t.type === 'PanTool'); })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.3, button: 'left', clickCount: 1 });
    for (let k = 1; k <= 10; k++) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + rect.w * 0.5 - 12 * k, y: rect.y + rect.h * 0.3 + 3 * k, button: 'left', buttons: 1 });
        await sleep(20);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x + rect.w * 0.5 - 120, y: rect.y + rect.h * 0.3 + 30, button: 'left', clickCount: 1 });
    await checkAlign('after wheel zoom, box zoom and pan');

    // ---- two tunnels through the form ---------------------------------
    await setHash('#n=1&t1=0,30,10,1,0.35&bm=c&b=0,20&fw=p&fl=1&dx=0.1');
    await evaluate(`document.querySelector('input[name="count"][value="2"]').click()`);
    await settle();
    check('switch to 2 tunnels: ±6.75 m', JSON.stringify(await evaluate('window.app.state.tunnels.map((t) => t.x)')) === '[-6.75,6.75]');
    panel = await evaluate(PANEL_CHECK);
    check('panel = assessBuilding(), 2 tunnels', panel.diffs.length === 0 && panel.same,
          { diffs: panel.diffs, cat: panel.cat, epsP: panel.gov.epsP });
    check('zero aligned, 2 tunnels', (await evaluate(ZERO)).ok, await evaluate(ZERO));
    await shot('desktop_2tunnels', 1366, 900, false);

    // derived glyphs (drawn while the hover inspects the source) carry the theme colours
    const glyphColors = await evaluate(`(() => {
        const out = [];
        for (const p of [window.app.plots.debug.trough.plot, window.app.plots.debug.damage.plot]) {
            for (const r of p.renderers) {
                if (!r.glyph || !('line_color' in r.glyph)) continue;
                for (const k of ['selection_glyph', 'nonselection_glyph', 'muted_glyph']) {
                    const g = r[k];
                    if (g && typeof g === 'object' && JSON.stringify(g.line_color) !== JSON.stringify(r.glyph.line_color)) {
                        out.push(r.glyph.type + '.' + k);
                    }
                }
            }
        }
        return out;
    })()`);
    check('derived glyphs have the theme colours', glyphColors.length === 0, glyphColors);
    // comma typed as decimal separator
    await evaluate(`(() => { const e = document.getElementById('in-tunnels-0-K'); e.focus(); e.value = '0,4'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); })()`);
    await settle();
    check('"0,4" typed: K = 0.4, shown as 0.4', (await evaluate('window.app.state.tunnels[0].K')) === 0.4 &&
          (await evaluate(`document.getElementById('in-tunnels-0-K').value`)) === '0.4');

    // ---- fields b = 5 m, one tunnel --------------------------------------
    await setHash('#n=1&t1=0,30,10,1,0.35&bm=c&b=0,20&fw=5&fl=1&dx=0.1');
    check('field mode from the hash', (await evaluate(`document.querySelector('tr[data-key="mode"] td.value').textContent`)) ===
          'Fields, b_eff = 5.00 m, n = 4');
    panel = await evaluate(PANEL_CHECK);
    check('panel = assessBuilding(), fields b = 5 m', panel.diffs.length === 0 && panel.same, { cat: panel.cat });
    check('field ticks in the building plot', (await evaluate('window.app.plots.debug.building.plot.renderers[1].data_source.data.x.length')) === 3);
    await shot('desktop_fields_b5', 1366, 900, false);

    // ---- legacy curves ---------------------------------------------------
    await evaluate(`document.getElementById('legacy').click()`);
    await settle();
    check('legacy curves on, in the hash', (await evaluate('location.hash')).includes('leg=1'));
    await evaluate(`document.getElementById('legacy').click()`);
    await settle();

    // ---- invalid input -----------------------------------------------------
    const before = await evaluate('window.app.result.building.governing.epsP');
    await evaluate(`(() => { const e = document.getElementById('in-tunnels-0-K'); e.focus(); e.value = '-1'; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await settle();
    check('invalid K: message, field marked, CSV disabled, not calculated',
          (await evaluate(`!document.getElementById('msg').hidden && document.getElementById('in-tunnels-0-K').closest('.field').classList.contains('invalid') && document.getElementById('export-csv').disabled`)) &&
          (await evaluate('window.app.result.building.governing.epsP')) === before);
    await evaluate(`(() => { const e = document.getElementById('in-tunnels-0-K'); e.value = '0.35'; e.dispatchEvent(new Event('input', { bubbles: true })); e.blur(); })()`);
    await settle();
    check('valid again', await evaluate(`document.getElementById('msg').hidden`));

    // ---- hash: reload restores the state ---------------------------------
    const hash = '#n=2&t1=-7,28,9.5,1.2,0.4&t2=8,33,10,0.8,0.5&bm=e&b=-4,21&fw=3&tied=1&dx=0.05';
    await send('Page.navigate', { url: `${ORIGIN}/${hash}` });
    for (let i = 0; i < 100 && !(await evaluate('Boolean(window.app && window.app.result)')); i++) await sleep(100);
    await settle();
    check('state from a shared link', (await evaluate('location.hash')) === hash &&
          (await evaluate('window.app.state.tunnels[1].H')) === 33 && (await evaluate('window.app.state.floorsTied')));
    panel = await evaluate(PANEL_CHECK);
    check('panel = assessBuilding() for the shared link', panel.diffs.length === 0 && panel.same, panel.diffs);

    // ---- phone ---------------------------------------------------------------
    await send('Page.navigate', { url: `${ORIGIN}/` });
    await viewport(390, 844, true);
    for (let i = 0; i < 100 && !(await evaluate('Boolean(window.app && window.app.result)')); i++) await sleep(100);
    await settle();
    await sleep(400);
    check('phone: inputs folded', !(await evaluate(`document.getElementById('inputs').open`)));
    check('phone: no horizontal scrolling', await evaluate('document.documentElement.scrollWidth <= innerWidth'),
          await evaluate('[document.documentElement.scrollWidth, innerWidth]'));
    check('phone: zero aligned', (await evaluate(ZERO)).ok);
    await checkAlign('phone');
    await shot('phone_1tunnel', 390, 844, true);
    await evaluate(`document.querySelector('#inputs > summary').click()`);
    await settle();
    check('phone: inputs open, no horizontal scrolling',
          (await evaluate(`document.getElementById('inputs').open`)) && (await evaluate('document.documentElement.scrollWidth <= innerWidth')));
    await shot('phone_inputs_open', 390, 844, true);

    // ---- tab Information -------------------------------------------------
    const INFO = `(async () => {
        await document.fonts.ready;
        const tex = document.querySelectorAll('#tab-info [data-tex]').length;
        const rendered = document.querySelectorAll('#tab-info [data-tex] .katex').length;
        const errors = document.querySelectorAll('#tab-info .katex-error').length;
        const rows = document.querySelectorAll('#damage-table tbody tr').length;
        const kafont = [...document.fonts].some((f) => f.family.includes('KaTeX') && f.status === 'loaded');
        const calcHidden = document.getElementById('tab-calc').offsetParent === null;
        return { tex, rendered, errors, rows, kafont, calcHidden, scroll: document.documentElement.scrollWidth <= innerWidth };
    })()`;
    await evaluate(`document.getElementById('tab-btn-info').click()`);
    await sleep(800);
    let info = await evaluate(INFO);
    check('information: formulas rendered, table filled, KaTeX fonts loaded (phone)',
          info.calcHidden && info.tex > 20 && info.rendered === info.tex && info.errors === 0 && info.rows === 5 && info.kafont && info.scroll, info);
    await shot('info_phone', 390, 844, true);
    await viewport(1366, 900, false);
    await settle();
    info = await evaluate(INFO);
    check('information: desktop', info.calcHidden && info.rendered === info.tex && info.scroll, info);
    await shot('info_desktop', 1366, 900, false);
    await evaluate(`document.getElementById('tab-btn-calc').click()`);
    await settle();

    // ---- dark theme ------------------------------------------------------------
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await viewport(1366, 900, false);
    await settle();
    check('dark theme reaches the plots', (await evaluate('window.app.plots.debug.trough.plot.background_fill_color')) ===
          (await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()`)));
    await checkAlign('desktop, dark');
    const c2 = await evaluate(CONTRAST);
    check('category label contrast >= 4.5 (dark)', c2 >= 4.5, c2);
    // PNG export in the light theme, the plot back in the dark theme afterwards
    const png = await evaluate(`(async () => {
        const blob = await window.app.plots.debug.pngBlob('trough');
        const img = await createImageBitmap(blob);
        const c = new OffscreenCanvas(img.width, img.height);
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const px = Array.from(g.getImageData(3, 3, 1, 1).data);
        return { px, w: img.width, after: window.app.plots.debug.trough.plot.background_fill_color };
    })()`);
    check('PNG export in the light theme, also in dark mode', png.px[0] > 240 && png.px[1] > 240 && png.px[2] > 240 &&
          png.after === (await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()`)), png);
    await shot('desktop_dark', 1366, 900, false);

    // ---- console and requests ------------------------------------------------
    const foreign = requests.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:'));
    check('no requests to other hosts', foreign.length === 0, foreign);
    const fonts = requests.filter((u) => u.includes('/katex-0.19.0/fonts/'));
    check('KaTeX fonts: only .woff2 requested', fonts.length > 0 && fonts.every((u) => u.endsWith('.woff2')), fonts.length);
    const missing = failed.filter((u) => !/favicon\.ico/.test(u));
    check('no request answered with an error (404 ...)', missing.length === 0, missing);
    // the server answers /favicon.ico with 404 only if the page asks for it
    const real = errors.filter((e) => !/favicon\.ico/.test(e));
    check('console without errors', real.length === 0, real);
} catch (err) {
    failures++;
    console.log('FAIL exception –', err.stack ?? err);
} finally {
    ws?.close();
    edge.kill();
    server.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* still locked */ }
}
console.log(`frame stalls: ${frameStalls}`);
console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
