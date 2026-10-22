// @ts-check
/*
State of the UI (app/state.js): defaults, validation, switching, hash.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    defaultState, validate, switchTunnels, switchBuildingMode, encodeHash, decodeHash, activeFields,
    edgesOf, plotHalfWidth, cloneState, setPath, getPath, MAX_GRID_POINTS, parseNumber,
} from '../app/state.js';
import { checkTunnel } from '../app/core/trough.js';

test('defaults: one tunnel x=0, H=30, D=10, VL=1 %, K=0.35; building 0 ± 10 m; pointwise', () => {
    const s = defaultState();
    assert.equal(s.count, 1);
    assert.deepEqual(s.tunnels[0], { x: 0, H: 30, D: 10, VL: 1, K: 0.35 });
    assert.deepEqual(edgesOf(s), { xL: -10, xR: 10 });
    assert.equal(s.fieldMode, 'pointwise');
    assert.equal(s.fL, 1);
    assert.equal(s.floorsTied, false);
    assert.equal(s.dx, 0.1);
    assert.deepEqual(validate(s), {});
});

test('switch to two tunnels: ±6.75 m, values of tunnel 1 copied; back to one: x = 0', () => {
    let s = defaultState();
    s.tunnels[0] = { x: 3, H: 22, D: 8, VL: 1.4, K: 0.5 };
    s = switchTunnels(s, 2);
    assert.equal(s.count, 2);
    assert.deepEqual(s.tunnels[0], { x: -6.75, H: 22, D: 8, VL: 1.4, K: 0.5 });
    assert.deepEqual(s.tunnels[1], { x: 6.75, H: 22, D: 8, VL: 1.4, K: 0.5 });
    s.tunnels[1].H = 35;
    const one = switchTunnels(s, 1);
    assert.equal(one.count, 1);
    assert.deepEqual(one.tunnels[0], { ...s.tunnels[0], x: 0 });
    // 2 -> 2 changes nothing
    assert.deepEqual(switchTunnels(s, 2).tunnels, s.tunnels);
});

test('building mode switch converts the values', () => {
    let s = defaultState();
    s.center = 4;
    s.L = 12;
    s = switchBuildingMode(s, 'edges');
    assert.deepEqual([s.xL, s.xR], [-2, 10]);
    s.xR = 20;
    s = switchBuildingMode(s, 'centre');
    assert.deepEqual([s.center, s.L], [9, 22]);
});

test('validation: same physical limits as checkTunnel, only active fields', () => {
    const s = defaultState();
    for (const [key, bad] of /** @type {const} */ ([['H', 0], ['D', -1], ['VL', -0.1], ['K', 0], ['x', NaN]])) {
        const t = cloneState(s);
        setPath(t, `tunnels.0.${key}`, bad);
        assert.ok(validate(t)[`tunnels.0.${key}`], key);
        const core = { ...t.tunnels[0], VL: t.tunnels[0].VL / 100 };
        assert.throws(() => checkTunnel(core), RangeError, `checkTunnel ${key}`);
    }
    // beyond the slider range is allowed
    const far = cloneState(s);
    far.tunnels[0].H = 120;
    far.tunnels[0].VL = 5;
    assert.deepEqual(validate(far), {});
    // inactive fields are not checked
    const t2 = cloneState(s);
    t2.tunnels[1].H = -5;
    t2.b = -1;
    assert.deepEqual(validate(t2), {});
    t2.fieldMode = 'width';
    assert.ok(validate(t2).b);
    const e = switchBuildingMode(s, 'edges');
    e.xR = e.xL;
    assert.ok(validate(e).xR);
    const tied = cloneState(s);
    tied.fL = NaN;
    assert.ok(validate(tied).fL);
    tied.floorsTied = true;
    assert.deepEqual(validate(tied), {});
});

test('validation: too fine grid or fields', () => {
    const s = defaultState();
    s.dx = 0.0001;
    assert.match(validate(s).dx, /Too fine/);
    s.dx = 0.1;
    s.fieldMode = 'width';
    s.b = 1e-5;
    assert.match(validate(s).b, /Too fine/);
    assert.ok(2 * Math.ceil(plotHalfWidth(defaultState()) / 0.01) + 1 < MAX_GRID_POINTS);
});

test('parseNumber: "." or ",", exponent; everything else NaN', () => {
    assert.equal(parseNumber('0.35'), 0.35);
    assert.equal(parseNumber(' 0,35 '), 0.35);
    assert.equal(parseNumber('-6.75'), -6.75);
    assert.equal(parseNumber('+3'), 3);
    assert.equal(parseNumber('.5'), 0.5);
    assert.equal(parseNumber('5.'), 5);
    assert.equal(parseNumber('1e-3'), 0.001);
    for (const bad of ['', ' ', 'abc', '1,000.5', '1.2.3', '0x10', 'Infinity', '1 000', '--1', ',']) {
        assert.ok(Number.isNaN(parseNumber(bad)), bad);
    }
});

test('plot range: trough range, widened to the building', () => {
    const s = defaultState();
    assert.equal(plotHalfWidth(s), 3 * 10.5);
    s.center = 60;
    assert.equal(plotHalfWidth(s), 70 + 1);
});

test('hash: round trip of all values', () => {
    const states = [defaultState()];
    let s = switchTunnels(defaultState(), 2);
    s.tunnels[1] = { x: 9.25, H: 31.5, D: 11, VL: 0.8, K: 0.45 };
    s = switchBuildingMode(s, 'edges');
    s.xL = -3.3;
    s.xR = 17;
    s.fieldMode = 'width';
    s.b = 2.5;
    s.floorsTied = true;
    s.dx = 0.05;
    s.legacy = true;
    states.push(s);
    for (const st of states) {
        const back = decodeHash('#' + encodeHash(st));
        for (const f of activeFields(st)) {
            assert.equal(getPath(back, f.path), getPath(st, f.path), f.path);
        }
        assert.equal(back.count, st.count);
        assert.equal(back.buildingMode, st.buildingMode);
        assert.equal(back.fieldMode, st.fieldMode);
        assert.equal(back.floorsTied, st.floorsTied);
        assert.equal(back.legacy, st.legacy);
    }
    assert.equal(encodeHash(defaultState()), 'n=1&t1=0,30,10,1,0.35&bm=c&b=0,20&fw=p&fl=1&dx=0.1');
});

test('hash: missing keys keep defaults, bad numbers become NaN (shown as invalid)', () => {
    assert.deepEqual(decodeHash(''), defaultState());
    const s = decodeHash('#n=1&t1=0,abc,10,1,0.35&b=5');
    assert.ok(Number.isNaN(s.tunnels[0].H));
    assert.ok(Number.isNaN(s.L));
    assert.equal(s.center, 5);
    assert.ok(validate(s)['tunnels.0.H']);
    // two tunnels without t2: as when switching
    const two = decodeHash('n=2&t1=0,25,9,1.2,0.4&dx=0.2');
    assert.deepEqual(two.tunnels[1], { x: 6.75, H: 25, D: 9, VL: 1.2, K: 0.4 });
    assert.equal(two.dx, 0.2);
});
