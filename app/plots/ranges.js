// @ts-check
/*
Axis ranges of the plots. No DOM, no Bokeh.
*/

/*
Ranges of the building and trough plots: fixed, as in the earlier app
(Plot 13299 / 1017 and 13646 / 1175). No input changes them; pan and
zoom move the view, Reset goes back to these ranges. The two y axes of
the trough plot are fixed so that y = 0 lies at (nearly) the same
height on both: 149/179 = 0.8324 and 40/48 = 0.8333 of the height
below zero, the values of the earlier app.
*/

/** x range of the building and trough plots [m]. */
export const X_RANGE = Object.freeze(/** @type {[number, number]} */ ([-50, 50]));

/** y range of the building plot (the bar from 0.15 to 0.85) [-]. */
export const BUILDING_Y_RANGE = Object.freeze(/** @type {[number, number]} */ ([0, 1]));

/** Left axis of the trough plot, settlement and Sh [mm] (−0.149 … 0.03 m in the earlier app). */
export const TROUGH_Y_RANGE = Object.freeze(/** @type {[number, number]} */ ([-149, 30]));

/** Right axis of the trough plot, depth [m]. */
export const DEPTH_RANGE = Object.freeze(/** @type {[number, number]} */ ([-40, 8]));

/**
 * Fraction of the height below zero, for checks.
 * @param {number} lo
 * @param {number} hi
 */
export function zeroFraction(lo, hi) {
    return -lo / (hi - lo);
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
