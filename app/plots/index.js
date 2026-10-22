// @ts-check
/*
The three plots in one Bokeh document (shared x range of the building
and trough plots), each root rendered into its own element. Separate
documents would throw "models must be owned by only a single document"
because of the shared range.
*/
import { createBuildingPlot } from './building.js';
import { createTroughPlot } from './trough.js';
import { createDamagePlot } from './damage.js';
import { xRange } from './ranges.js';
import { readTheme } from './theme.js';

/** @typedef {import('../model.js').Result} Result */

/**
 * @param {any} B  window.Bokeh
 * @param {{building: HTMLElement, trough: HTMLElement, damage: HTMLElement}} el
 */
export async function createPlots(B, el) {
    const th = readTheme();
    const sharedX = new B.Range1d({ start: -50, end: 50 });
    const building = createBuildingPlot(B, sharedX, th);
    const trough = createTroughPlot(B, sharedX, th);
    const damage = createDamagePlot(B, th);

    const doc = new B.Document();
    for (const p of [building.plot, trough.plot, damage.plot]) doc.add_root(p);
    // BokehJS 3.10: the third argument is an array of elements in the
    // order of the roots (not an object keyed by id); the second one is
    // only the fallback for roots without an element
    const views = await B.embed.add_document_standalone(doc, el.trough, [el.building, el.trough, el.damage]);

    /** @param {Result} r */
    function update(r) {
        const [a, b] = xRange(r);
        sharedX.setv({ start: a, end: b, reset_start: a, reset_end: b });
        building.update(r);
        trough.update(r);
        damage.update(r);
    }

    /** @param {boolean} narrow */
    function setNarrow(narrow) {
        trough.setNarrow(narrow);
    }

    function setTheme() {
        const t = readTheme();
        building.setTheme(t);
        trough.setTheme(t);
        damage.setTheme(t);
    }

    return {
        update,
        setTheme,
        setNarrow,
        showLegacy: damage.showLegacy,
        /** views and ranges, for the headless checks */
        debug: { views, building, trough, damage, sharedX },
    };
}
