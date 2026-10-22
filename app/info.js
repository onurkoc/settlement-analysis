// @ts-check
/*
Tab "Information": formulas with KaTeX (loaded when the tab is opened
the first time) and the table of the damage categories from
DAMAGE_LIMITS, so the table and the calculation use the same values.
*/
import { DAMAGE_LIMITS } from './core/damage.js';

/** KaTeX as ES module, stored in vendor/ (no CDN). */
const KATEX_URL = './vendor/katex-0.19.0/katex.mjs';

/**
 * Strain as percent text, e.g. 0.00075 -> "0.075 %".
 * @param {number} v
 */
function percent(v) {
    return `${Number((v * 100).toPrecision(3))} %`;
}

/**
 * Rows of the damage category table: category, name, range of the
 * limiting tensile strain, typical crack width.
 * @returns {string[][]}
 */
export function damageTableRows() {
    let lower = 0;
    return DAMAGE_LIMITS.categories.map((c) => {
        const range = Number.isFinite(c.upper)
            ? `${lower === 0 ? '0' : percent(lower).replace(' %', '')} – ${percent(c.upper)}`
            : `≥ ${percent(lower)}`;
        lower = c.upper;
        return [c.label, c.name, range, c.crack];
    });
}

/**
 * Fill the damage table.
 * @param {HTMLTableElement} table
 */
function fillDamageTable(table) {
    const body = table.tBodies[0];
    body.replaceChildren(...damageTableRows().map((cells, k) => {
        const tr = document.createElement('tr');
        cells.forEach((text, j) => {
            const td = document.createElement('td');
            if (j === 0) {
                const chip = document.createElement('span');
                chip.className = `chip cat${k}`;
                chip.textContent = text;
                td.append(chip);
            } else {
                td.textContent = text;
            }
            tr.append(td);
        });
        return tr;
    }));
}

let done = false;

/**
 * Render the tab once: formulas and table.
 * @param {HTMLElement} root
 */
export async function renderInfo(root) {
    if (done) return;
    done = true;
    const table = root.querySelector('#damage-table');
    if (table) fillDamageTable(/** @type {HTMLTableElement} */ (table));
    const url = KATEX_URL;   // not a literal: the type check does not read the library
    const katex = (await import(url)).default;
    for (const el of root.querySelectorAll('[data-tex]')) {
        const tex = /** @type {HTMLElement} */ (el).dataset.tex ?? '';
        katex.render(tex, el, { displayMode: el.classList.contains('tex'), throwOnError: true, output: 'html' });
    }
}
