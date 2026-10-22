// @ts-check
/*
Invariants of the settlement trough (app/core/trough.js).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    tunnelAt, troughAt, troughProfile, inflection, maxSettlement, troughHalfWidth,
    symmetricGrid, ceilDiv,
} from '../app/core/trough.js';
import { integrate, DEFAULT_TUNNEL } from './helpers.js';

/** @typedef {import('../app/core/trough.js').Tunnel} Tunnel */

/** @type {Tunnel[][]} */
const SETS = [
    [DEFAULT_TUNNEL],
    [{ ...DEFAULT_TUNNEL, x: -6.75 }, { ...DEFAULT_TUNNEL, x: 6.75 }],
    [{ x: -8, H: 25, D: 9, VL: 0.012, K: 0.4 }, { x: 7, H: 32, D: 11, VL: 0.008, K: 0.5 }],
];
const ALL_TUNNELS = SETS.flat();

test('volume of each trough equals VL·πD²/4 (< 0.1 %)', () => {
    for (const t of ALL_TUNNELS) {
        const i = inflection(t);
        const volume = integrate((x) => tunnelAt(t, x).S, t.x - 10 * i, t.x + 10 * i, 20000);
        const expected = t.VL * Math.PI * t.D ** 2 / 4;
        assert.ok(Math.abs(volume / expected - 1) < 1e-3, `${volume} vs ${expected}`);
    }
});

test('Smax = VL·πD²/4 / (√(2π)·i), the legacy factor 0.313 is −0.1 %', () => {
    const t = DEFAULT_TUNNEL;
    const i = 0.35 * 30;
    const exact = 0.01 * Math.PI * 100 / 4 / (Math.sqrt(2 * Math.PI) * i);
    assert.ok(Math.abs(maxSettlement(t) / exact - 1) < 1e-15);
    assert.equal(tunnelAt(t, 0).S, maxSettlement(t));
    const legacy = 0.313 * 0.01 * 100 / i;
    assert.ok(Math.abs(legacy / maxSettlement(t) - 1 + 0.00105) < 1e-4);
});

test("S' equals the central difference of S", () => {
    const h = 1e-4;
    for (const tunnels of SETS) {
        for (let x = -40; x <= 40; x += 0.7) {
            const fd = (troughAt(tunnels, x + h).S - troughAt(tunnels, x - h).S) / (2 * h);
            const dS = troughAt(tunnels, x).dS;
            assert.ok(Math.abs(fd - dS) <= 1e-7 * Math.abs(dS) + 1e-12, `x = ${x}: ${fd} vs ${dS}`);
        }
    }
});

test('eh equals the central difference of Sh (extension positive)', () => {
    const h = 1e-4;
    for (const tunnels of SETS) {
        for (let x = -40; x <= 40; x += 0.7) {
            const fd = (troughAt(tunnels, x + h).Sh - troughAt(tunnels, x - h).Sh) / (2 * h);
            const eh = troughAt(tunnels, x).eh;
            assert.ok(Math.abs(fd - eh) <= 1e-7 * Math.abs(eh) + 1e-12, `x = ${x}: ${fd} vs ${eh}`);
        }
    }
});

test('symmetric case: S, eh even; dS, Sh odd', () => {
    for (const tunnels of SETS.slice(0, 2)) {
        const p = troughProfile(tunnels);
        const n = p.x.length;
        assert.equal(p.x[(n - 1) / 2], 0);
        for (let k = 0; k < n; k++) {
            const m = n - 1 - k;
            assert.ok(p.x[m] === -p.x[k]);   // 0 === -0
            assert.ok(Math.abs(p.S[k] - p.S[m]) <= 1e-15, 'S');
            assert.ok(Math.abs(p.eh[k] - p.eh[m]) <= 1e-17, 'eh');
            assert.ok(Math.abs(p.dS[k] + p.dS[m]) <= 1e-17, 'dS');
            assert.ok(Math.abs(p.Sh[k] + p.Sh[m]) <= 1e-17, 'Sh');
        }
    }
});

test('one tunnel: eh = 0 at x_j ± i_j, extension outside, compression inside', () => {
    for (const t of [DEFAULT_TUNNEL, { x: 12.3, H: 18, D: 7, VL: 0.015, K: 0.5 }]) {
        const i = inflection(t);
        for (const x of [t.x - i, t.x + i]) {
            assert.ok(Math.abs(tunnelAt(t, x).eh) < 1e-18, `eh(${x}) = ${tunnelAt(t, x).eh}`);
        }
        assert.ok(tunnelAt(t, t.x + 1.5 * i).eh > 0);
        assert.ok(tunnelAt(t, t.x + 0.5 * i).eh < 0);
    }
});

test('Sh points to the axis of each tunnel and is 0 above an offset axis', () => {
    const t = { x: 12.3, H: 18, D: 7, VL: 0.015, K: 0.5 };
    assert.ok(tunnelAt(t, t.x).Sh === 0);
    assert.ok(tunnelAt(t, t.x + 3).Sh < 0);
    assert.ok(tunnelAt(t, t.x - 3).Sh > 0);
});

test('superposition: troughAt is the sum of the tunnels', () => {
    const tunnels = SETS[2];
    for (const x of [-20, -8, 0, 3.3, 7, 25]) {
        const sum = troughAt(tunnels, x);
        const parts = tunnels.map((t) => tunnelAt(t, x));
        for (const key of /** @type {const} */ (['S', 'dS', 'Sh', 'eh'])) {
            assert.equal(sum[key], parts[0][key] + parts[1][key]);
        }
    }
});

test('grid: ±(max|x_j| + 3·max i_j), step dx, x = 0 included', () => {
    const tunnels = SETS[2];
    assert.equal(troughHalfWidth(tunnels), 8 + 3 * 16);
    const p = troughProfile(tunnels, 0.1);
    assert.equal(p.x.length, 2 * 560 + 1);
    assert.ok(Math.abs(p.x[0] + 56) < 1e-12 && Math.abs(p.x[p.x.length - 1] - 56) < 1e-12);
    assert.ok(p.x.includes(0));
    assert.equal(symmetricGrid(1.1, 0.1).length, 23);   // 1.1/0.1 = 11.000000000000002
    assert.equal(ceilDiv(1.1, 0.1), 11);
    assert.equal(ceilDiv(1.15, 0.1), 12);
    const coarse = troughProfile([DEFAULT_TUNNEL], 0.5);
    assert.equal(coarse.dx, 0.5);
    assert.equal(coarse.x[1] - coarse.x[0], 0.5);
});

test('invalid input throws RangeError', () => {
    assert.throws(() => troughProfile([]), RangeError);
    assert.throws(() => troughProfile([{ ...DEFAULT_TUNNEL, H: 0 }]), RangeError);
    assert.throws(() => troughProfile([{ ...DEFAULT_TUNNEL, K: -1 }]), RangeError);
    assert.throws(() => troughProfile([{ ...DEFAULT_TUNNEL, VL: NaN }]), RangeError);
    assert.throws(() => troughProfile([DEFAULT_TUNNEL], 0), RangeError);
    // VL = 0 is allowed: no settlement
    assert.equal(Math.max(...troughProfile([{ ...DEFAULT_TUNNEL, VL: 0 }]).S), 0);
});

test('no strings in the number arrays', () => {
    const p = troughProfile(SETS[1]);
    for (const key of /** @type {const} */ (['x', 'S', 'dS', 'Sh', 'eh'])) {
        assert.ok(p[key].every((v) => typeof v === 'number' && Number.isFinite(v)), key);
    }
});
