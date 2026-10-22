// @ts-check
/*
Building on the greenfield trough: deformation quantities, structural
units ("fields"), damage category and first-stage screening.

Assumptions (see README, section Method):
- The building follows the greenfield trough (no soil-structure
  interaction).
- Tilt Ω = (S(xR) − S(xL)) / L: slope of the chord over the whole
  building (beam assumption, Cording et al. 2010, Fig. 5b). The real
  tilt can be smaller (Fig. 5a), then β is larger.
- The building [xL, xR] is divided into n = ceil(L/b) fields of equal
  width b_eff = L/n (structural bays or units, Cording et al. 2010).
  For field k with edges a_k, a_k+1:
      slope_k = (S(a_k+1) − S(a_k)) / b_eff
      β_k     = |slope_k − Ω|                angular distortion
      εL_k    = (Sh(a_k+1) − Sh(a_k)) / b_eff  lateral strain, extension +
      εL,eff  = f_L · max(0, εL_k)             compression does not count
      εp_k    = εp(β_k, εL,eff)                principal strain (damage.js)
  The governing field has the largest εp; on a tie (relative 1e-12)
  the first one from the left.
- "Pointwise" means b = Δx (grid step), the limit b -> 0 in which β_k
  and εL_k become |S'(x) − Ω| and εh(x). A field width is needed: with
  one field over the whole building (b = L) the slope equals the tilt
  and β = 0 for any trough.
- f_L reduces the lateral strain; f_L = 0 for floors tied to the walls
  or a grade beam (Cording et al. 2010, Fig. 2), then εp = β/2.
- Screening: first stage of the three-stage assessment after Mair et
  al. (1996), limits after Rankin (1988), both as given by Franzius
  (2003), §2.4.2: maximum slope θ < 1/500 and maximum settlement
  S_v,max < 10 mm at the building ⇒ negligible risk of damage.
*/
import { troughAt, ceilDiv, checkTunnel, DEFAULT_DX } from './trough.js';
import { principalStrain, damageCategory } from './damage.js';

/** @typedef {import('./trough.js').Tunnel} Tunnel */
/** @typedef {import('./damage.js').DamageCategory} DamageCategory */

/**
 * Building given by its centre and width, or by its edges.
 * @typedef {{center: number, L: number} | {xL: number, xR: number}} BuildingInput
 */

/**
 * @typedef {Object} BuildingEdges
 * @property {number} xL  left edge [m]
 * @property {number} xR  right edge [m]
 * @property {number} L  width [m]
 */

/**
 * @typedef {Object} AssessOptions
 * @property {number} [dx]  grid step [m], default 0.1
 * @property {'pointwise' | number} [fieldWidth]  field width b [m] or
 *     'pointwise' (b = dx), default 'pointwise'
 * @property {number} [fL]  factor on the lateral strain, default 1;
 *     0 for floors tied / grade beam
 */

/**
 * @typedef {Object} Fields
 * @property {'pointwise' | 'fields'} mode
 * @property {number} b  requested field width [m] (dx if pointwise)
 * @property {number} bEff  field width used, L/n [m]
 * @property {number} n  number of fields
 * @property {number} fL
 * @property {number[]} xa  left edge of each field [m]
 * @property {number[]} xb  right edge [m]
 * @property {number[]} slope  [-]
 * @property {number[]} beta  angular distortion [-]
 * @property {number[]} epsL  lateral strain [-], extension positive
 * @property {number[]} epsLEff  f_L·max(0, epsL) [-]
 * @property {number[]} epsP  principal extension strain [-]
 * @property {number} governing  index of the field with max epsP
 */

/**
 * @typedef {Object} Screening
 * @property {number} slopeMax  max |S'| in the building [-]
 * @property {number} sMax  max settlement in the building [m]
 * @property {number} slopeLimit  1/500
 * @property {number} sLimit  0.010 m
 * @property {boolean} negligible  both below the limits
 * @property {string} source
 */

