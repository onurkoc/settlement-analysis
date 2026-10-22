// @ts-check
/*
Units and number formats. The calculation core works in SI units
(m, -); the conversions to display units are collected here.
No DOM, no locale: decimal point, the UI may replace it.
*/

/**
 * Length in m to mm.
 * @param {number} m
 */
export function toMm(m) {
    return m * 1000;
}

/**
 * Length in mm to m.
 * @param {number} mm
 */
export function fromMm(mm) {
    return mm / 1000;
}

/**
 * Volume loss in % to the fraction used by the core (1 % -> 0.01).
 * @param {number} percent
 */
export function percentToFraction(percent) {
    return percent / 100;
}

/**
 * Fraction to % (0.01 -> 1 %).
 * @param {number} fraction
 */
export function fractionToPercent(fraction) {
    return fraction * 100;
}

/**
 * Slope as "1/n": n = 1/|slope|. A slope of 0 gives n = Infinity
 * (never a string in a number array).
 * @param {number} slope  [-]
 * @returns {number}
 */
export function slopeToN(slope) {
    const a = Math.abs(slope);
    return a === 0 ? Infinity : 1 / a;
}

/**
 * Text for a slope given as n: "1/580", or "–" for n = Infinity.
 * @param {number} n
 * @param {number} [digits]  decimals of n
 */
export function formatSlopeN(n, digits = 0) {
    return Number.isFinite(n) ? `1/${n.toFixed(digits)}` : '–';
}

/**
 * Value in m as mm text, e.g. 0.02984 -> "29.84".
 * @param {number} m
 * @param {number} [digits]
 */
export function formatMm(m, digits = 2) {
    return toMm(m).toFixed(digits);
}

/**
 * Strain or angle as multiple of 1e-3, e.g. 0.000543 -> "0.543"
 * (the unit "×10⁻³" is written by the caller).
 * @param {number} value  [-]
 * @param {number} [digits]
 */
export function formatE3(value, digits = 3) {
    return (value * 1000).toFixed(digits);
}
