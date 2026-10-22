// @ts-check
/*
Damage criterion: maximum principal extension strain from angular
distortion and lateral strain (state of strain at a point, Cording et
al. 2010, Fig. 2 and 3), damage categories, limit curves, and the
limit parabolas of the legacy apps (Boscardin & Cording 1989) for an
optional comparison.

Sources
- Cording, E.J., Long, J.L., Son, M., Laefer, D., Ghahreman, B. (2010):
  Assessment of excavation-induced building damage. Earth Retention
  Conference 3, ASCE, doi:10.1061/41128(384)7.
- Franzius, J.N. (2003): Behaviour of buildings due to tunnel induced
  subsidence. PhD thesis, Imperial College London. Tab. 2.2, 2.3.
- Boscardin, M.D., Cording, E.J. (1989): Building response to
  excavation-induced settlement. J. Geotech. Eng. 115(1), 1-21.
*/

/**
 * @typedef {Object} DamageCategory
 * @property {number} level  0 ... 4 (4 stands for "4 to 5")
 * @property {string} label  category number as text, "0" ... "4–5"
 * @property {string} name
 * @property {number} upper  limiting tensile strain [-]: the category
 *     holds strains below this value (Infinity for the last one)
 * @property {string} crack  typical crack width, additional
 *     information only (Burland 2008: classify by ease of repair, not
 *     by crack width)
 */

/**
 * Limiting tensile strains of the damage categories.
 *
 * Franzius (2003), Tab. 2.3, after Boscardin & Cording (1989) and
 * Burland (1995): 0.05 / 0.075 / 0.15 / 0.3 %. Crack widths after
 * Cording et al. (2010), Fig. 2, and Franzius (2003), Tab. 2.2.
 *
 * The limit curves drawn in Cording et al. (2010), Fig. 2 deviate
 * slightly from these values at the upper two boundaries (slight /
 * moderate and moderate / severe). The table values are used on
 * purpose.
 *
 * A strain equal to a limit belongs to the higher category (the
 * limits are exclusive upper bounds).
 */
export const DAMAGE_LIMITS = Object.freeze({
    source: 'Franzius (2003), Tab. 2.3, after Boscardin & Cording (1989) and Burland (1995)',
    categories: /** @type {readonly DamageCategory[]} */ (Object.freeze([
        Object.freeze({ level: 0, label: '0', name: 'Negligible', upper: 0.0005, crack: '< 0.1 mm' }),
        Object.freeze({ level: 1, label: '1', name: 'Very slight', upper: 0.00075, crack: '< 1 mm' }),
        Object.freeze({ level: 2, label: '2', name: 'Slight', upper: 0.0015, crack: '1–5 mm' }),
        Object.freeze({ level: 3, label: '3', name: 'Moderate', upper: 0.003, crack: '5–15 mm' }),
        Object.freeze({ level: 4, label: '4–5', name: 'Severe to very severe', upper: Infinity, crack: '> 15 mm' }),
    ])),
});

/**
 * Maximum principal extension strain of a structural unit with angular
 * distortion beta and lateral strain epsL (Cording et al. 2010, Fig. 3).
 *
 * Derivation: beta is a shear strain (gamma = beta), epsL a normal
 * strain along the base. The normal strain in a direction at the angle
 * theta to the base is
 *     eps(theta) = epsL·cos²θ + beta·sinθ·cosθ
 *                = epsL/2 + epsL/2·cos2θ + beta/2·sin2θ.
 * d eps/dθ = −epsL·sin2θ + beta·cos2θ = 0 gives tan2θ = beta/epsL
 * (Fig. 3), and the maximum is the amplitude of the harmonic part:
 *     eps_p = epsL/2 + sqrt((epsL/2)² + (beta/2)²).
 * Special cases: eps_p(0, eps) = eps (θ = 0), eps_p(beta, 0) = beta/2
 * (θ = 45°, "floors tied or grade beam" in Fig. 2).
 * tests/damage.test.js compares this with a numerical maximum over θ.
 *
 * @param {number} beta  angular distortion [-] (>= 0)
 * @param {number} epsL  lateral strain [-], extension positive
 * @returns {number}
 */
