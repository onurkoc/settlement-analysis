// @ts-check
/*
From the state (app/state.js) to the results shown and exported:
calls app/core/, no DOM.
*/
import { tunnelAt, inflection, symmetricGrid } from './core/trough.js';
import { assessBuilding } from './core/building.js';
import { percentToFraction, formatMm, formatE3, formatSlopeN, slopeToN } from './core/units.js';
import { plotHalfWidth, axisPositions } from './state.js';

/** @typedef {import('./state.js').State} State */
/** @typedef {import('./core/trough.js').Tunnel} Tunnel */
/** @typedef {import('./core/building.js').BuildingResult} BuildingResult */

/**
 * @typedef {Object} Result
 * @property {Tunnel[]} tunnels  SI input of the core
 * @property {number} R  half width of the plotted range [m]
 * @property {{x: number[], Sj: number[][], S: number[], dS: number[], Sh: number[], eh: number[], Smax: number}} trough
 * @property {BuildingResult} building
 * @property {{tunnel: number, x: number, S: number}[]} inflections
 *     x_j ± i_j with the settlement of the curve they belong to (the
 *     tunnel's own curve; the combined one for a single tunnel)
 */

/**
 * @typedef {Object} SummaryRow
 * @property {string} section
 * @property {string} key  CSV name
 * @property {string} label
 * @property {string} text  formatted for display
 * @property {string} unit  display unit
 * @property {number | string} si  value for the CSV (SI units)
 * @property {string} siUnit
 * @property {'ok' | 'fail'} [status]
 * @property {number} [level]  damage category level
 * @property {boolean} [hidden]  CSV only, not shown in the panel
 */

/**
 * Tunnels in SI units (VL as fraction) for app/core/, with the fixed
 * axis positions x = 0 or ±c/2.
 * @param {State} s
 * @returns {Tunnel[]}
 */
export function coreTunnels(s) {
    const xs = axisPositions(s);
    return s.tunnels.slice(0, s.count).map((t, j) => ({ x: xs[j], ...t, VL: percentToFraction(t.VL) }));
}

/**
 * Calculate everything for a valid state (see validate()).
 * @param {State} s
 * @returns {Result}
 */
export function compute(s) {
    const tunnels = coreTunnels(s);
    const R = plotHalfWidth(s);
    // same grid rule as troughProfile(), over the plotted range
    const x = symmetricGrid(R, s.dx);
    const Sj = tunnels.map(() => /** @type {number[]} */ ([]));
    const S = [], dS = [], Sh = [], eh = [];
    for (const xx of x) {
        let a = 0, b = 0, c = 0, d = 0;
        tunnels.forEach((t, j) => {
            const p = tunnelAt(t, xx);
            Sj[j].push(p.S);
            a += p.S;
            b += p.dS;
            c += p.Sh;
            d += p.eh;
        });
        S.push(a);
        dS.push(b);
        Sh.push(c);
        eh.push(d);
    }
    const building = assessBuilding(
        tunnels,
        s.buildingMode === 'centre' ? { center: s.center, L: s.L } : { xL: s.xL, xR: s.xR },
        { dx: s.dx, fieldWidth: s.fieldMode === 'pointwise' ? 'pointwise' : s.b, fL: s.floorsTied ? 0 : s.fL },
    );
    const inflections = tunnels.flatMap((t, j) => {
        const i = inflection(t);
        return [t.x - i, t.x + i].map((xi) => ({ tunnel: j, x: xi, S: tunnelAt(t, xi).S }));
    });
    return { tunnels, R, trough: { x, Sj, S, dS, Sh, eh, Smax: Math.max(...S) }, building, inflections };
}

/**
 * Location of a field as text, e.g. "−10.00 … −9.90".
 * @param {number} a
 * @param {number} b
 */
export function formatRange(a, b) {
    /** @param {number} v */
    const f = (v) => v.toFixed(2).replace('-', '−');
    return `${f(a)} … ${f(b)}`;
}

/**
 * Text of the field mode, e.g. "Pointwise (b = Δx = 0.1 m)" or
 * "Fields, b_eff = 5.00 m, n = 4".
 * @param {BuildingResult} b
 */
export function modeText(b) {
    const f = b.fields;
    return f.mode === 'pointwise'
        ? `Pointwise (b = Δx = ${f.b} m)`
        : `Fields, b_eff = ${f.bEff.toFixed(2)} m, n = ${f.n}`;
}

