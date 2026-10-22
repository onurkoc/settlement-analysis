// @ts-check
/*
Regression of the legacy errors 1-5 (docs/LEGACY_NOTES.md): the legacy
formulas are rebuilt here, outside app/core, and the difference to the
corrected core is recorded. If one of these tests fails, either the
legacy rebuild or the core has changed.

Legacy formulas (Bokeh 2.3.1 apps, CustomJS 13688 / 1012 / 1016):
S_max = 0.313·VL·D²/i, settlement negative downwards in the plot.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessBuilding } from '../app/core/building.js';
import { troughAt } from '../app/core/trough.js';
import { assertClose, DEFAULT_TUNNEL } from './helpers.js';

const H = 30, D = 10, VL = 0.01, K = 0.35, I = K * H, DIST = 13.5;
const LEGACY_SMAX = 0.313 * VL * D ** 2 / I;

/** @param {number} u  distance from the axis */
const legacyS = (u) => LEGACY_SMAX * Math.exp(-(u ** 2) / (2 * I ** 2));

/**
 * arange() of CustomJS 13688 / 1016, copied (error 3).
 * @param {number} start
 * @param {number} end
 * @param {number} step
 */
function legacyArange(start, end, step) {
    const arr = [];
    let count = start;
    const numberOfSteps = (end - start) / step;
    for (let index = start; index < numberOfSteps; index++) {
        arr.push(count);
        count += step;
    }
    return arr;
}

/**
 * Damage point of CustomJS 13688 (one tunnel) for a building
 * pos ± sp/2, on the x values given (errors 1 and 2).
 * @param {number[]} x
 * @param {number} length
 */
function legacyDamagePoint(x, length) {
    const settl = x.map((e) => legacyS(e));
    const sHs = x.map((e, k) => -settl[k] / H * (1 - e ** 2 / I ** 2));
    const xTilt = (Math.max(...settl) - Math.min(...settl)) / length;
    const mx = Math.max(...sHs), mn = Math.min(...sHs);
    const yHorStrain = Math.abs(mx) >= Math.abs(mn) ? Math.abs(mx) : Math.abs(mn);
    return { xTilt, yHorStrain };
}

const ONE = [DEFAULT_TUNNEL];
const TWO = [{ ...DEFAULT_TUNNEL, x: -DIST / 2 }, { ...DEFAULT_TUNNEL, x: DIST / 2 }];

test('error 1: damage point x = (max S − min S)/L instead of β = slope − Ω', () => {
    // exact building edges (start values of the notebook): only error 1
    const legacy = legacyDamagePoint([-10, 0, 10], 20);
    assertClose(legacy.xTilt, 5.434410500731644e-4, 'legacy x', { rel: 1e-12 });
    const r = assessBuilding(ONE, { center: 0, L: 20 });
    assert.equal(r.omega, 0);                                   // tilt is 0
    assertClose(r.governing.beta, 1.7189268580094022e-3, 'β');  // corrected
    assert.ok(r.governing.beta / legacy.xTilt > 3.1);           // legacy 3.2 times too small
});

test('error 2: damage point y = |max| of tension or compression instead of tension', () => {
    const legacy = legacyDamagePoint([-10, 0, 10], 20);
    // the whole building is compressed (|x| < i): legacy shows S_max/H
    assertClose(legacy.yHorStrain, LEGACY_SMAX / H, 'legacy y', { rel: 1e-12 });
    assertClose(legacy.yHorStrain, 9.936507936507937e-4, 'legacy y', { rel: 1e-12 });
    const r = assessBuilding(ONE, { center: 0, L: 20 });
    assert.equal(r.ehMax, 0);
    assert.equal(r.governing.epsLEff, 0);
});

test('error 3: arange() covers the wrong range', () => {
    const x = legacyArange(-10, 10, 0.1);
    assert.equal(x.length, 210);                        // instead of 201
    assertClose(x[x.length - 1], 10.9, 'last x', { rel: 1e-12 });
    const right = legacyArange(10, 30, 0.1);            // position 20, spread 20
    assert.equal(right.length, 190);
    assertClose(right[right.length - 1], 28.9, 'last x', { rel: 1e-12 });
    assert.equal(legacyArange(60, 70, 0.1).length, 40); // 60 ... 63.9 instead of 70
    // damage point after the first slider move (JS) vs notebook start value
    const legacy = legacyDamagePoint(x, 20);
    assertClose(legacy.xTilt, 6.208790242198568e-4, 'legacy x after a slider move', { rel: 1e-9 });
    // corrected: grid from xL to xR, both edges
    const r = assessBuilding(ONE, { center: 0, L: 20 });
    assert.equal(r.profile.x.length, 201);
    assert.equal(r.profile.x[200], 10);
});

test('error 4: slope of the combined trough as S_sup·x/i²', () => {
    // CustomJS 1012 on the legacy grid -80 ... 79.9, evaluated by
    // CustomJS 1214 for x in [-10, 10]
    let nMin = Infinity;
    for (let k = 0; k < 1600; k++) {
        const x = -80 + k * 0.1;
        if (x < -10 - 1e-9 || x > 10 + 1e-9) continue;
        const y3 = legacyS(x - DIST / 2) + legacyS(x + DIST / 2);
        const item3 = y3 * x / I ** 2;
        if (item3 !== 0) nMin = Math.min(nMin, 1 / Math.abs(item3));
    }
    assertClose(nMin, 299.86382732275064, 'legacy 1/n', { rel: 1e-6 });
    const r = assessBuilding(TWO, { center: 0, L: 20 });
    assertClose(1 / r.slopeMax, 474.23408094338396, 'corrected 1/n', { rel: 1e-9 });
});

test('error 5: Sh of two tunnels with global x instead of x − x_j', () => {
    const x = DIST / 2;     // above the axis of the right tunnel
    const legacy = x / H * -(legacyS(x - DIST / 2) + legacyS(x + DIST / 2));
    assertClose(legacy, -0.009641952062146806, 'legacy Sh', { rel: 1e-12 });
    // corrected: the right tunnel adds nothing above its own axis
    const p = troughAt(TWO, x);
    const other = troughAt([TWO[0]], x);
    assert.equal(p.Sh, other.Sh + 0);
    assertClose(p.Sh, -0.005875779340183887, 'corrected Sh', { rel: 1e-9 });
});