/**
 * @typedef {Object} BuildingResult
 * @property {BuildingEdges} edges
 * @property {{x: number[], S: number[], dS: number[], Sh: number[], eh: number[], beta: number[]}} profile
 *     values on the building grid; beta = S' − Ω (with sign)
 * @property {number} delta0  S(xR) − S(xL) [m]
 * @property {number} omega  tilt Ω = delta0/L [-]
 * @property {number} sMax  max settlement in the building [m]
 * @property {number} slopeMax  max |S'| in the building [-]
 * @property {number} betaMax  max |S' − Ω| on the grid [-]
 * @property {number} ehMax  max tensile strain eh, >= 0 [-]
 * @property {Fields} fields
 * @property {{index: number, xa: number, xb: number, beta: number, epsL: number, epsLEff: number, epsP: number}} governing
 * @property {DamageCategory} category  of the governing field
 * @property {Screening} screening
 */

export const RANKIN = Object.freeze({
    slopeLimit: 1 / 500,
    sLimit: 0.010,
    source: 'Rankin (1988), as given by Franzius (2003), §2.4.2.1',
});

/**
 * Edges of the building; throws RangeError for L <= 0.
 * @param {BuildingInput} b
 * @returns {BuildingEdges}
 */
export function buildingEdges(b) {
    let xL, xR;
    if ('center' in b) {
        xL = b.center - b.L / 2;
        xR = b.center + b.L / 2;
    } else {
        xL = b.xL;
        xR = b.xR;
    }
    if (!Number.isFinite(xL) || !Number.isFinite(xR)) {
        throw new RangeError('building edges must be finite numbers');
    }
    if (!(xR > xL)) {
        throw new RangeError(`building width must be > 0 (xL = ${xL}, xR = ${xR})`);
    }
    return { xL, xR, L: xR - xL };
}

/**
 * n + 1 equally spaced points from a to b, both ends exact.
 * @param {number} a
 * @param {number} b
 * @param {number} n  number of intervals (>= 1)
 * @returns {number[]}
 */
function divide(a, b, n) {
    const h = (b - a) / n;
    const x = [];
    for (let k = 0; k < n; k++) {
        x.push(a + k * h);
    }
    x.push(b);
    return x;
}

/**
 * Grid of the building from xL to xR, both edges included:
 * ceil(L/dx) + 1 points, step L/ceil(L/dx) <= dx.
 * @param {number} xL
 * @param {number} xR
 * @param {number} dx
 * @returns {number[]}
 */
export function buildingGrid(xL, xR, dx) {
    if (!(dx > 0)) throw new RangeError(`dx must be > 0, got ${dx}`);
    return divide(xL, xR, Math.max(1, ceilDiv(xR - xL, dx)));
}

/** Relative tolerance for equal principal strains of two fields. */
const TIE_TOL = 1e-12;

/**
 * Index of the governing field: the first one whose principal strain
 * is within a relative 1e-12 of the maximum. Ties are real: with two
 * fields Ω is the mean of both field slopes, so β_1 = β_2 exactly, and
 * only rounding would decide.
 * @param {number[]} epsP
 */
export function governingIndex(epsP) {
    const max = Math.max(...epsP);
    return epsP.findIndex((e) => e >= max * (1 - TIE_TOL));
}

/**
 * Fields of width b over the building, see the header.
 * @param {readonly Tunnel[]} tunnels
 * @param {BuildingEdges} edges
 * @param {number} omega  tilt [-]
 * @param {'pointwise' | number} fieldWidth
 * @param {number} dx
 * @param {number} fL
 * @returns {Fields}
 */
