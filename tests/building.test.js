// @ts-check
/*
Building on the trough (app/core/building.js): grid, tilt, fields,
screening.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    assessBuilding, buildingEdges, buildingGrid, buildingFields, screening, governingIndex, RANKIN,
} from '../app/core/building.js';
import { troughAt } from '../app/core/trough.js';
import { DEFAULT_TUNNEL } from './helpers.js';

const ONE = [DEFAULT_TUNNEL];
const TWO = [{ ...DEFAULT_TUNNEL, x: -6.75 }, { ...DEFAULT_TUNNEL, x: 6.75 }];
const DIFF = [{ x: -8, H: 25, D: 9, VL: 0.012, K: 0.4 }, { x: 7, H: 32, D: 11, VL: 0.008, K: 0.5 }];

test('building given by centre/width or by edges', () => {
    assert.deepEqual(buildingEdges({ center: 3, L: 20 }), { xL: -7, xR: 13, L: 20 });
    assert.deepEqual(buildingEdges({ xL: -7, xR: 13 }), { xL: -7, xR: 13, L: 20 });
    const a = assessBuilding(DIFF, { center: 3, L: 20 });
    const b = assessBuilding(DIFF, { xL: -7, xR: 13 });
    assert.deepEqual(a.governing, b.governing);
    assert.throws(() => buildingEdges({ xL: 5, xR: 5 }), RangeError);
    assert.throws(() => buildingEdges({ center: 0, L: -1 }), RangeError);
    assert.throws(() => buildingEdges({ center: NaN, L: 10 }), RangeError);
});

test('building grid: exactly from xL to xR, ceil(L/dx) + 1 points', () => {
    const x = buildingGrid(-10, 10, 0.1);
    assert.equal(x.length, 201);
    assert.equal(x[0], -10);
    assert.equal(x[200], 10);
    const y = buildingGrid(2.03, 13.18, 0.1);    // L = 11.15 -> 112 intervals
    assert.equal(y.length, 113);
    assert.equal(y[0], 2.03);
    assert.equal(y[112], 13.18);
    assert.ok(y.slice(1).every((v, k) => v - y[k] <= 0.1 + 1e-12));
    assert.equal(buildingGrid(0, 1.1, 0.1).length, 12);   // 1.1/0.1 counts as 11
});

test('building symmetric over the axis: δ0 = 0, Ω = 0, βmax = max|S\'|', () => {
    for (const tunnels of [ONE, TWO]) {
        const r = assessBuilding(tunnels, { center: 0, L: 20 });
        assert.equal(r.delta0, 0);
        assert.equal(r.omega, 0);
        assert.equal(r.betaMax, r.slopeMax);
        assert.ok(r.betaMax > 0);
    }
});

test('pointwise is the default: b = dx, mode "pointwise"', () => {
    const r = assessBuilding(ONE, { center: 5, L: 20 });
    assert.equal(r.fields.mode, 'pointwise');
    assert.equal(r.fields.b, 0.1);
    assert.equal(r.fields.n, 200);
    const s = assessBuilding(ONE, { center: 5, L: 20 }, { dx: 0.25 });
    assert.equal(s.fields.b, 0.25);
    assert.equal(s.fields.n, 80);
    const f = assessBuilding(ONE, { center: 5, L: 20 }, { fieldWidth: 6 });
    assert.equal(f.fields.mode, 'fields');
    assert.equal(f.fields.n, 4);
    assert.equal(f.fields.bEff, 5);
    assert.equal(f.fields.xa[0], -5);
    assert.equal(f.fields.xb[3], 15);
});

test('field width -> dx: β_k and εL_k converge to |S\'(x) − Ω| and εh(x)', () => {
    for (const tunnels of [ONE, DIFF]) {
        const edges = buildingEdges({ xL: -3, xR: 21 });
        const omega = (troughAt(tunnels, 21).S - troughAt(tunnels, -3).S) / 24;
        /** @param {number} b */
        const errors = (b) => {
            const f = buildingFields(tunnels, edges, omega, b, 0.1, 1);
            let eBeta = 0, eEps = 0;
            for (let k = 0; k < f.n; k++) {
                const p = troughAt(tunnels, (f.xa[k] + f.xb[k]) / 2);
                eBeta = Math.max(eBeta, Math.abs(f.beta[k] - Math.abs(p.dS - omega)));
                eEps = Math.max(eEps, Math.abs(f.epsL[k] - p.eh));
            }
            return [eBeta, eEps];
        };
        const e1 = errors(1), e2 = errors(0.1), e3 = errors(0.01);
        for (let j = 0; j < 2; j++) {
            // central difference: error ~ b², a factor of ~100 per step
            assert.ok(e2[j] < e1[j] / 50 && e3[j] < e2[j] / 50, `${e1[j]} ${e2[j]} ${e3[j]}`);
            assert.ok(e3[j] < 1e-8, `${e3[j]}`);
        }
    }
});