export function principalStrain(beta, epsL) {
    const a = epsL / 2;
    const b = beta / 2;
    return a + Math.sqrt(a * a + b * b);
}

/**
 * Damage category of a principal extension strain.
 * @param {number} epsP  [-]
 * @returns {DamageCategory}
 */
export function damageCategory(epsP) {
    if (!(epsP >= 0)) {
        throw new RangeError(`principal strain must be >= 0, got ${epsP}`);
    }
    for (const c of DAMAGE_LIMITS.categories) {
        if (epsP < c.upper) {
            return c;
        }
    }
    // not reached, the last upper limit is Infinity
    return DAMAGE_LIMITS.categories[DAMAGE_LIMITS.categories.length - 1];
}

/**
 * Line of constant principal strain in the (beta, epsL) plane:
 * for beta in [0, 2·epsP] is epsL = (epsP² − beta²/4) / epsP.
 * @param {number} epsP  limit [-] (> 0)
 * @param {number} [n]  number of points (>= 2)
 * @returns {{beta: number[], epsL: number[]}}
 */
export function limitCurve(epsP, n = 101) {
    if (!(epsP > 0) || !Number.isFinite(epsP)) {
        throw new RangeError(`limit must be finite and > 0, got ${epsP}`);
    }
    const beta = [];
    const epsL = [];
    for (let k = 0; k < n; k++) {
        const b = k === n - 1 ? 2 * epsP : 2 * epsP * k / (n - 1);
        beta.push(b);
        epsL.push(k === n - 1 ? 0 : (epsP * epsP - b * b / 4) / epsP);
    }
    return { beta, epsL };
}

/**
 * Limit curves of all categories with a finite upper limit.
 * @param {number} [n]
 * @returns {{category: DamageCategory, beta: number[], epsL: number[]}[]}
 */
export function limitCurves(n = 101) {
    return DAMAGE_LIMITS.categories
        .filter((c) => Number.isFinite(c.upper))
        .map((c) => ({ category: c, ...limitCurve(c.upper, n) }));
}

/**
 * End points (beta0, eps0) of the limit parabolas of the legacy apps
 * (Boscardin & Cording 1989, as digitized in the earlier repository
 * onurkoc/boscardin-cording, draw_plotly.py).
 */
export const LEGACY_PARABOLAS = Object.freeze([
    Object.freeze({ name: 'Negligible', beta0: 0.001, eps0: 0.0005 }),
    Object.freeze({ name: 'Very slight', beta0: 0.0016, eps0: 0.00075 }),
    Object.freeze({ name: 'Slight', beta0: 0.0032, eps0: 0.0015 }),
    Object.freeze({ name: 'Moderate', beta0: 0.0068, eps0: 0.003 }),
]);

/**
 * Limit parabolas of the legacy apps, for comparison only.
 *
 * settlement.py (boscardin-cording) fits scipy's CubicSpline through
 * (0, eps0), (beta0/2 + inc, eps0/2 + inc) and (beta0, 0) with
 * inc = beta0/15 and evaluates it at x = 0, inc, ..., 15·inc (16
 * points). A not-a-knot cubic spline through three points is the
 * unique parabola through them; it is evaluated here in Lagrange form.
 * (The middle point adds inc, a value of beta, to a strain: kept as in
 * the original.)
 *
 * @returns {{name: string, beta0: number, eps0: number, beta: number[], epsL: number[]}[]}
 */
export function legacyCurves() {
    return LEGACY_PARABOLAS.map(({ name, beta0, eps0 }) => {
        const inc = beta0 / 15;
        const px = [0, beta0 / 2 + inc, beta0];
        const py = [eps0, eps0 / 2 + inc, 0];
        /** @param {number} x */
        const parabola = (x) => {
            let y = 0;
            for (let j = 0; j < 3; j++) {
                let l = 1;
                for (let m = 0; m < 3; m++) {
                    if (m !== j) {
                        l *= (x - px[m]) / (px[j] - px[m]);
                    }
                }
                y += py[j] * l;
            }
            return y;
        };
        const beta = [];
        const epsL = [];
        for (let k = 0; k < 16; k++) {
            beta.push(k * inc);
            epsL.push(parabola(k * inc));
        }
        return { name, beta0, eps0, beta, epsL };
    });
}
