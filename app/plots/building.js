// @ts-check
/*
Plot "Building position": the building as a bar; in the field mode the
field edges as thin ticks. Shares the x range with the trough plot.
*/
import { applyFrame, setGlyph, TOOLS } from './theme.js';
import { BUILDING_Y_RANGE } from './ranges.js';

/** @typedef {import('./theme.js').Theme} Theme */
/** @typedef {import('../model.js').Result} Result */

/**
 * @param {any} B  window.Bokeh
 * @param {any} xRange  shared x range
 * @param {Theme} th
 */
export function createBuildingPlot(B, xRange, th) {
    const p = B.Plotting.figure({
        title: 'Building position',
        // height as in the earlier app
        height: 100,
        sizing_mode: 'stretch_width',
        x_range: xRange,
        y_range: new B.Range1d({ start: BUILDING_Y_RANGE[0], end: BUILDING_Y_RANGE[1],
                                 reset_start: BUILDING_Y_RANGE[0], reset_end: BUILDING_Y_RANGE[1] }),
        tools: TOOLS,
        toolbar_location: 'above',
    });
    p.toolbar.logo = null;
    p.yaxis.visible = false;
    p.ygrid.visible = false;

    const bar = new B.ColumnDataSource({ data: { left: [0], right: [1] } });
    const ticks = new B.ColumnDataSource({ data: { x: [] } });
    const rBar = p.quad({ left: { field: 'left' }, right: { field: 'right' }, bottom: 0.15, top: 0.85,
                          source: bar, line_width: 1 });
    const rTicks = p.segment({ x0: { field: 'x' }, x1: { field: 'x' }, y0: 0.15, y1: 0.85,
                               source: ticks, line_width: 1 });

    /** @param {Theme} t */
    function setTheme(t) {
        applyFrame(B, p, t);
        setGlyph(rBar, { fill_color: t.building, line_color: t.building });
        rBar.glyph.fill_alpha = 0.6;
        setGlyph(rTicks, { line_color: t.bg });
    }
    setTheme(th);

    /** @param {Result} r */
    function update(r) {
        const e = r.building.edges;
        const f = r.building.fields;
        bar.data = { left: [e.xL], right: [e.xR] };
        // interior field edges, only in the field mode
        ticks.data = { x: f.mode === 'fields' ? f.xa.slice(1) : [] };
    }

    return { plot: p, update, setTheme };
}
