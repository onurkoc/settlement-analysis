// @ts-check
/*
From the UI state to the results (app/model.js), CSV (app/csv.js) and
plot ranges (app/plots/ranges.js).
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, switchTunnels, cloneState } from '../app/state.js';
import { compute, summaryRows, coreTunnels, modeText } from '../app/model.js';
import { buildCsv, cell, SEP, EOL } from '../app/csv.js';
import { alignZero, zeroFraction, troughRanges, damageRanges, xRange } from '../app/plots/ranges.js';
import { troughProfile } from '../app/core/trough.js';
import { categoryAreas, areaLabelPosition } from '../app/plots/damage.js';
import { limitCurves, principalStrain, DAMAGE_LIMITS } from '../app/core/damage.js';
import { assessBuilding } from '../app/core/building.js';

const ONE = defaultState();
const TWO = switchTunnels(defaultState(), 2);

test('compute: same trough as troughProfile and same building as assessBuilding', () => {
    for (const s of [ONE, TWO]) {
        const r = compute(s);
        const tunnels = coreTunnels(s);
        assert.equal(tunnels[0].VL, 0.01);
        const p = troughProfile(tunnels, s.dx);
        assert.deepEqual(r.trough.x, p.x);
        assert.deepEqual(r.trough.S, p.S);
        assert.deepEqual(r.trough.Sh, p.Sh);
        assert.deepEqual(r.trough.Sj, p.Sj);
        assert.deepEqual(r.building, assessBuilding(tunnels, { center: 0, L: 20 }));
        assert.equal(r.inflections.length, 2 * tunnels.length);
    }
});

test('compute: grid widened when the building lies outside the trough range', () => {
    const s = cloneState(ONE);
    s.center = 60;
    const r = compute(s);
    assert.ok(r.trough.x[r.trough.x.length - 1] >= 70);
    assert.ok(r.R >= 70);
});

test('summary rows: values and formats (mm 2, ×10⁻³ 3, 1/n integer)', () => {
    const r = compute(ONE);
    const rows = summaryRows(ONE, r);
    /** @param {string} key */
    const row = (key) => {
        const x = rows.find((q) => q.key === key);
        assert.ok(x, key);
        return x;
    };
    assert.equal(row('S_max_total').text, '29.84');
    assert.equal(row('S_max_building').text, '29.84');
    assert.equal(row('slope_max_building').text, '1/581');
    assert.equal(row('delta_0').text, '0.00');
    assert.equal(row('beta').text, '1.719');
    assert.equal(row('eps_p').text, '0.859');
    assert.equal(row('field_xa').text, '−10.00 … −9.90');
    assert.equal(row('category').level, 2);
    assert.match(row('category').text, /^2 – Slight \(typ\. crack width 1–5 mm\)$/);
    assert.equal(row('mode').text, 'Pointwise (b = Δx = 0.1 m)');
    assert.equal(row('screening_result').text, 'Second stage required');
    assert.equal(row('screening_settlement').status, 'fail');
    assert.equal(row('beta').si, r.building.governing.beta);
    const f = cloneState(ONE);
    f.fieldMode = 'width';
    f.b = 6;
    assert.equal(modeText(compute(f).building), 'Fields, b_eff = 5.00 m, n = 4');
});

test('CSV: sections, separator, units, SI values', () => {
    const r = compute(TWO);
    const csv = buildCsv(TWO, r);
    assert.ok(csv.endsWith(EOL));
    const lines = csv.split(EOL);
    assert.ok(lines.every((l) => !l.includes('\n')));
    for (const name of ['# Inputs', '# Results', '# Trough', '# Fields']) {
        assert.ok(lines.some((l) => l.startsWith(name)), name);
    }
    assert.ok(lines.includes(['tunnel_spacing_c', '13.5', 'm'].join(SEP)));
    assert.ok(lines.includes(['tunnel_2_x_derived', '6.75', 'm'].join(SEP)));
    assert.ok(lines.includes(['tunnel_1_VL', '0.01', '-'].join(SEP)));
    const header = lines.indexOf(['x [m]', 'S_1 [m]', 'S_2 [m]', 'S [m]', 'dS/dx [-]', 'Sh [m]', 'eps_h [-]'].join(SEP));
    assert.ok(header > 0);
    // trough rows: as many as grid points, numbers with '.'
    const first = lines[header + 1].split(SEP).map(Number);
    assert.equal(first.length, 7);
    assert.equal(first[0], r.trough.x[0]);
    assert.equal(first[3], r.trough.S[0]);
    const fieldsHeader = lines.findIndex((l) => l.startsWith('k' + SEP));
    assert.equal(lines.slice(fieldsHeader + 1).filter((l) => l !== '').length, r.building.fields.n);
    const results = lines.find((l) => l.startsWith('eps_p' + SEP));
    assert.equal(Number(results?.split(SEP)[1]), r.building.governing.epsP);
    assert.ok(!csv.includes(','));   // no comma anywhere
});

test('CSV cells: numbers in full precision, no separators in text', () => {
    assert.equal(cell(0.1 + 0.2), '0.30000000000000004');
    assert.equal(cell(2.5e-7), '2.5e-7');
    assert.equal(cell(Infinity), 'inf');
    assert.equal(cell(NaN), '');
    assert.equal(cell('a;b\nc'), 'a b c');
});

