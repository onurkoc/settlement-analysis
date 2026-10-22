// @ts-check
/*
Settlement Analysis: state, wiring of inputs, calculation, plots and
results. BokehJS is loaded as a classic script (window.Bokeh) by
index.html and passed to the plot modules.
*/
import {
    decodeHash, encodeHash, validate, cloneState, setPath, switchTunnels, switchBuildingMode,
} from './state.js';
import { compute, summaryRows } from './model.js';
import { buildCsv } from './csv.js';
import { renderInputs } from './ui/inputs.js';
import { renderResults } from './ui/results.js';
import { createPlots } from './plots/index.js';
import { renderInfo } from './info.js';

/** @typedef {import('./state.js').State} State */
/** @typedef {import('./model.js').Result} Result */

/**
 * Element by id.
 * @param {string} id
 * @returns {HTMLElement}
 */
function $(id) {
    const e = document.getElementById(id);
    if (!e) throw new Error(`element #${id} missing`);
    return e;
}

async function main() {
    const B = /** @type {any} */ (window).Bokeh;
    if (!B || !B.Plotting) {
        throw new Error('BokehJS could not be loaded');
    }

    /** @type {State} */
    let state = decodeHash(location.hash);
    /** @type {Result | null} */
    let result = null;
    let pending = false;
    let lastHash = '';

    const inputs = renderInputs($('input-form'), {
        onValue(path, value) { change((s) => setPath(s, path, value)); },
        onCount(count) { replace(switchTunnels(state, count)); },
        onBuildingMode(mode) { replace(switchBuildingMode(state, mode)); },
        onFieldMode(mode) { change((s) => { s.fieldMode = mode; }); },
        onTied(tied) { change((s) => { s.floorsTied = tied; }); },
    });

    const plots = await createPlots(B, {
        building: $('plot-building'), trough: $('plot-trough'), damage: $('plot-damage'), light: $('theme-light'),
    });

    /** @param {(s: State) => void} fn */
    function change(fn) {
        const next = cloneState(state);
        fn(next);
        replace(next);
    }

    /** @param {State} next */
    function replace(next) {
        state = next;
        schedule();
    }

    /** Recalculate once per animation frame. */
    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            run();
        });
    }

    function run() {
        const errors = validate(state);
        inputs.sync(state, errors);
        /** @type {HTMLInputElement} */ ($('legacy')).checked = state.legacy;
        plots.showLegacy(state.legacy);
        const invalid = Object.keys(errors).length > 0;
        $('msg').hidden = !invalid;
        document.body.classList.toggle('stale', invalid);
        /** @type {HTMLButtonElement} */ ($('export-csv')).disabled = invalid;
        writeHash();
        if (invalid) return;
        result = compute(state);
        plots.update(result);
        renderResults($('results'), summaryRows(state, result));
    }

    function writeHash() {
        lastHash = '#' + encodeHash(state);
        if (location.hash !== lastHash) {
            history.replaceState(null, '', lastHash);
        }
    }

    window.addEventListener('hashchange', () => {
        if (location.hash !== lastHash) replace(decodeHash(location.hash));
    });

    $('legacy').addEventListener('change', (e) => {
        const checked = /** @type {HTMLInputElement} */ (e.target).checked;
        change((s) => { s.legacy = checked; });
    });

    $('export-csv').addEventListener('click', () => {
        if (!result) return;
        const blob = new Blob([buildCsv(state, result)], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `settlement_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    $('copy-link').addEventListener('click', async () => {
        const btn = $('copy-link');
        try {
            await navigator.clipboard.writeText(location.href);
            btn.textContent = 'Link copied';
        } catch {
            btn.textContent = 'Copy failed';
        }
        setTimeout(() => { btn.textContent = 'Copy link'; }, 1500);
    });

    // tabs
    for (const tab of document.querySelectorAll('[role="tab"]')) {
        tab.addEventListener('click', () => {
            for (const t of document.querySelectorAll('[role="tab"]')) {
                const selected = t === tab;
                t.setAttribute('aria-selected', String(selected));
                $(/** @type {string} */ (t.getAttribute('aria-controls'))).hidden = !selected;
            }
            if (tab.getAttribute('aria-controls') === 'tab-info') {
                renderInfo($('tab-info')).catch((err) => console.error(err));
            }
        });
    }

    // inputs: always open on a wide screen, folded on a phone
    const wide = matchMedia('(min-width: 900px)');
    const details = /** @type {HTMLDetailsElement} */ ($('inputs'));
    const fold = () => {
        details.open = wide.matches;
        plots.setNarrow(!matchMedia('(min-width: 600px)').matches);
    };
    wide.addEventListener('change', fold);
    fold();

    // plots follow the light/dark theme
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => plots.setTheme());

    run();
    /** for the headless checks */
    /** @type {any} */ (window).app = {
        get state() { return state; },
        get result() { return result; },
        set(/** @type {State} */ s) { replace(s); },
        plots,
        ready: true,
    };
}

main().catch((err) => {
    const box = document.getElementById('msg');
    if (box) {
        box.hidden = false;
        box.textContent = `The app could not be started: ${err.message}`;
    }
    throw err;
});
