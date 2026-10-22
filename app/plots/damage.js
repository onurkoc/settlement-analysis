// @ts-check
/*
Plot "Damage assessment": angular distortion β against the effective
lateral strain ε_L,eff [×10⁻³]. The damage categories are coloured
areas between the lines of constant principal strain (Cording et al.
2010, Fig. 2, limits after Franzius 2003, Tab. 2.3); all fields as
small points, the governing field as a large marker. Optional: limit
parabolas of the legacy apps (Boscardin & Cording 1989).
*/
import { applyFrame, setGlyph, TOOLS } from './theme.js';
import { damageRanges } from './ranges.js';
import { limitCurves, legacyCurves, DAMAGE_LIMITS } from '../core/damage.js';
import { formatRange } from '../model.js';

/** @typedef {import('./theme.js').Theme} Theme */
/** @typedef {import('../model.js').Result} Result */

/** Far corner of the last area (severe), beyond any plotted range [×10⁻³]. */
const FAR = 1000;

/**
 * Corner points of the category areas [×10⁻³]: area k lies between the
 * lines of constant principal strain k − 1 and k (area 0 from the
 * origin, the last one up to FAR).
 * @param {{beta: number[], epsL: number[]}[]} curves  limit curves, ×10⁻³
 * @returns {{x: number[], y: number[]}[]}
 */
export function categoryAreas(curves) {
    const areas = [];
    for (let k = 0; k <= curves.length; k++) {
        const x = [];
        const y = [];
        if (k < curves.length) {
            x.push(...curves[k].beta);
            y.push(...curves[k].epsL);
        } else {
            // corners in the order that joins the inner line at (2ε_p, 0)
            x.push(0, FAR, FAR);
            y.push(FAR, FAR, 0);
        }
        if (k === 0) {
            x.push(0);
            y.push(0);
        } else {
            const inner = curves[k - 1];
            for (let j = inner.beta.length - 1; j >= 0; j--) {
                x.push(inner.beta[j]);
                y.push(inner.epsL[j]);
            }
        }
        areas.push({ x, y });
    }
    return areas;
}

/**
 * Position of the name inside area k [×10⁻³]: on the line ε_L = β,
 * halfway between the bounding lines (ε_p = β·(1 + √2)/2 on this line).
 * @param {number} lower  ε_p of the lower line ×10⁻³ (0 for area 0)
 * @param {number} upper  ε_p of the upper line ×10⁻³
 */
export function areaLabelPosition(lower, upper) {
    const b = 2 * ((lower + upper) / 2) / (1 + Math.SQRT2);
    return { x: b, y: b };
}

/**
 * Areas that get their name written inside: the first two are too
 * narrow on a phone, their names are in the legend only.
 */
const LABELLED = [2, 3, 4];

/**
 * @param {any} B  window.Bokeh
 * @param {Theme} th
 */
