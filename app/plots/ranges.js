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
 * y ranges of the trough plot: left axis settlement and horizontal
 * displacement [mm] (settlement drawn downwards, negative), right axis
 * depth [m] down to below the deepest tunnel.
 * @param {Result} r
 * @returns {{y: [number, number], depth: [number, number]}}
 */
export function troughRanges(r) {
    const smax = Math.max(r.trough.Smax * 1000, 1e-6);
    const shMin = Math.min(0, ...r.trough.Sh) * 1000;
    const shMax = Math.max(0, ...r.trough.Sh) * 1000;
    const lo1 = 1.15 * Math.min(-smax, shMin);
    const hi1 = Math.max(1.15 * shMax, 0.12 * -lo1);
    const deepest = Math.max(...r.tunnels.map((t) => t.H + t.D / 2));
    const lo2 = -1.1 * deepest;
    const hi2 = 0.12 * -lo2;
    const [a, b, c, d] = alignZero(lo1, hi1, lo2, hi2);
    return { y: [a, b], depth: [c, d] };
}

/**
 * Ranges of the damage plot [×10⁻³]: 0 ... 7 and 0 ... 4 as in Cording
 * et al. (2010), Fig. 2, extended if a field lies outside.
 * @param {number[]} beta  [-]
 * @param {number[]} epsLEff  [-]
 * @returns {{x: [number, number], y: [number, number]}}
 */
export function damageRanges(beta, epsLEff) {
    const bx = Math.max(0, ...beta) * 1000;
    const ey = Math.max(0, ...epsLEff) * 1000;
    return { x: [0, Math.max(7, 1.1 * bx)], y: [0, Math.max(4, 1.1 * ey)] };
}

/**
 * x range of the trough and building plots [m].
 * @param {Result} r
 * @returns {[number, number]}
 */
export function xRange(r) {
    return [-r.R, r.R];
}
