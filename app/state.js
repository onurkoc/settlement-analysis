// @ts-check
/*
State of the calculator: defaults, input fields, validation and the
URL hash. No DOM.

The state holds the values as typed (display units: VL in %); a value
that cannot be read is NaN and fails the validation. app/model.js
converts the state to the SI input of app/core/.
*/

/**
 * @typedef {Object} TunnelInput
 * @property {number} x  axis position [m]
 * @property {number} H  axis depth [m]
 * @property {number} D  equivalent diameter [m]
 * @property {number} VL  volume loss [%]
 * @property {number} K  trough width factor [-]
 */

/**
 * @typedef {Object} State
 * @property {1 | 2} count  number of tunnels
 * @property {TunnelInput[]} tunnels  always two entries; the second is
 *     used only if count = 2
 * @property {'centre' | 'edges'} buildingMode
 * @property {number} center  [m]
 * @property {number} L  width [m]
 * @property {number} xL  left edge [m]
 * @property {number} xR  right edge [m]
 * @property {'pointwise' | 'width'} fieldMode
 * @property {number} b  field width [m], used if fieldMode = 'width'
 * @property {boolean} floorsTied  f_L = 0
 * @property {number} fL  factor on the lateral strain [-]
 * @property {number} dx  grid step [m]
 * @property {boolean} legacy  show the legacy curves
 */

/**
 * @typedef {Object} FieldSpec
 * @property {string} path  'tunnels.0.x', 'center', ...
 * @property {string} label
 * @property {string} unit
 * @property {number} min  slider range
 * @property {number} max
 * @property {number} step
 * @property {(v: number, s: State) => string | null} check  error text or null
 */

export const DEFAULT_TUNNEL = Object.freeze({ x: 0, H: 30, D: 10, VL: 1.0, K: 0.35 });

/** Axis distance when switching to two tunnels [m]. */
export const TWO_TUNNEL_DISTANCE = 13.5;

/** Limits of the number of points, against a frozen browser. */
export const MAX_GRID_POINTS = 200001;
export const MAX_FIELDS = 100000;

/** @returns {State} */
export function defaultState() {
    return {
        count: 1,
        tunnels: [{ ...DEFAULT_TUNNEL }, { ...DEFAULT_TUNNEL, x: TWO_TUNNEL_DISTANCE / 2 }],
        buildingMode: 'centre',
        center: 0,
        L: 20,
        xL: -10,
        xR: 10,
        fieldMode: 'pointwise',
        b: 5,
        floorsTied: false,
        fL: 1,
        dx: 0.1,
        legacy: false,
    };
}

/**
 * Copy of a state (the tunnels are copied too).
 * @param {State} s
 * @returns {State}
 */
export function cloneState(s) {
    return { ...s, tunnels: s.tunnels.map((t) => ({ ...t })) };
}

/** @param {number} v */
const finite = (v) => (Number.isFinite(v) ? null : 'Enter a number');
/** @param {number} v */
const positive = (v) => (Number.isFinite(v) && v > 0 ? null : 'Must be > 0');
/** @param {number} v */
const nonNegative = (v) => (Number.isFinite(v) && v >= 0 ? null : 'Must be ≥ 0');

/**
 * Input fields of one tunnel (j = 0 or 1).
 * @param {number} j
 * @returns {FieldSpec[]}
 */
export function tunnelFields(j) {
    const p = `tunnels.${j}.`;
    return [
        { path: p + 'x', label: 'Axis position x', unit: 'm', min: -50, max: 50, step: 0.25, check: finite },
        { path: p + 'H', label: 'Axis depth H', unit: 'm', min: 5, max: 60, step: 0.5, check: positive },
        { path: p + 'D', label: 'Equivalent diameter D', unit: 'm', min: 2, max: 20, step: 0.1, check: positive },
        { path: p + 'VL', label: 'Volume loss VL', unit: '%', min: 0.1, max: 3, step: 0.05, check: nonNegative },
        { path: p + 'K', label: 'Trough width factor K', unit: '-', min: 0.2, max: 0.9, step: 0.01, check: positive },
    ];
}

/** @type {FieldSpec[]} */
export const BUILDING_CENTRE_FIELDS = [
    { path: 'center', label: 'Centre', unit: 'm', min: -60, max: 60, step: 0.5, check: finite },
    { path: 'L', label: 'Width L', unit: 'm', min: 1, max: 100, step: 0.5, check: positive },
];

/** @type {FieldSpec[]} */
export const BUILDING_EDGE_FIELDS = [
    { path: 'xL', label: 'Left edge', unit: 'm', min: -80, max: 80, step: 0.5, check: finite },
    {
        path: 'xR', label: 'Right edge', unit: 'm', min: -80, max: 80, step: 0.5,
        check: (v, s) => finite(v) ?? (Number.isFinite(s.xL) && v <= s.xL ? 'Must be > left edge' : null),
    },
];

