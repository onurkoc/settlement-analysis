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

/** Depth below the deepest invert on the right axis [m], as in the earlier app. */
export const DEPTH_MARGIN = 5;

/**
 * y ranges of the trough plot, divided as in the earlier app: the
 * settlement and Sh curves in the upper part, the tunnels below.
 * - Left axis (S, Sh [mm], settlement drawn downwards): from −5·S_max
 *   (S_max of the combined trough) up to a little above max(Sh), at
 *   least 5 % of |−5·S_max| above 0.
 * - Right axis (depth [m]): from −(max_j(H_j + D_j/2) + 5 m) up to the
 *   value that puts y = 0 at the same height as on the left axis.
 * The tunnel circles have the radius D/2 on the depth axis, so crown
 * and invert are exact on it.
 * @param {Result} r
 * @returns {{y: [number, number], depth: [number, number]}}
 */
export function troughRanges(r) {
    const smax = Math.max(r.trough.Smax * 1000, 1e-6);
    const shMin = Math.min(0, ...r.trough.Sh) * 1000;
    const shMax = Math.max(0, ...r.trough.Sh) * 1000;
    const lo1 = Math.min(-5 * smax, 1.15 * shMin);
    // a large Sh raises the upper end; the zero stays aligned below
    const hi1 = Math.max(1.15 * shMax, 0.05 * -lo1);
    const lo2 = -(Math.max(...r.tunnels.map((t) => t.H + t.D / 2)) + DEPTH_MARGIN);
    const F = hi1 / (hi1 - lo1);   // fraction of the height above y = 0
    return { y: [lo1, hi1], depth: [lo2, F * -lo2 / (1 - F)] };
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

/**
 * x range of the trough and building plots [m]: ±R of the result (at
 * least ±50 m, see plotHalfWidth() in app/state.js).
 * @param {Result} r
 * @returns {[number, number]}
 */
export function xRange(r) {
    return [-r.R, r.R];
}
