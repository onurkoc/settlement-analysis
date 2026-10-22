// @ts-check
/*
Greenfield settlement trough above one or more tunnels.

Gaussian trough (Peck 1969; O'Reilly & New 1982, sources in README), one curve per tunnel,
superposed. Displacement vectors point to the tunnel axis, so the
horizontal displacement of tunnel j is S_j·(x − x_j)/H_j towards the
axis (O'Reilly & New 1982).

Sign conventions (SI units, m and -):
- x horizontal, positive to the right; x_j axis of tunnel j.
- S settlement, positive downwards.
- S' = dS/dx.
- Sh horizontal displacement, positive in +x direction.
- eh = dSh/dx horizontal strain, extension (tension) positive.

For tunnel j with i_j = K_j·H_j and u = x − x_j:
    Smax_j = VL_j·π·D_j²/4 / (√(2π)·i_j)
    S_j    = Smax_j·exp(−u²/(2·i_j²))
    S'_j   = −S_j·u/i_j²
    Sh_j   = −S_j·u/H_j
    eh_j   = S_j/H_j·(u²/i_j² − 1)
All quantities are sums over the tunnels.
*/

/**
 * @typedef {Object} Tunnel
 * @property {number} x  axis position [m]
 * @property {number} H  axis depth below the surface [m]
 * @property {number} D  equivalent diameter [m]
 * @property {number} VL  volume loss as fraction (0.01 = 1 %)
 * @property {number} K  trough width factor [-]
 */

/**
 * @typedef {Object} TroughPoint
 * @property {number} S  settlement [m], downwards positive
 * @property {number} dS  slope dS/dx [-]
 * @property {number} Sh  horizontal displacement [m], +x positive
 * @property {number} eh  horizontal strain [-], extension positive
 */

/**
 * @typedef {Object} TroughProfile
 * @property {number} dx  grid step [m]
 * @property {number[]} x  grid [m]
 * @property {number[]} S
 * @property {number[]} dS
 * @property {number[]} Sh
 * @property {number[]} eh
 * @property {number[][]} Sj  settlement of each tunnel [m]
 */

/** Grid step of the trough [m], can be changed by the caller. */
export const DEFAULT_DX = 0.1;

/**
 * Tolerance for ceil() of a quotient of lengths: 1.1/0.1 is
 * 11.000000000000002 in floating point and must count as 11.
 */
const CEIL_TOL = 1e-9;

/**
 * ceil(a/b) with a tolerance for rounding errors of the quotient.
 * @param {number} a
 * @param {number} b
 */
export function ceilDiv(a, b) {
    return Math.ceil(a / b - CEIL_TOL);
}

/**
 * Check the input of a tunnel; throws RangeError.
 * @param {Tunnel} t
 */
export function checkTunnel(t) {
    for (const key of /** @type {const} */ (['x', 'H', 'D', 'VL', 'K'])) {
        if (!Number.isFinite(t[key])) {
            throw new RangeError(`tunnel.${key} must be a finite number, got ${t[key]}`);
        }
    }
    if (!(t.H > 0)) throw new RangeError(`tunnel.H must be > 0, got ${t.H}`);
    if (!(t.D > 0)) throw new RangeError(`tunnel.D must be > 0, got ${t.D}`);
    if (!(t.VL >= 0)) throw new RangeError(`tunnel.VL must be >= 0, got ${t.VL}`);
    if (!(t.K > 0)) throw new RangeError(`tunnel.K must be > 0, got ${t.K}`);
}

/**
 * Distance of the inflection point from the axis, i = K·H [m].
 * @param {Tunnel} t
 */
export function inflection(t) {
    return t.K * t.H;
}

/**
 * Maximum settlement above the axis [m]:
 * Smax = VL·π·D²/4 / (√(2π)·i).
 * @param {Tunnel} t
 */
export function maxSettlement(t) {
    return t.VL * Math.PI * t.D * t.D / 4 / (Math.sqrt(2 * Math.PI) * inflection(t));
}

/**
 * Settlement, slope, horizontal displacement and strain of one tunnel.
 * @param {Tunnel} t
 * @param {number} x  [m]
 * @returns {TroughPoint}
 */
export function tunnelAt(t, x) {
    const i = inflection(t);
    const u = x - t.x;
    const S = maxSettlement(t) * Math.exp(-u * u / (2 * i * i));
    return {
        S,
        dS: -S * u / (i * i),
        Sh: -S * u / t.H,
        eh: S / t.H * (u * u / (i * i) - 1),
    };
}

/**
 * Superposed trough of all tunnels at x.
 * @param {readonly Tunnel[]} tunnels
 * @param {number} x  [m]
 * @returns {TroughPoint}
 */
export function troughAt(tunnels, x) {
    let S = 0, dS = 0, Sh = 0, eh = 0;
    for (const t of tunnels) {
        const p = tunnelAt(t, x);
        S += p.S;
        dS += p.dS;
        Sh += p.Sh;
        eh += p.eh;
    }
    return { S, dS, Sh, eh };
}

/**
 * Half width of the plotted range: max|x_j| + 3·max i_j [m].
 * @param {readonly Tunnel[]} tunnels
 */
export function troughHalfWidth(tunnels) {
    let xMax = 0, iMax = 0;
    for (const t of tunnels) {
        xMax = Math.max(xMax, Math.abs(t.x));
        iMax = Math.max(iMax, inflection(t));
    }
    return xMax + 3 * iMax;
}

/**
 * Grid x_k = k·dx, k = −m ... m with m = ceil(R/dx): symmetric, contains
 * x = 0 and covers [−R, R].
 * @param {number} R  half width [m]
 * @param {number} dx  step [m]
 * @returns {number[]}
 */
export function symmetricGrid(R, dx) {
    if (!(dx > 0)) throw new RangeError(`dx must be > 0, got ${dx}`);
    const m = ceilDiv(R, dx);
    const x = [];
    for (let k = -m; k <= m; k++) {
        x.push(k * dx);
    }
    return x;
}

/**
 * Trough on the grid over ±(max|x_j| + 3·max i_j).
 * @param {readonly Tunnel[]} tunnels  one or more
 * @param {number} [dx]  grid step [m]
 * @returns {TroughProfile}
 */
export function troughProfile(tunnels, dx = DEFAULT_DX) {
    if (tunnels.length === 0) throw new RangeError('at least one tunnel is needed');
    tunnels.forEach(checkTunnel);
    const x = symmetricGrid(troughHalfWidth(tunnels), dx);
    /** @type {TroughProfile} */
    const p = { dx, x, S: [], dS: [], Sh: [], eh: [], Sj: tunnels.map(() => []) };
    for (const xx of x) {
        let S = 0, dS = 0, Sh = 0, eh = 0;
        tunnels.forEach((t, j) => {
            const q = tunnelAt(t, xx);
            p.Sj[j].push(q.S);
            S += q.S;
            dS += q.dS;
            Sh += q.Sh;
            eh += q.eh;
        });
        p.S.push(S);
        p.dS.push(dS);
        p.Sh.push(Sh);
        p.eh.push(eh);
    }
    return p;
}