export function buildingFields(tunnels, edges, omega, fieldWidth, dx, fL) {
    const pointwise = fieldWidth === 'pointwise';
    const b = pointwise ? dx : fieldWidth;
    if (!(typeof b === 'number' && b > 0 && Number.isFinite(b))) {
        throw new RangeError(`field width must be > 0 or 'pointwise', got ${fieldWidth}`);
    }
    if (!(fL >= 0) || !Number.isFinite(fL)) {
        throw new RangeError(`fL must be >= 0, got ${fL}`);
    }
    const n = Math.max(1, ceilDiv(edges.L, b));
    const bEff = edges.L / n;
    const a = divide(edges.xL, edges.xR, n);
    const p = a.map((x) => troughAt(tunnels, x));
    /** @type {Fields} */
    const f = {
        mode: pointwise ? 'pointwise' : 'fields', b, bEff, n, fL,
        xa: [], xb: [], slope: [], beta: [], epsL: [], epsLEff: [], epsP: [], governing: 0,
    };
    for (let k = 0; k < n; k++) {
        const slope = (p[k + 1].S - p[k].S) / bEff;
        const beta = Math.abs(slope - omega);
        const epsL = (p[k + 1].Sh - p[k].Sh) / bEff;
        const epsLEff = fL * Math.max(0, epsL);
        const epsP = principalStrain(beta, epsLEff);
        f.xa.push(a[k]);
        f.xb.push(a[k + 1]);
        f.slope.push(slope);
        f.beta.push(beta);
        f.epsL.push(epsL);
        f.epsLEff.push(epsLEff);
        f.epsP.push(epsP);
    }
    f.governing = governingIndex(f.epsP);
    return f;
}

/**
 * First-stage screening after Rankin (1988).
 * @param {number} slopeMax  max |S'| in the building [-]
 * @param {number} sMax  max settlement in the building [m]
 * @returns {Screening}
 */
export function screening(slopeMax, sMax) {
    return {
        slopeMax,
        sMax,
        slopeLimit: RANKIN.slopeLimit,
        sLimit: RANKIN.sLimit,
        negligible: slopeMax < RANKIN.slopeLimit && sMax < RANKIN.sLimit,
        source: RANKIN.source,
    };
}

/**
 * Full assessment of a building on the trough of the given tunnels.
 * @param {readonly Tunnel[]} tunnels
 * @param {BuildingInput} building
 * @param {AssessOptions} [options]
 * @returns {BuildingResult}
 */
export function assessBuilding(tunnels, building, options = {}) {
    const { dx = DEFAULT_DX, fieldWidth = 'pointwise', fL = 1 } = options;
    if (tunnels.length === 0) throw new RangeError('at least one tunnel is needed');
    tunnels.forEach(checkTunnel);
    const edges = buildingEdges(building);

    const x = buildingGrid(edges.xL, edges.xR, dx);
    const pts = x.map((xx) => troughAt(tunnels, xx));
    const S = pts.map((q) => q.S);
    const dS = pts.map((q) => q.dS);
    const delta0 = S[S.length - 1] - S[0];
    const omega = delta0 / edges.L;
    const beta = dS.map((d) => d - omega);
    const eh = pts.map((q) => q.eh);

    const sMax = Math.max(...S);
    const slopeMax = Math.max(...dS.map(Math.abs));
    const fields = buildingFields(tunnels, edges, omega, fieldWidth, dx, fL);
    const g = fields.governing;
    return {
        edges,
        profile: { x, S, dS, Sh: pts.map((q) => q.Sh), eh, beta },
        delta0,
        omega,
        sMax,
        slopeMax,
        betaMax: Math.max(...beta.map(Math.abs)),
        ehMax: Math.max(0, ...eh),
        fields,
        governing: {
            index: g, xa: fields.xa[g], xb: fields.xb[g], beta: fields.beta[g],
            epsL: fields.epsL[g], epsLEff: fields.epsLEff[g], epsP: fields.epsP[g],
        },
        category: damageCategory(fields.epsP[g]),
        screening: screening(slopeMax, sMax),
    };
}