export function createDamagePlot(B, th) {
    const xRange = new B.Range1d({ start: -0.14, end: 7 });
    const yRange = new B.Range1d({ start: -0.16, end: 4 });
    const p = B.Plotting.figure({
        title: 'Damage assessment',
        height: 420,
        sizing_mode: 'stretch_width',
        x_range: xRange,
        y_range: yRange,
        tools: TOOLS,
        toolbar_location: 'above',
        x_axis_label: 'Angular distortion β [×10⁻³]',
        y_axis_label: 'Lateral strain ε_L,eff [×10⁻³]',
    });
    p.toolbar.logo = null;

    const cats = DAMAGE_LIMITS.categories;
    const limits = limitCurves(101).map((c) => ({
        beta: c.beta.map((v) => v * 1000),
        epsL: c.epsL.map((v) => v * 1000),
    }));
    const areas = categoryAreas(limits).map((a) => p.patch(a.x, a.y, { line_alpha: 0 }));
    const lines = limits.map((c) => p.line(c.beta, c.epsL, { line_width: 1.5 }));

    // names inside the larger areas
    const uppers = [0, ...cats.map((c) => c.upper * 1000)];
    uppers[cats.length] = cats[cats.length - 2].upper * 1000 * 1.4;
    const labelPos = LABELLED.map((k) => areaLabelPosition(uppers[k], uppers[k + 1]));
    const labelSource = new B.ColumnDataSource({
        data: { x: labelPos.map((q) => q.x), y: labelPos.map((q) => q.y), text: LABELLED.map((k) => cats[k].name) },
    });
    const labels = new B.LabelSet({
        x: { field: 'x' }, y: { field: 'y' }, text: { field: 'text' }, source: labelSource,
        text_align: 'center', text_baseline: 'middle', text_font_size: '12px', text_font_style: 'bold',
    });
    p.add_layout(labels);

    const legacy = legacyCurves().map((c) => p.line(c.beta.map((v) => v * 1000), c.epsL.map((v) => v * 1000),
                                                     { line_width: 1.5, line_dash: [6, 4], visible: false }));

    const fields = new B.ColumnDataSource({ data: { x: [], y: [], loc: [], epsP: [] } });
    const gov = new B.ColumnDataSource({
        data: { x: [], y: [], loc: [], beta: [], epsL: [], epsLEff: [], epsP: [], cat: [], color: [] },
    });
    // points of all fields: hidden by default, as in the earlier app only
    // one point per building (the governing field)
    const rFields = p.scatter({ x: { field: 'x' }, y: { field: 'y' }, source: fields, size: 5, marker: 'circle',
                                fill_alpha: 0.7, line_alpha: 0, visible: false });
    const rGov = p.scatter({ x: { field: 'x' }, y: { field: 'y' }, source: gov, size: 15, marker: 'diamond',
                             fill_color: { field: 'color' }, line_width: 1.5 });

    const fieldsItem = new B.LegendItem({ label: 'Fields', renderers: [rFields], visible: false });
    const legacyItem = new B.LegendItem({ label: 'Boscardin & Cording (1989)', renderers: [legacy[0]], visible: false });
    const legend = new B.Legend({
        items: [
            ...cats.map((c, k) => new B.LegendItem({ label: `${c.label} ${c.name}`, renderers: [areas[k]] })),
            fieldsItem,
            new B.LegendItem({ label: 'Governing field', renderers: [rGov] }),
            legacyItem,
        ],
        orientation: 'horizontal',
        location: 'center',
        ncols: 4,
    });
    p.add_layout(legend, 'below');

    p.add_tools(new B.HoverTool({
        renderers: [rGov],
        tooltips: [
            ['Field', '@loc m'],
            ['β', '@beta{0.000} ×10⁻³'],
            ['ε_L', '@epsL{0.000} ×10⁻³'],
            ['ε_L,eff', '@epsLEff{0.000} ×10⁻³'],
            ['ε_p', '@epsP{0.000} ×10⁻³'],
            ['Category', '@cat'],
        ],
    }));
    // only drawn (and inspected) while the points are visible
    p.add_tools(new B.HoverTool({
        renderers: [rFields],
        tooltips: [
            ['Field', '@loc m'],
            ['β', '@x{0.000} ×10⁻³'],
            ['ε_L,eff', '@y{0.000} ×10⁻³'],
            ['ε_p', '@epsP{0.000} ×10⁻³'],
        ],
    }));

    let theme = th;
    let level = 0;

    /** @param {Theme} t */
    function setTheme(t) {
        theme = t;
        applyFrame(B, p, t);
        areas.forEach((r, k) => setGlyph(r, { fill_color: t.cats[k], fill_alpha: t.bandAlpha }));
        lines.forEach((r, k) => setGlyph(r, { line_color: t.cats[k] }));
        legacy.forEach((r) => setGlyph(r, { line_color: t.muted }));
        labels.text_color = t.text;
        setGlyph(rFields, { fill_color: t.field });
        setGlyph(rGov, { line_color: t.text });
        if (gov.data.x.length > 0) gov.data = { ...gov.data, color: [t.cats[level]] };
    }
    setTheme(th);

    /** @param {Result} r */
    function update(r) {
        const f = r.building.fields;
        const g = r.building.governing;
        const c = r.building.category;
        level = c.level;
        fields.data = {
            x: f.beta.map((v) => v * 1000), y: f.epsLEff.map((v) => v * 1000),
            loc: f.xa.map((a, k) => formatRange(a, f.xb[k])), epsP: f.epsP.map((v) => v * 1000),
        };
        gov.data = {
            x: [g.beta * 1000], y: [g.epsLEff * 1000],
            loc: [formatRange(g.xa, g.xb)],
            beta: [g.beta * 1000], epsL: [g.epsL * 1000], epsLEff: [g.epsLEff * 1000], epsP: [g.epsP * 1000],
            cat: [`${c.label} – ${c.name}`],
            color: [theme.cats[c.level]],
        };
        const rg = damageRanges(f.beta, f.epsLEff);
        xRange.setv({ start: rg.x[0], end: rg.x[1], reset_start: rg.x[0], reset_end: rg.x[1] });
        yRange.setv({ start: rg.y[0], end: rg.y[1], reset_start: rg.y[0], reset_end: rg.y[1] });
    }

    /** @param {boolean} show */
    function showLegacy(show) {
        legacy.forEach((r) => { r.visible = show; });
        legacyItem.visible = show;
    }

    /** @param {boolean} show  points of all fields and their legend entry */
    function showAllFields(show) {
        rFields.visible = show;
        fieldsItem.visible = show;
    }

    /**
     * Legend in one column on a narrow screen, four otherwise.
     * @param {boolean} narrow
     */
    function setNarrow(narrow) {
        legend.ncols = narrow ? 1 : 4;
    }

    return { plot: p, update, setTheme, showLegacy, showAllFields, setNarrow, fields: rFields };
}
