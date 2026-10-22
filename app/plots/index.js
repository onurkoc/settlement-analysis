// @ts-check
/*
The three plots in one Bokeh document (shared x range of the building
and trough plots), each root rendered into its own element. Separate
documents would throw "models must be owned by only a single document"
because of the shared range.

- The frame of the building plot is kept at the same horizontal
  position as the frame of the trough plot, so both x axes lie on top
  of each other (the trough plot has axes left and right whose width
  depends on the tick labels).
- Saving a plot as PNG always uses the light theme.
*/
import { createBuildingPlot } from './building.js';
import { createTroughPlot } from './trough.js';
import { createDamagePlot } from './damage.js';
import { xRange } from './ranges.js';
import { readTheme } from './theme.js';

/** @typedef {import('../model.js').Result} Result */

/**
 * @param {any} B  window.Bokeh
 * @param {{building: HTMLElement, trough: HTMLElement, damage: HTMLElement, light: HTMLElement}} el
 *     light: element with the colours of the light theme
 */
export async function createPlots(B, el) {
    const th = readTheme();
    const sharedX = new B.Range1d({ start: -50, end: 50 });
    const building = createBuildingPlot(B, sharedX, th);
    const trough = createTroughPlot(B, sharedX, th);
    const damage = createDamagePlot(B, th);
    const all = { building, trough, damage };

    for (const [name, m] of Object.entries(all)) {
        m.plot.add_tools(new B.CustomAction({
            icon: 'save',
            description: 'Save as PNG (light theme)',
            callback: () => { void exportPng(/** @type {keyof typeof all} */ (name)); },
        }));
    }

    const doc = new B.Document();
    for (const m of Object.values(all)) doc.add_root(m.plot);
    // BokehJS 3.10: the third argument is an array of elements in the
    // order of the roots (not an object keyed by id); the second one is
    // only the fallback for roots without an element
    const views = await B.embed.add_document_standalone(doc, el.trough, [el.building, el.trough, el.damage]);

    /**
     * Same left and right border for the building plot as the frame of
     * the trough plot has. Runs after every layout of the trough plot
     * (inner_width changes when the width of an axis changes).
     */
    function alignFrames() {
        const tv = views.get_one(trough.plot);
        if (!tv) return;
        const f = tv.frame.bbox;
        const left = Math.round(f.left);
        const right = Math.round(tv.bbox.width - f.right);
        if (left > 0 && right >= 0
            && (building.plot.min_border_left !== left || building.plot.min_border_right !== right)) {
            building.plot.setv({ min_border_left: left, min_border_right: right });
        }
    }
    trough.plot.properties.inner_width.change.connect(alignFrames);
    trough.plot.properties.outer_width.change.connect(alignFrames);
    alignFrames();

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
        damage.setNarrow(narrow);
    }

    function setTheme() {
        const t = readTheme();
        for (const m of Object.values(all)) m.setTheme(t);
    }

    /** two animation frames and a short pause: the plot is repainted */
    const repainted = () => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50)));
    });

    /**
     * PNG of one plot in the light theme, also in dark mode.
     * @param {keyof typeof all} name
     * @returns {Promise<Blob>}
     */
    async function pngBlob(name) {
        const m = all[name];
        const view = views.get_one(m.plot);
        m.setTheme(readTheme(el.light));
        try {
            await repainted();
            return await view.export('png').to_blob();
        } finally {
            m.setTheme(readTheme());
        }
    }

    /**
     * Save one plot as PNG file.
     * @param {keyof typeof all} name
     */
    async function exportPng(name) {
        const blob = await pngBlob(name);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `settlement_${name}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    return {
        update,
        setTheme,
        setNarrow,
        showLegacy: damage.showLegacy,
        /** views, ranges and the PNG export, for the headless checks */
        debug: { views, building, trough, damage, sharedX, pngBlob, alignFrames },
    };
}
