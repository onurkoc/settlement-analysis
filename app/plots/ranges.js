// @ts-check
/*
Axis ranges of the plots. No DOM, no Bokeh.
*/

/** @typedef {import('../model.js').Result} Result */

/**
 * Ranges of two y axes with y = 0 at the same height of the plot.
 * Both input ranges must contain 0 (lo < 0 < hi). The upper ends are
 * kept; the lower end of the axis with the smaller part below zero is
 * extended, so both axes still contain their data.
 * @param {number} lo1 @param {number} hi1  left axis
 * @param {number} lo2 @param {number} hi2  right axis
 * @returns {[number, number, number, number]}  lo1, hi1, lo2, hi2
 */
export function alignZero(lo1, hi1, lo2, hi2) {
    // fraction of the height below zero
    const f = Math.max(-lo1 / (hi1 - lo1), -lo2 / (hi2 - lo2));
    return [hi1 * f / (f - 1), hi1, hi2 * f / (f - 1), hi2];
}

/**
 * Fraction of the height below zero, for checks.
 * @param {number} lo
 * @param {number} hi
 */
export function zeroFraction(lo, hi) {
    return -lo / (hi - lo);
}

/**
 * @typedef {Object} Frame
 * @property {number} width  width of the plot frame [px]
 * @property {number} height  height of the plot frame [px]
 * @property {number} xSpan  width of the x range [m]
 */

/** Free space at the top and bottom of the trough plot, fraction of the height. */
const MARGIN = 0.04;

/**
 * y ranges of the trough plot: left axis settlement and horizontal
 * displacement [mm] (settlement drawn downwards, negative), right axis
 * depth [m]; y = 0 at the same height on both axes.
 *
 * The tunnels are circles with the radius D/2 measured on the x axis
 * (round on the screen, as in the earlier app), so their size on the
 * depth axis depends on the plot frame: in fractions of the frame height
 * the radius is ρ = (D/2)·(width/xSpan)/height. With F the fraction of
 * the height above y = 0 and d the depth span, a circle at depth H lies
 * inside the frame if
 *     F + H/d + ρ ≤ 1 − margin   (invert)   and   F + H/d − ρ ≥ margin   (crown).
 * F starts from the left axis and is raised only if a shallow, large
 * circle needs room above the ground; d is the smallest span that holds
 * all circles.
 * @param {Result} r
 * @param {Frame} [frame]  default: a frame of 800 × 330 px
 * @returns {{y: [number, number], depth: [number, number]}}
 */
export function troughRanges(r, frame = { width: 800, height: 330, xSpan: 2 * r.R }) {
    const smax = Math.max(r.trough.Smax * 1000, 1e-6);
    const shMin = Math.min(0, ...r.trough.Sh) * 1000;
    const shMax = Math.max(0, ...r.trough.Sh) * 1000;
    const lo1 = 1.15 * Math.min(-smax, shMin);
    const hi1 = Math.max(1.15 * shMax, 0.12 * -lo1);

    const kx = frame.width / frame.xSpan;   // px per m on the x axis
    const circles = r.tunnels.map((t) => ({ H: t.H, rho: (t.D / 2) * kx / frame.height }));
    /** @param {number} F  smallest and largest depth span for this F */
    const spans = (F) => {
        let dMin = 0;
        let dMax = Infinity;
        for (const { H, rho } of circles) {
            const room = 1 - MARGIN - rho - F;
            if (room <= 0) return null;
            dMin = Math.max(dMin, H / room);
            const top = rho + MARGIN - F;
            if (top > 0) dMax = Math.min(dMax, H / top);
        }
        return dMin <= dMax ? dMin : null;
    };
    let F = hi1 / (hi1 - lo1);   // fraction of the height above y = 0
    let d = spans(F);
    while (d === null && F < 0.9) {
        F += 0.01;
        d = spans(F);
    }
    if (d === null) {
        // circles larger than the frame: show the deepest axis at least
        d = 1.2 * Math.max(...r.tunnels.map((t) => t.H)) / (1 - F);
    }
    // left axis: keep the lower end, raise the upper end to the same F
    const hiLeft = Math.max(hi1, F * -lo1 / (1 - F));
    return { y: [lo1, hiLeft], depth: [-(1 - F) * d, F * d] };
}

/**
 * Ranges of the damage plot [×10⁻³]: 0 ... 7 and 0 ... 4 as in Cording
 * et al. (2010), Fig. 2, extended if a field lies outside. Both start
 * a little below 0, so a marker at β = 0 or ε_L,eff = 0 is not cut.
 * @param {number[]} beta  [-]
 * @param {number[]} epsLEff  [-]
 * @returns {{x: [number, number], y: [number, number]}}
 */
export function damageRanges(beta, epsLEff) {
    const bx = Math.max(0, ...beta) * 1000;
    const ey = Math.max(0, ...epsLEff) * 1000;
    const xe = Math.max(7, 1.1 * bx);
    const ye = Math.max(4, 1.1 * ey);
    return { x: [-0.02 * xe, xe], y: [-0.04 * ye, ye] };
}

/** Largest radius of a tunnel circle, fraction of the frame height. */
export const MAX_CIRCLE = 0.4;

/**
 * x range of the trough and building plots [m]: ±R of the result,
 * widened if a tunnel circle (radius D/2 on the x axis) would be higher
 * than 2·MAX_CIRCLE of the frame (large D, narrow range, wide frame).
 * @param {Result} r
 * @param {{width: number, height: number}} [frame]  plot frame [px]
 * @returns {[number, number]}
 */
export function xRange(r, frame) {
    let R = r.R;
    if (frame && frame.width > 0 && frame.height > 0) {
        for (const t of r.tunnels) {
            // rho = (D/2)·(width/2R)/height <= MAX_CIRCLE
            R = Math.max(R, (t.D / 2) * frame.width / (2 * MAX_CIRCLE * frame.height));
        }
    }
    return [-R, R];
}
