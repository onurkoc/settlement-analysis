// @ts-check
/*
Result panel: the rows of summaryRows() (app/model.js), grouped by
section.
*/

/** @typedef {import('../model.js').SummaryRow} SummaryRow */

/**
 * @param {HTMLElement} container
 * @param {SummaryRow[]} rows
 */
export function renderResults(container, rows) {
    /** @type {Map<string, SummaryRow[]>} */
    const sections = new Map();
    for (const row of rows) {
        if (row.hidden) continue;
        if (!sections.has(row.section)) sections.set(row.section, []);
        /** @type {SummaryRow[]} */ (sections.get(row.section)).push(row);
    }
    const parts = [];
    for (const [title, list] of sections) {
        const table = document.createElement('table');
        const caption = document.createElement('caption');
        caption.textContent = title;
        table.append(caption);
        for (const row of list) {
            const tr = document.createElement('tr');
            tr.dataset.key = row.key;
            const th = document.createElement('th');
            th.scope = 'row';
            th.textContent = row.label;
            const td = document.createElement('td');
            td.className = 'value';
            td.textContent = row.text;
            const unit = document.createElement('td');
            unit.className = 'unit';
            unit.textContent = row.unit === '-' ? '' : row.unit;
            if (row.level !== undefined) {
                td.classList.add('category', `cat${row.level}`);
            }
            if (row.status) {
                td.classList.add(row.status === 'ok' ? 'ok' : 'fail');
            }
            tr.append(th, td, unit);
            table.append(tr);
        }
        parts.push(table);
    }
    container.replaceChildren(...parts);
}
