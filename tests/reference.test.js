// @ts-check
/*
app/core against the independent numpy reference
(tests/reference/make_reference.py -> reference.json), relative
tolerance 1e-9.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { troughProfile } from '../app/core/trough.js';
import { assessBuilding } from '../app/core/building.js';
import { loadJson, assertClose } from './helpers.js';

const reference = loadJson('reference.json');

for (const c of reference.cases) {
    test(`trough profile: ${c.name}`, () => {
        const p = troughProfile(c.tunnels, c.dx);
        const r = c.trough;
        assert.equal(p.x.length, r.n);
        assertClose(p.x[0], r.x0, 'x0');
        assertClose(p.x[p.x.length - 1], r.xN, 'xN');
        /** @param {number[]} a */
        const sample = (a) => a.filter((_, k) => k % r.sample === 0);
        for (const key of ['x', 'S', 'dS', 'Sh', 'eh']) {
            assertClose(sample(/** @type {any} */ (p)[key]), r[key], key);
        }
        p.Sj.forEach((s, j) => assertClose(sample(s), r.Sj[j], `Sj[${j}]`));
        assertClose(Math.max(...p.S), r.Smax, 'Smax');
    });

    for (const [option, { fieldWidth, fL }] of Object.entries(reference.options)) {
        test(`building, ${option}: ${c.name}`, () => {
            const res = assessBuilding(c.tunnels, c.building, { dx: c.dx, fieldWidth, fL });
            const r = c.result;
            for (const key of ['xL', 'xR', 'L']) {
                assertClose(/** @type {any} */ (res.edges)[key], r.edges[key], `edges.${key}`);
            }
            for (const key of ['x', 'S', 'dS', 'Sh', 'eh', 'beta']) {
                assertClose(/** @type {any} */ (res.profile)[key], r.profile[key], `profile.${key}`);
            }
            for (const key of ['delta0', 'omega', 'sMax', 'slopeMax', 'betaMax', 'ehMax']) {
                assertClose(/** @type {any} */ (res)[key], r[key], key);
            }
            assert.equal(res.screening.negligible, r.screening, 'screening');

            const f = res.fields;
            const rf = r.fields[option];
            assert.equal(f.n, rf.n, 'n');
            assert.equal(f.mode, fieldWidth === 'pointwise' ? 'pointwise' : 'fields');
            for (const key of ['b', 'bEff', 'fL']) {
                assertClose(/** @type {any} */ (f)[key], rf[key], key);
            }
            for (const key of ['xa', 'xb', 'slope', 'beta', 'epsL', 'epsLEff', 'epsP']) {
                assertClose(/** @type {any} */ (f)[key], rf[key], `fields.${key}`);
            }
            assert.equal(f.governing, rf.governing, 'governing field');
            assert.equal(res.category.level, rf.category.level, 'category');
            assert.equal(res.category.name, rf.category.name, 'category name');
        });
    }
}
