// @ts-check
/*
Plot "Settlement trough": settlement and horizontal displacement [mm]
on the left axis (settlement drawn downwards), tunnels on the right
axis (depth [m]); y = 0 of both axes at the same height.
*/
import { applyFrame, setGlyph, TOOLS } from './theme.js';
import { troughRanges } from './ranges.js';
import { formatSlopeN, slopeToN } from '../core/units.js';

/** @typedef {import('./theme.js').Theme} Theme */
/** @typedef {import('../model.js').Result} Result */

/**
 * @param {any} B  window.Bokeh
 * @param {any} xRange  shared x range
 * @param {Theme} th
 */
export function createTroughPlot(B, xRange, th) {
    const yRange = new B.Range1d({ start: -40, end: 5 });
    const depthRange = new B.Range1d({ start: -40, end: 5 });
    const p = B.Plotting.figure({
        title: 'Settlement trough',
        height: 420,
        sizing_mode: 'stretch_width',
        x_range: xRange,
        y_range: yRange,
        extra_y_ranges: { depth: depthRange },
        tools: TOOLS,
        toolbar_location: 'above',
        x_axis_label: 'x [m]',
        y_axis_label: 'Settlement S, displacement Sh [mm]',
    });
    p.toolbar.logo = null;
    p.add_layout(new B.LinearAxis({ y_range_name: 'depth', axis_label: 'Depth [m]' }), 'right');

    const curves = new B.ColumnDataSource({ data: { x: [], S: [], Sabs: [], S1: [], S2: [], Sh: [], eh: [], n: [] } });
    const tunnels = new B.ColumnDataSource({ data: { x: [], y: [], r: [] } });
    const inflections = new B.ColumnDataSource({ data: { x: [], y: [] } });

    const axisX = new B.Span({ location: 0, dimension: 'height', line_width: 1 });
    const axisY = new B.Span({ location: 0, dimension: 'width', line_width: 1 });
    const tunnelAxes = [0, 1].map(() => new B.Span({ location: 0, dimension: 'height', line_width: 1, line_dash: [2, 4] }));
    const edges = [0, 1].map(() => new B.Span({ location: 0, dimension: 'height', line_width: 2, line_dash: [6, 4] }));
    // governing field: area in the field mode, a line at its centre if
    // pointwise (the area would be only Δx wide); colour of its category
    const governing = new B.BoxAnnotation({ left: 0, right: 1, fill_alpha: 0.25, line_alpha: 0.9, line_width: 1 });
    const governingLine = new B.Span({ location: 0, dimension: 'height', line_width: 2.5, visible: false });
    for (const m of [axisX, axisY, ...tunnelAxes, ...edges, governing, governingLine]) p.add_layout(m);

    const rT1 = p.line({ field: 'x' }, { field: 'S1' }, { source: curves, line_width: 1.5, line_dash: [4, 3] });
    const rT2 = p.line({ field: 'x' }, { field: 'S2' }, { source: curves, line_width: 1.5, line_dash: [4, 3] });
    const rS = p.line({ field: 'x' }, { field: 'S' }, { source: curves, line_width: 2.5 });
    const rSh = p.line({ field: 'x' }, { field: 'Sh' }, { source: curves, line_width: 2 });
    // tunnel as a circle with the radius D/2 measured on the x axis, as in
    // the earlier app: round on the screen, crown and invert only
    // approximately at their depth (the depth range keeps it inside)
    const rC = p.circle({ x: { field: 'x' }, y: { field: 'y' }, radius: { field: 'r' }, radius_dimension: 'x',
                          source: tunnels, y_range_name: 'depth', fill_alpha: 0.35, line_width: 1.5 });
    const rI = p.scatter({ x: { field: 'x' }, y: { field: 'y' }, source: inflections, size: 8, marker: 'circle',
                           line_width: 1.5 });

    const items = {
        t1: new B.LegendItem({ label: 'Tunnel 1', renderers: [rT1] }),
        t2: new B.LegendItem({ label: 'Tunnel 2', renderers: [rT2] }),
        s: new B.LegendItem({ label: 'Settlement', renderers: [rS] }),
        sh: new B.LegendItem({ label: 'Horizontal displacement', renderers: [rSh] }),
        i: new B.LegendItem({ label: 'Inflection points x ± i', renderers: [rI] }),
    };
    // below the plot: inside it would cover the tunnels on a narrow screen
    const legend = new B.Legend({ items: Object.values(items), orientation: 'horizontal', click_policy: 'hide',
                                  location: 'center', ncols: 5 });
    p.add_layout(legend, 'below');

    p.add_tools(new B.HoverTool({
        renderers: [rS],
        mode: 'vline',
        tooltips: [
            ['x', '@x{0.00} m'],
            ['S', '@Sabs{0.00} mm'],
            ['Slope', '@n'],
            ['Sh', '@Sh{0.00} mm'],
            ['ε_h', '@eh{0.000} ×10⁻³'],
        ],
    }));

    let theme = th;
    let level = 0;

    /** colour of the category of the governing field */
    function governingColour() {
        governing.setv({ fill_color: theme.cats[level], line_color: theme.cats[level] });
        governingLine.line_color = theme.cats[level];
    }

    /** @param {Theme} t */
    function setTheme(t) {
        theme = t;
        applyFrame(B, p, t);
        axisX.line_color = t.line;
        axisY.line_color = t.line;
        tunnelAxes.forEach((s) => { s.line_color = t.muted; });
        edges.forEach((s) => { s.line_color = t.building; });
        governingColour();
        setGlyph(rT1, { line_color: t.tunnel1 });
        setGlyph(rT2, { line_color: t.tunnel2 });
        setGlyph(rS, { line_color: t.accent });
        setGlyph(rSh, { line_color: t.sh });
        setGlyph(rC, { fill_color: t.tunnelFill, line_color: t.muted });
        setGlyph(rI, { fill_color: t.bg, line_color: t.accent });
    }
    setTheme(th);

    /** @param {Result} r */
    function update(r) {
        const t = r.trough;
        const two = r.tunnels.length === 2;
        curves.data = {
            x: t.x,
            S: t.S.map((v) => -v * 1000),
            Sabs: t.S.map((v) => v * 1000),
            S1: t.Sj[0].map((v) => -v * 1000),
            S2: two ? t.Sj[1].map((v) => -v * 1000) : t.x.map(() => NaN),
            Sh: t.Sh.map((v) => v * 1000),
            eh: t.eh.map((v) => v * 1000),
            n: t.dS.map((d) => formatSlopeN(slopeToN(d))),
        };
        tunnels.data = {
            x: r.tunnels.map((u) => u.x),
            y: r.tunnels.map((u) => -u.H),
            r: r.tunnels.map((u) => u.D / 2),
        };
        inflections.data = {
            x: r.inflections.map((q) => q.x),
            y: r.inflections.map((q) => -q.S * 1000),
        };
        rT1.visible = two;
        rT2.visible = two;
        items.t1.visible = two;
        items.t2.visible = two;
        items.s.label = { value: two ? 'Combined' : 'Settlement' };
        tunnelAxes.forEach((span, j) => {
            span.visible = j < r.tunnels.length;
            if (j < r.tunnels.length) span.location = r.tunnels[j].x;
        });
        const e = r.building.edges;
        edges[0].location = e.xL;
        edges[1].location = e.xR;
        const g = r.building.governing;
        const pointwise = r.building.fields.mode === 'pointwise';
        governing.setv({ left: g.xa, right: g.xb, visible: !pointwise });
        governingLine.setv({ location: (g.xa + g.xb) / 2, visible: pointwise });
        level = r.building.category.level;
        governingColour();

        last = r;
        fitRanges(true);
    }

    /** @type {Result | null} */
    let last = null;
    /** @type {number[]} y and depth range as set by fitRanges() */
    let fitted = [];

    /**
     * y ranges from the data and the size of the plot frame (the circles
     * depend on it). force = false (after a change of the frame size):
     * only if the user has not zoomed or panned since the last fit.
     * @param {boolean} force
     */
    function fitRanges(force) {
        if (!last) return;
        const now = [yRange.start, yRange.end, depthRange.start, depthRange.end];
        if (!force && now.some((v, k) => v !== fitted[k])) return;
        const width = p.inner_width > 0 ? p.inner_width : 800;
        const height = p.inner_height > 0 ? p.inner_height : 330;
        const { y, depth } = troughRanges(last, { width, height, xSpan: p.x_range.end - p.x_range.start });
        const next = [y[0], y[1], depth[0], depth[1]];
        // a change of less than 0.1 % does not change the picture; this
        // also ends the loop axis width -> frame width -> ranges
        const span = (y[1] - y[0]) || 1;
        if (!force && next.every((v, k) => Math.abs(v - fitted[k]) <= 1e-3 * (k < 2 ? span : depth[1] - depth[0]))) return;
        yRange.setv({ start: y[0], end: y[1], reset_start: y[0], reset_end: y[1] });
        depthRange.setv({ start: depth[0], end: depth[1], reset_start: depth[0], reset_end: depth[1] });
        fitted = [yRange.start, yRange.end, depthRange.start, depthRange.end];
    }

    /**
     * Legend as a list on a narrow screen (Bokeh does not wrap it), in
     * one row otherwise (five items at most).
     * @param {boolean} narrow
     */
    function setNarrow(narrow) {
        legend.ncols = narrow ? 1 : 5;
    }

    return { plot: p, update, setTheme, setNarrow, refit: () => fitRanges(false), yRange, depthRange, circles: rC };
}
