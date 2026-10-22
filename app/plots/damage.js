// @ts-check
/*
Plot "Damage assessment": angular distortion β against the effective
lateral strain ε_L,eff [×10⁻³], lines of constant principal strain
(Cording et al. 2010, Fig. 2, limits after Franzius 2003, Tab. 2.3),
all fields and the governing field. Optional: limit parabolas of the
legacy apps (Boscardin & Cording 1989).
*/
import { applyFrame, setGlyph, TOOLS } from './theme.js';
import { damageRanges } from './ranges.js';
import { limitCurves, legacyCurves, DAMAGE_LIMITS } from '../core/damage.js';
import { formatRange } from '../model.js';

/** @typedef {import('./theme.js').Theme} Theme */
/** @typedef {import('../model.js').Result} Result */

/**
 * @param {any} B  window.Bokeh
 * @param {Theme} th
 */
export function createDamagePlot(B, th) {
    const xRange = new B.Range1d({ start: 0, end: 7 });
    const yRange = new B.Range1d({ start: 0, end: 4 });
    const p = B.Plotting.figure({
        title: 'Damage assessment',
        height: 400,
        sizing_mode: 'stretch_width',
        x_range: xRange,
        y_range: yRange,
        tools: TOOLS,
        toolbar_location: 'above',
        x_axis_label: 'Angular distortion β [×10⁻³]',
        y_axis_label: 'Lateral strain ε_L,eff [×10⁻³]',
    });
    p.toolbar.logo = null;

    // lines of constant principal strain
    const curves = limitCurves(101).map((c) => p.line(c.beta.map((v) => v * 1000), c.epsL.map((v) => v * 1000),
                                                       { line_width: 2 }));
    // category names: below each line near the ε_L axis, "severe" above the last one
    const cats = DAMAGE_LIMITS.categories;
    const labelData = {
        x: cats.map(() => 0.08),
        y: cats.map((c, k) => (k < 4 ? c.upper : cats[3].upper) * 1000),
        text: cats.map((c) => c.name),
        dy: cats.map((_, k) => (k < 4 ? -3 : 3)),
        baseline: cats.map((_, k) => (k < 4 ? 'top' : 'bottom')),
        color: th.cats.slice(),
    };
    const labelSource = new B.ColumnDataSource({ data: labelData });
    const labels = new B.LabelSet({
        x: { field: 'x' }, y: { field: 'y' }, text: { field: 'text' }, y_offset: { field: 'dy' },
        text_baseline: { field: 'baseline' }, text_color: { field: 'color' }, text_font_size: '12px',
        source: labelSource,
    });
    p.add_layout(labels);

    const legacy = legacyCurves().map((c) => p.line(c.beta.map((v) => v * 1000), c.epsL.map((v) => v * 1000),
                                                     { line_width: 1.5, line_dash: [6, 4], visible: false }));

    const fields = new B.ColumnDataSource({ data: { x: [], y: [] } });
    const gov = new B.ColumnDataSource({
        data: { x: [], y: [], loc: [], beta: [], epsL: [], epsLEff: [], epsP: [], cat: [], color: [] },
    });
    const rFields = p.scatter({ x: { field: 'x' }, y: { field: 'y' }, source: fields, size: 5, marker: 'circle',
                                fill_alpha: 0.6, line_alpha: 0 });
    const rGov = p.scatter({ x: { field: 'x' }, y: { field: 'y' }, source: gov, size: 15, marker: 'diamond',
                             fill_color: { field: 'color' }, line_width: 1.5 });

    const items = {
        fields: new B.LegendItem({ label: 'Fields', renderers: [rFields] }),
        gov: new B.LegendItem({ label: 'Governing field', renderers: [rGov] }),
        legacy: new B.LegendItem({ label: 'Boscardin & Cording (1989)', renderers: [legacy[0]], visible: false }),
    };
    p.add_layout(new B.Legend({ items: Object.values(items), location: 'top_right' }));

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

    let theme = th;

    /** @param {Theme} t */
    function setTheme(t) {
        theme = t;
        applyFrame(B, p, t);
        curves.forEach((r, k) => setGlyph(r, { line_color: t.cats[k] }));
        legacy.forEach((r) => setGlyph(r, { line_color: t.muted }));
        labelSource.data = { ...labelSource.data, color: t.cats.slice() };
        setGlyph(rFields, { fill_color: t.field });
        setGlyph(rGov, { line_color: t.text });
        const g = gov.data;
        if (g.x.length > 0) gov.data = { ...g, color: [t.cats[lastLevel]] };
    }

    let lastLevel = 0;

    /** @param {Result} r */
    function update(r) {
        const f = r.building.fields;
        const g = r.building.governing;
        const c = r.building.category;
        lastLevel = c.level;
        fields.data = { x: f.beta.map((v) => v * 1000), y: f.epsLEff.map((v) => v * 1000) };
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
        items.legacy.visible = show;
    }

    setTheme(th);
    return { plot: p, update, setTheme, showLegacy };
}