test('zero of both y axes at the same height, data inside', () => {
    const cases = [[-10, 2, -40, 5], [-1, 5, -60, 3], [-0.2, 0.1, -10, 1]];
    for (const [a, b, c, d] of cases) {
        const [lo1, hi1, lo2, hi2] = alignZero(a, b, c, d);
        assert.ok(Math.abs(zeroFraction(lo1, hi1) - zeroFraction(lo2, hi2)) < 1e-12);
        // lower ends extended or kept (up to rounding), upper ends kept
        assert.ok(lo1 <= a * (1 - 1e-12) && hi1 === b && lo2 <= c * (1 - 1e-12) && hi2 === d);
    }
    for (const s of [ONE, TWO]) {
        const r = compute(s);
        const frame = { width: 800, height: 330, xSpan: 2 * r.R };
        const { y, depth } = troughRanges(r, frame);
        assert.ok(Math.abs(zeroFraction(...y) - zeroFraction(...depth)) < 1e-12);
        assert.ok(y[0] < -r.trough.Smax * 1000);
        assert.ok(depth[0] < -Math.max(...r.tunnels.map((t) => t.H)));
    }
});

test('damage plot range: 0…7 × 0…4 (from a little below 0), extended for large values', () => {
    assert.deepEqual(damageRanges([0.001], [0.002]), { x: [-0.14, 7], y: [-0.16, 4] });
    const r = damageRanges([0.01], [0.005]);
    assert.ok(Math.abs(r.x[1] - 11) < 1e-12 && Math.abs(r.y[1] - 5.5) < 1e-12);
    assert.ok(r.x[0] < 0 && r.y[0] < 0);
});

test('category areas: closed, not self-intersecting, between the limit lines', () => {
    const curves = limitCurves(201).map((c) => ({ beta: c.beta.map((v) => v * 1000), epsL: c.epsL.map((v) => v * 1000) }));
    const areas = categoryAreas(curves);
    assert.equal(areas.length, 5);
    /** signed area (shoelace) @param {{x: number[], y: number[]}} a */
    const shoelace = (a) => {
        let s = 0;
        for (let k = 0; k < a.x.length; k++) {
            const j = (k + 1) % a.x.length;
            s += a.x[k] * a.y[j] - a.x[j] * a.y[k];
        }
        return s / 2;
    };
    // area below a limit line: quarter of an ellipse-like curve, trapezoidal rule
    /** @param {{beta: number[], epsL: number[]}} c */
    const below = (c) => c.beta.slice(1).reduce((s, b, k) => s + (b - c.beta[k]) * (c.epsL[k + 1] + c.epsL[k]) / 2, 0);
    const signs = areas.map((a) => Math.sign(shoelace(a)));
    assert.ok(signs.every((s) => s === signs[0]), 'same orientation');
    for (let k = 0; k < 4; k++) {
        const expected = below(curves[k]) - (k > 0 ? below(curves[k - 1]) : 0);
        assert.ok(Math.abs(Math.abs(shoelace(areas[k])) - expected) < 1e-9, `area ${k}`);
    }
    assert.ok(Math.abs(Math.abs(shoelace(areas[4])) - (1000 * 1000 - below(curves[3]))) < 1e-6, 'area 4');
});

test('category names inside their areas', () => {
    const u = [0, ...DAMAGE_LIMITS.categories.map((c) => c.upper * 1000)];
    for (const [k, lo, hi] of [[2, u[2], u[3]], [3, u[3], u[4]], [4, u[4], u[4] * 1.4]]) {
        const p = areaLabelPosition(lo, hi);
        const e = principalStrain(p.x, p.y);
        assert.ok(e > lo && e < hi, `area ${k}: ${e}`);
    }
});

test('trough plot: tunnel circles (radius D/2 on the x axis) inside the frame, H = 5 ... 60 m, D = 2 ... 20 m', () => {
    for (const [width, height] of [[850, 330], [230, 300]]) {
        for (const H of [5, 30, 60]) {
            for (const D of [2, 10, 20]) {
                for (const count of [1, 2]) {
                    let s = defaultState();
                    s.tunnels[0] = { H, D, VL: 1, K: 0.35 };
                    if (count === 2) {
                        s = switchTunnels(s, 2);
                        s.c = Math.max(13.5, D);
                    }
                    const r = compute(s);
                    const [x0, x1] = xRange(r, { width, height });
                    const frame = { width, height, xSpan: x1 - x0 };
                    const { y, depth } = troughRanges(r, frame);
                    const span = depth[1] - depth[0];
                    for (const t of r.tunnels) {
                        const centre = (depth[1] + t.H) / span;          // from the top, fraction
                        const rho = (t.D / 2) * (width / frame.xSpan) / height;
                        const label = `${width}x${height} H=${H} D=${D} n=${count}`;
                        assert.ok(centre - rho >= 0 && centre + rho <= 1, label);
                        // horizontally inside the x range
                        assert.ok(Math.abs(t.x) + t.D / 2 <= x1, label);
                    }
                    assert.ok(Math.abs(zeroFraction(...y) - zeroFraction(...depth)) < 1e-12);
                }
            }
        }
    }
});
