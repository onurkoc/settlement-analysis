// @ts-check
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * JSON file in tests/reference/.
 * @param {string} name
 * @returns {any}
 */
export function loadJson(name) {
    const url = new URL(`./reference/${name}`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf-8'));
}

/**
 * Compare with a reference: |a − b| <= rel·|ref| + abs.
 * Numbers and nested arrays are supported.
 * @param {any} actual
 * @param {any} ref
 * @param {string} label  where we are, for the error message
 * @param {{rel?: number, abs?: number}} [tol]
 */
export function assertClose(actual, ref, label, tol = {}) {
    const { rel = 1e-9, abs = 1e-15 } = tol;
    if (Array.isArray(ref)) {
        assert.ok(Array.isArray(actual), `${label}: expected an array`);
        assert.equal(actual.length, ref.length, `${label}: length`);
        for (let i = 0; i < ref.length; i++) {
            assertClose(actual[i], ref[i], `${label}[${i}]`, tol);
        }
        return;
    }
    assert.equal(typeof actual, 'number', `${label}: expected a number`);
    const tolerance = rel * Math.abs(ref) + abs;
    assert.ok(Math.abs(actual - ref) <= tolerance,
              `${label}: ${actual} != ${ref} (tolerance ${tolerance})`);
}

/**
 * Trapezoidal rule on an equally spaced grid.
 * @param {(x: number) => number} f
 * @param {number} a
 * @param {number} b
 * @param {number} n  intervals
 */
export function integrate(f, a, b, n) {
    const h = (b - a) / n;
    let sum = (f(a) + f(b)) / 2;
    for (let k = 1; k < n; k++) {
        sum += f(a + k * h);
    }
    return sum * h;
}

/** Default tunnel of the legacy apps (VL as fraction). */
export const DEFAULT_TUNNEL = Object.freeze({ x: 0, H: 30, D: 10, VL: 0.01, K: 0.35 });