/** @type {FieldSpec} */
export const FIELD_WIDTH_FIELD = { path: 'b', label: 'Field width b', unit: 'm', min: 0.5, max: 20, step: 0.5, check: positive };

/** @type {FieldSpec} */
export const FL_FIELD = { path: 'fL', label: 'Lateral strain factor f_L', unit: '-', min: 0, max: 1, step: 0.05, check: nonNegative };

/** @type {FieldSpec} */
export const DX_FIELD = { path: 'dx', label: 'Grid step Δx', unit: 'm', min: 0.01, max: 1, step: 0.01, check: positive };

/**
 * Value at a path such as 'tunnels.1.H'.
 * @param {State} s
 * @param {string} path
 * @returns {any}
 */
export function getPath(s, path) {
    return path.split('.').reduce((/** @type {any} */ o, k) => o[k], s);
}

/**
 * Set the value at a path (in place).
 * @param {State} s
 * @param {string} path
 * @param {any} value
 */
export function setPath(s, path, value) {
    const keys = path.split('.');
    const last = /** @type {string} */ (keys.pop());
    const o = keys.reduce((/** @type {any} */ obj, k) => obj[k], s);
    o[last] = value;
}

/**
 * The fields that are active in this state.
 * @param {State} s
 * @returns {FieldSpec[]}
 */
export function activeFields(s) {
    const fields = [...tunnelFields(0)];
    if (s.count === 2) fields.push(...tunnelFields(1));
    fields.push(...(s.buildingMode === 'centre' ? BUILDING_CENTRE_FIELDS : BUILDING_EDGE_FIELDS));
    if (s.fieldMode === 'width') fields.push(FIELD_WIDTH_FIELD);
    if (!s.floorsTied) fields.push(FL_FIELD);
    fields.push(DX_FIELD);
    return fields;
}

/**
 * Edges of the building from the state (centre/width or edges).
 * @param {State} s
 * @returns {{xL: number, xR: number}}
 */
export function edgesOf(s) {
    return s.buildingMode === 'centre'
        ? { xL: s.center - s.L / 2, xR: s.center + s.L / 2 }
        : { xL: s.xL, xR: s.xR };
}

/**
 * Half width of the plotted x range [m]: ±(max|x_j| + 3·max i_j) as in
 * app/core/trough.js, widened so that the building lies inside with a
 * margin of 5 % of its width (at least 1 m).
 * @param {State} s
 */
export function plotHalfWidth(s) {
    const tunnels = s.tunnels.slice(0, s.count);
    let R = Math.max(...tunnels.map((t) => Math.abs(t.x))) + 3 * Math.max(...tunnels.map((t) => t.K * t.H));
    const { xL, xR } = edgesOf(s);
    const margin = Math.max(1, 0.05 * (xR - xL));
    return Math.max(R, Math.abs(xL) + margin, Math.abs(xR) + margin);
}

/**
 * Check all active fields; also limits the number of grid points and
 * fields (a very small Δx or b would freeze the browser).
 * @param {State} s
 * @returns {Record<string, string>}  path -> error text; empty if valid
 */
export function validate(s) {
    /** @type {Record<string, string>} */
    const errors = {};
    for (const f of activeFields(s)) {
        const msg = f.check(getPath(s, f.path), s);
        if (msg) errors[f.path] = msg;
    }
    if (Object.keys(errors).length > 0) return errors;
    const { xL, xR } = edgesOf(s);
    const points = 2 * Math.ceil(plotHalfWidth(s) / s.dx) + 1;
    if (points > MAX_GRID_POINTS) {
        errors.dx = `Too fine: ${points} grid points (max. ${MAX_GRID_POINTS})`;
    }
    const b = s.fieldMode === 'width' ? s.b : s.dx;
    const fields = Math.ceil((xR - xL) / b);
    if (fields > MAX_FIELDS) {
        errors[s.fieldMode === 'width' ? 'b' : 'dx'] = `Too fine: ${fields} fields (max. ${MAX_FIELDS})`;
    }
    return errors;
}

/**
 * Switch the number of tunnels. 1 -> 2: tunnel 1 at −6.75 m, tunnel 2 at
 * +6.75 m, the other values of tunnel 2 copied from tunnel 1. 2 -> 1:
 * tunnel 1 keeps H, D, VL, K and moves to x = 0.
 * @param {State} s
 * @param {1 | 2} count
 * @returns {State}
 */
export function switchTunnels(s, count) {
    const next = cloneState(s);
    if (count === 2 && s.count === 1) {
        const t = next.tunnels[0];
        next.tunnels[0] = { ...t, x: -TWO_TUNNEL_DISTANCE / 2 };
        next.tunnels[1] = { ...t, x: TWO_TUNNEL_DISTANCE / 2 };
    } else if (count === 1 && s.count === 2) {
        next.tunnels[0] = { ...next.tunnels[0], x: 0 };
    }
    next.count = count;
    return next;
}

