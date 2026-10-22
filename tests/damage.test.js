// @ts-check
/*
Damage criterion (app/core/damage.js): principal strain, categories,
limit curves, legacy parabolas.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    principalStrain, damageCategory, DAMAGE_LIMITS, limitCurve, limitCurves, legacyCurves,
    LEGACY_PARABOLAS,
} from '../app/core/damage.js';
import { loadJson, assertClose } from './helpers.js';

/**
 * Numerical maximum over θ of eps(θ) = β·sinθ·cosθ + εL·cos²θ
 * (Cording et al. 2010, Fig. 3) on a fine grid, refined around the best
 * grid point.
 * @param {number} beta
 * @param {number} epsL
 */
function numericalMax(beta, epsL) {
    /** @param {number} t */
    const eps = (t) => beta * Math.sin(t) * Math.cos(t) + epsL * Math.cos(t) ** 2;
    let best = -Infinity, tBest = 0;
    const n = 200000;
    for (let k = 0; k <= n; k++) {
        const t = Math.PI * k / n;
        const e = eps(t);
        if (e > best) { best = e; tBest = t; }
    }
    // golden section search in the neighbouring interval
    let a = tBest - Math.PI / n, b = tBest + Math.PI / n;
    const g = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < 100; k++) {
        const c = b - g * (b - a), d = a + g * (b - a);
        if (eps(c) > eps(d)) b = d; else a = c;
    }
    return { max: Math.max(best, eps((a + b) / 2)), theta: (a + b) / 2 };
}

const PAIRS = [
    [0.001, 0.0005], [0.002, 0], [0, 0.001], [0.0001, 0.003], [0.005, 0.0002],
    [0.0007, 0.0007], [0.003, -0.0005], [1.2e-5, 3.4e-6],
];

test('closed form εp equals the numerical maximum over θ (rel < 1e-6)', () => {
    for (const [beta, epsL] of PAIRS) {
        const closed = principalStrain(beta, epsL);
        const { max, theta } = numericalMax(beta, epsL);
        assert.ok(Math.abs(closed / max - 1) < 1e-6, `β=${beta}, εL=${epsL}: ${closed} vs ${max}`);
        // direction of the maximum: tan 2θ = β/εL
        if (epsL > 0) {
            assert.ok(Math.abs(Math.tan(2 * theta) - beta / epsL) < 1e-4 * (1 + beta / epsL));
        }
    }
});

test('intercepts: εp(0, ε) = ε and εp(β, 0) = β/2', () => {
    for (const v of [0, 1e-6, 0.0005, 0.003, 0.01]) {
        assert.equal(principalStrain(0, v), v);
        assert.equal(principalStrain(v, 0), v / 2);
    }
});

test('DAMAGE_LIMITS: one set, Franzius (2003) Tab. 2.3', () => {
    assert.match(DAMAGE_LIMITS.source, /Franzius \(2003\), Tab\. 2\.3/);
    assert.deepEqual(DAMAGE_LIMITS.categories.map((c) => c.upper),
                     [0.0005, 0.00075, 0.0015, 0.003, Infinity]);
    assert.deepEqual(DAMAGE_LIMITS.categories.map((c) => c.name),
                     ['Negligible', 'Very slight', 'Slight', 'Moderate', 'Severe to very severe']);
    assert.deepEqual(DAMAGE_LIMITS.categories.map((c) => c.label), ['0', '1', '2', '3', '4–5']);
    assert.deepEqual(DAMAGE_LIMITS.categories.map((c) => c.crack),
                     ['< 0.1 mm', '< 1 mm', '1–5 mm', '5–15 mm', '> 15 mm']);
    assert.ok(Object.isFrozen(DAMAGE_LIMITS) && Object.isFrozen(DAMAGE_LIMITS.categories));
    assert.equal(Object.keys(DAMAGE_LIMITS).length, 2);   // source and categories, no second set
});

test('category boundaries: a limit belongs to the higher category', () => {
    const cats = DAMAGE_LIMITS.categories;
    assert.equal(damageCategory(0).level, 0);
    for (let k = 0; k < 4; k++) {
        const limit = cats[k].upper;
        assert.equal(damageCategory(limit).level, k + 1, `at ${limit}`);
        assert.equal(damageCategory(limit * (1 - 1e-12)).level, k, `below ${limit}`);
    }
    assert.equal(damageCategory(1).label, '4–5');
    assert.throws(() => damageCategory(-1e-9), RangeError);
    assert.throws(() => damageCategory(NaN), RangeError);
});

test('limit curves: εp = limit at every point, from (0, εp) to (2εp, 0)', () => {
    const curves = limitCurves(51);
    assert.equal(curves.length, 4);
    for (const { category, beta, epsL } of curves) {
        assert.equal(beta.length, 51);
        assert.equal(beta[0], 0);
        assert.equal(epsL[0], category.upper);
        assert.equal(beta[50], 2 * category.upper);
        assert.equal(epsL[50], 0);
        for (let k = 0; k < beta.length; k++) {
            assertClose(principalStrain(beta[k], epsL[k]), category.upper, `${category.name}[${k}]`,
                        { rel: 1e-12, abs: 0 });
        }
    }
    assert.throws(() => limitCurve(0), RangeError);
    assert.throws(() => limitCurve(Infinity), RangeError);
});

test('legacyCurves() matches the curves of the legacy app (1e-12)', () => {
    const legacy = loadJson('legacy_curves.json').curves;
    const curves = legacyCurves();
    assert.equal(curves.length, legacy.length);
    curves.forEach((c, k) => {
        const ref = legacy[k];
        assert.equal(`${c.name} damage`, ref.label);
        assert.equal(c.beta0, ref.beta0);
        assert.equal(c.eps0, ref.eps0);
        assertClose(c.beta, ref.beta, `${c.name}.beta`, { rel: 0, abs: 1e-12 });
        assertClose(c.epsL, ref.epsL, `${c.name}.epsL`, { rel: 0, abs: 1e-12 });
    });
    assert.deepEqual(LEGACY_PARABOLAS.map((p) => [p.beta0, p.eps0]),
                     [[0.001, 0.0005], [0.0016, 0.00075], [0.0032, 0.0015], [0.0068, 0.003]]);
});

test('legacy parabolas vs limit curves: same εL intercepts, β intercepts differ', () => {
    // same strain limits on the εL axis; on the β axis the parabolas end
    // at 2·εp for the first two categories only
    const curves = limitCurves(3);
    LEGACY_PARABOLAS.forEach((p, k) => {
        assert.equal(curves[k].epsL[0], p.eps0);
    });
    assert.deepEqual(curves.map((c) => c.beta[2]), [0.001, 0.0015, 0.003, 0.006]);
    assert.deepEqual(LEGACY_PARABOLAS.map((p) => p.beta0), [0.001, 0.0016, 0.0032, 0.0068]);
});
