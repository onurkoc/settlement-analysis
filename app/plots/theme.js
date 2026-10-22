// @ts-check
/*
Colours of the plots from the CSS custom properties (app/style.css), so
the plots follow the light/dark theme of the page.
*/

/**
 * @typedef {Object} Theme
 * @property {string} bg
 * @property {string} text
 * @property {string} muted
 * @property {string} line
 * @property {string} grid
 * @property {string} accent
 * @property {string} tunnel1
 * @property {string} tunnel2
 * @property {string} sh
 * @property {string} building
 * @property {string} tunnelFill
 * @property {string} field
 * @property {string[]} cats  colours of the damage categories 0 ... 4
 * @property {number} bandAlpha  opacity of the category areas
 * @property {string} font
 */

/**
 * Read the theme from the page, or from an element with its own
 * colours (#theme-light: light theme for the PNG export).
 * @param {Element} [el]
 * @returns {Theme}
 */
export function readTheme(el = document.documentElement) {
    const cs = getComputedStyle(el);
    /** @param {string} name */
    const v = (name) => cs.getPropertyValue(name).trim();
    return {
        bg: v('--surface'),
        text: v('--text'),
        muted: v('--muted'),
        line: v('--line'),
        grid: v('--grid'),
        accent: v('--accent'),
        tunnel1: v('--tunnel1'),
        tunnel2: v('--tunnel2'),
        sh: v('--sh'),
        building: v('--building'),
        tunnelFill: v('--tunnel-fill'),
        field: v('--field'),
        cats: [0, 1, 2, 3, 4].map((k) => v(`--cat${k}`)),
        bandAlpha: Number(v('--band-alpha')) || 0.15,
        font: v('--font-plot') || 'system-ui, sans-serif',
    };
}

/**
 * Apply the frame colours and fonts of the theme to a plot.
 * @param {any} B  window.Bokeh
 * @param {any} p  plot
 * @param {Theme} th
 */
export function applyFrame(B, p, th) {
    p.setv({
        background_fill_color: th.bg,
        border_fill_color: th.bg,
        outline_line_color: th.line,
    });
    p.title.setv({ text_color: th.text, text_font: th.font, text_font_size: '14px' });
    for (const a of [...p.left, ...p.right, ...p.below, ...p.above]) {
        if (a instanceof B.Axis) {
            a.setv({
                axis_line_color: th.muted,
                major_tick_line_color: th.muted,
                minor_tick_line_color: th.muted,
                major_label_text_color: th.muted,
                major_label_text_font: th.font,
                axis_label_text_color: th.text,
                axis_label_text_font: th.font,
                axis_label_text_font_style: 'normal',
            });
        }
    }
    for (const c of [...p.center, ...p.below, ...p.above, ...p.left, ...p.right]) {
        if (c instanceof B.Grid) {
            c.grid_line_color = th.grid;
        } else if (c instanceof B.Legend) {
            c.setv({
                background_fill_color: th.bg,
                background_fill_alpha: 0.85,
                border_line_color: th.line,
                label_text_color: th.text,
                label_text_font: th.font,
                label_text_font_size: '12px',
            });
        }
    }
}

/**
 * Set visual properties on the glyph of a renderer and on its derived
 * glyphs (selection, nonselection, hover, muted). The plotting API
 * creates these copies when the renderer is made; while the hover tool
 * inspects the data source, Bokeh draws with them, so they must carry
 * the same colours.
 * @param {any} r  GlyphRenderer
 * @param {Record<string, any>} props
 */
export function setGlyph(r, props) {
    for (const key of ['glyph', 'selection_glyph', 'nonselection_glyph', 'hover_glyph', 'muted_glyph']) {
        const g = r[key];
        if (g != null && typeof g === 'object' && typeof g.setv === 'function') {
            g.setv(props);
        }
    }
}

/**
 * Tools of all plots: pan, box zoom, wheel zoom, reset. Saving is added
 * by app/plots/index.js as a custom action, which exports in the light
 * theme.
 */
export const TOOLS = 'pan,box_zoom,wheel_zoom,reset';