/**
 * Switch between centre/width and edges, converting the values (if
 * they are valid).
 * @param {State} s
 * @param {'centre' | 'edges'} mode
 * @returns {State}
 */
export function switchBuildingMode(s, mode) {
    const next = cloneState(s);
    if (mode === s.buildingMode) return next;
    if (mode === 'edges' && Number.isFinite(s.center) && s.L > 0) {
        next.xL = s.center - s.L / 2;
        next.xR = s.center + s.L / 2;
    } else if (mode === 'centre' && Number.isFinite(s.xL) && s.xR > s.xL) {
        next.center = (s.xL + s.xR) / 2;
        next.L = s.xR - s.xL;
    }
    next.buildingMode = mode;
    return next;
}

/**
 * Number typed into an input field. The decimal separator is '.'; a ','
 * is accepted too (keyboards with a decimal comma). No thousands
 * separators. Anything else gives NaN.
 * @param {string} text
 * @returns {number}
 */
export function parseNumber(text) {
    const t = text.trim().replace(',', '.');
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(t)) return NaN;
    return Number(t);
}

/**
 * Number as text for the hash: shortest form, NaN as empty text.
 * @param {number} v
 */
function num(v) {
    return Number.isFinite(v) ? String(v) : '';
}

/**
 * Number from the hash; empty or invalid text gives NaN.
 * @param {string | undefined} text
 */
function parseNum(text) {
    if (text === undefined || text.trim() === '') return NaN;
    const v = Number(text);
    return Number.isFinite(v) ? v : NaN;
}

/**
 * State as URL hash (without '#').
 * Example: n=1&t1=0,30,10,1,0.35&bm=c&b=0,20&fw=p&fl=1&dx=0.1
 * @param {State} s
 * @returns {string}
 */
export function encodeHash(s) {
    /** @param {TunnelInput} t */
    const tunnel = (t) => [t.x, t.H, t.D, t.VL, t.K].map(num).join(',');
    const parts = [`n=${s.count}`, `t1=${tunnel(s.tunnels[0])}`];
    if (s.count === 2) parts.push(`t2=${tunnel(s.tunnels[1])}`);
    parts.push(s.buildingMode === 'centre'
        ? `bm=c&b=${num(s.center)},${num(s.L)}`
        : `bm=e&b=${num(s.xL)},${num(s.xR)}`);
    parts.push(`fw=${s.fieldMode === 'pointwise' ? 'p' : num(s.b)}`);
    parts.push(s.floorsTied ? 'tied=1' : `fl=${num(s.fL)}`);
    parts.push(`dx=${num(s.dx)}`);
    if (s.legacy) parts.push('leg=1');
    return parts.join('&');
}

/**
 * State from a URL hash (with or without '#'). Missing keys keep the
 * default; numbers that cannot be read become NaN (shown as invalid).
 * @param {string} hash
 * @returns {State}
 */
export function decodeHash(hash) {
    const s = defaultState();
    const q = new URLSearchParams(hash.replace(/^#/, ''));
    if (q.get('n') === '2') s.count = 2;
    /** @param {string | null} text @param {TunnelInput} t */
    const tunnel = (text, t) => {
        if (text === null) return;
        const v = text.split(',');
        t.x = parseNum(v[0]);
        t.H = parseNum(v[1]);
        t.D = parseNum(v[2]);
        t.VL = parseNum(v[3]);
        t.K = parseNum(v[4]);
    };
    tunnel(q.get('t1'), s.tunnels[0]);
    if (s.count === 2) {
        if (q.get('t2') === null) {
            // as when switching from one to two tunnels
            s.tunnels = switchTunnels({ ...s, count: 1 }, 2).tunnels;
        } else {
            tunnel(q.get('t2'), s.tunnels[1]);
        }
    }
    const b = q.get('b');
    if (q.get('bm') === 'e') {
        s.buildingMode = 'edges';
        if (b !== null) {
            const v = b.split(',');
            s.xL = parseNum(v[0]);
            s.xR = parseNum(v[1]);
        }
    } else if (b !== null) {
        const v = b.split(',');
        s.center = parseNum(v[0]);
        s.L = parseNum(v[1]);
    }
    const fw = q.get('fw');
    if (fw !== null && fw !== 'p') {
        s.fieldMode = 'width';
        s.b = parseNum(fw);
    }
    if (q.get('tied') === '1') {
        s.floorsTied = true;
    } else if (q.get('fl') !== null) {
        s.fL = parseNum(/** @type {string} */ (q.get('fl')));
    }
    if (q.get('dx') !== null) s.dx = parseNum(/** @type {string} */ (q.get('dx')));
    s.legacy = q.get('leg') === '1';
    return s;
}
