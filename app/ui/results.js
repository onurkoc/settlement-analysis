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
            if (row.level !== undefined) {
                // coloured label with dark text (contrast >= 4.5:1 in both themes)
                const chip = document.createElement('span');
                chip.className = `chip cat${row.level}`;
                chip.textContent = row.text;
                td.append(chip);
                td.classList.add('category');
            } else {
                td.textContent = row.text;
            }
            const unit = document.createElement('td');
            unit.className = 'unit';
            unit.textContent = row.unit === '-' ? '' : row.unit;
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