/**
 * Rows of the result panel and of the CSV section "Results".
 * Formats: mm with 2 decimals, ×10⁻³ with 3, 1/n as integer.
 * @param {State} s
 * @param {Result} r
 * @returns {SummaryRow[]}
 */
export function summaryRows(s, r) {
    const b = r.building;
    const g = b.governing;
    const sc = b.screening;
    /** @type {SummaryRow[]} */
    const rows = [];
    /**
     * @param {string} section @param {string} key @param {string} label
     * @param {string} text @param {string} unit @param {number | string} si @param {string} siUnit
     * @param {Partial<SummaryRow>} [extra]
     */
    const add = (section, key, label, text, unit, si, siUnit, extra = {}) => {
        rows.push({ section, key, label, text, unit, si, siUnit, ...extra });
    };
    const T = 'Trough and building';
    add(T, 'S_max_total', 'S_max total', formatMm(r.trough.Smax), 'mm', r.trough.Smax, 'm');
    add(T, 'S_max_building', 'S_max in building', formatMm(b.sMax), 'mm', b.sMax, 'm');
    add(T, 'slope_max_building', 'Max. slope in building', formatSlopeN(slopeToN(b.slopeMax)), '-', b.slopeMax, '-');
    add(T, 'delta_0', 'δ0 = S(xR) − S(xL)', formatMm(b.delta0), 'mm', b.delta0, 'm');
    add(T, 'omega', 'Tilt Ω = δ0 / L', formatE3(b.omega), '×10⁻³', b.omega, '-');
    add(T, 'beta_max_pointwise', 'β_max (pointwise)', formatE3(b.betaMax), '×10⁻³', b.betaMax, '-');
    add(T, 'eps_h_max_pointwise', 'ε_h,max tension (pointwise)', formatE3(b.ehMax), '×10⁻³', b.ehMax, '-');

    const G = 'Governing field';
    add(G, 'field_xa', 'Location', formatRange(g.xa, g.xb), 'm', g.xa, 'm');
    rows.push({ ...rows[rows.length - 1], key: 'field_xb', si: g.xb, hidden: true });
    add(G, 'beta', 'Angular distortion β', formatE3(g.beta), '×10⁻³', g.beta, '-');
    add(G, 'eps_L', 'Lateral strain ε_L', formatE3(g.epsL), '×10⁻³', g.epsL, '-');
    add(G, 'eps_L_eff', 'ε_L,eff = f_L·max(0, ε_L)', formatE3(g.epsLEff), '×10⁻³', g.epsLEff, '-');
    add(G, 'eps_p', 'Principal strain ε_p', formatE3(g.epsP), '×10⁻³', g.epsP, '-');
    add(G, 'category', 'Category',
        `${b.category.label} – ${b.category.name} (typ. crack width ${b.category.crack})`, '',
        `${b.category.label} ${b.category.name}`, '', { level: b.category.level });

    const M = 'Assessment';
    add(M, 'mode', 'Mode', modeText(b), '', b.fields.mode === 'pointwise' ? 'pointwise' : 'fields', '');
    add(M, 'b_eff', 'Field width b_eff', b.fields.bEff.toFixed(3), 'm', b.fields.bEff, 'm', { hidden: true });
    add(M, 'f_L', 'f_L', `${b.fields.fL}${s.floorsTied ? ' (floors tied / grade beam)' : ''}`, '-', b.fields.fL, '-');

    const R1 = 'Screening, stage 1 (Rankin 1988)';
    add(R1, 'screening_slope', 'Max. slope θ < 1/500', formatSlopeN(slopeToN(sc.slopeMax)), '-',
        sc.slopeMax, '-', { status: sc.slopeMax < sc.slopeLimit ? 'ok' : 'fail' });
    add(R1, 'screening_settlement', 'S_v,max < 10 mm', formatMm(sc.sMax), 'mm',
        sc.sMax, 'm', { status: sc.sMax < sc.sLimit ? 'ok' : 'fail' });
    add(R1, 'screening_result', 'Result', sc.negligible ? 'Negligible' : 'Second stage required', '',
        sc.negligible ? 'negligible' : 'second stage required', '', { status: sc.negligible ? 'ok' : 'fail' });
    return rows;
}