test('one field over the whole building (b = L): β = 0 for any trough', () => {
    // the field slope is the chord slope, which is the tilt Ω by
    // definition; this is why a field width b < L is needed
    for (const tunnels of [ONE, TWO, DIFF]) {
        for (const building of [{ center: 0, L: 20 }, { xL: 4, xR: 19 }, { xL: -30, xR: -2 }]) {
            const L = buildingEdges(building).L;
            for (const fieldWidth of [L, 2 * L]) {
                const r = assessBuilding(tunnels, building, { fieldWidth });
                assert.equal(r.fields.n, 1);
                assert.ok(r.fields.beta[0] < 1e-18, `${r.fields.beta[0]}`);
            }
        }
    }
});

test('two fields: equal β (Ω is the mean of the field slopes), the left one governs', () => {
    const r = assessBuilding(ONE, { center: 10.5, L: 10 }, { fieldWidth: 5, fL: 0 });
    assert.equal(r.fields.n, 2);
    assert.ok(Math.abs(r.fields.beta[0] - r.fields.beta[1]) < 1e-18);
    assert.equal(r.governing.index, 0);
    assert.equal(governingIndex([1, 3, 3 * (1 + 1e-13), 2]), 1);
    assert.equal(governingIndex([1, 3, 3.1, 2]), 2);
});

test('f_L = 0 (floors tied / grade beam): εp = β/2', () => {
    for (const tunnels of [ONE, DIFF]) {
        for (const fieldWidth of /** @type {const} */ (['pointwise', 3])) {
            const r = assessBuilding(tunnels, { xL: 2, xR: 26 }, { fieldWidth, fL: 0 });
            r.fields.epsP.forEach((e, k) => {
                assert.equal(r.fields.epsLEff[k], 0);
                assert.equal(e, r.fields.beta[k] / 2);
            });
        }
    }
});

test('compression does not count; f_L scales the extension', () => {
    // over the axis the base is compressed: εL < 0, εL,eff = 0
    const r = assessBuilding(ONE, { center: 0, L: 20 });
    assert.ok(r.fields.epsL.every((e) => e < 0));
    assert.ok(r.fields.epsLEff.every((e) => e === 0));
    assert.equal(r.ehMax, 0);
    // on the flank: extension, scaled with f_L
    const a = assessBuilding(ONE, { xL: 12, xR: 30 }, { fieldWidth: 3 });
    const h = assessBuilding(ONE, { xL: 12, xR: 30 }, { fieldWidth: 3, fL: 0.5 });
    assert.ok(a.fields.epsL.some((e) => e > 0));
    a.fields.epsL.forEach((e, k) => {
        assert.equal(a.fields.epsLEff[k], Math.max(0, e));
        assert.equal(h.fields.epsLEff[k], 0.5 * Math.max(0, e));
    });
    assert.ok(a.ehMax > 0);
});

test('screening after Rankin: θ < 1/500 and Smax < 10 mm', () => {
    assert.equal(RANKIN.slopeLimit, 1 / 500);
    assert.equal(RANKIN.sLimit, 0.01);
    assert.match(RANKIN.source, /Franzius \(2003\), §2\.4\.2\.1/);
    assert.equal(screening(0.0019, 0.0099).negligible, true);
    assert.equal(screening(1 / 500, 0.005).negligible, false);
    assert.equal(screening(0.001, 0.010).negligible, false);
    assert.equal(assessBuilding(ONE, { center: 45, L: 10 }).screening.negligible, true);
    const r = assessBuilding(ONE, { center: 0, L: 20 });
    assert.equal(r.screening.negligible, false);
    assert.equal(r.screening.sMax, r.sMax);
});

test('invalid options throw RangeError', () => {
    assert.throws(() => assessBuilding(ONE, { center: 0, L: 20 }, { fieldWidth: 0 }), RangeError);
    assert.throws(() => assessBuilding(ONE, { center: 0, L: 20 }, { fieldWidth: -2 }), RangeError);
    assert.throws(() => assessBuilding(ONE, { center: 0, L: 20 }, { fL: -0.1 }), RangeError);
    assert.throws(() => assessBuilding(ONE, { center: 0, L: 20 }, { dx: 0 }), RangeError);
    assert.throws(() => assessBuilding([], { center: 0, L: 20 }), RangeError);
});
