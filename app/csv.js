// @ts-check
/*
CSV export for checking the results with other programs. No DOM.

Format: SI units, unit in the header, '.' as decimal separator, ';' as
column separator (Excel with Swiss/Austrian settings), CRLF line ends.
Four sections, each starting with a line "# name":
  Inputs, Results, Trough (grid), Fields.
*/
import { summaryRows } from './model.js';

/** @typedef {import('./state.js').State} State */
/** @typedef {import('./model.js').Result} Result */

export const SEP = ';';
export const EOL = '\r\n';

/**
 * Cell text: numbers in the shortest exact form ("1.5", "2.3e-7"),
 * text without separators or line breaks.
 * @param {number | string} v
 */
export function cell(v) {
    if (typeof v === 'number') {
        if (Number.isNaN(v)) return '';
        if (v === Infinity) return 'inf';
        if (v === -Infinity) return '-inf';
        return String(v);
    }
    return v.replace(/[;\r\n]/g, ' ');
}

/** @param {(number | string)[]} cells */
const line = (cells) => cells.map(cell).join(SEP);

/**
 * The CSV text.
 * @param {State} s
 * @param {Result} r
 * @returns {string}
 */
export function buildCsv(s, r) {
    const out = [];
    out.push(line(['# Settlement Analysis – export', '', '']));
    out.push('');

    out.push(line(['# Inputs', '', '']));
    out.push(line(['parameter', 'value', 'unit']));
    out.push(line(['tunnels', s.count, '-']));
    if (s.count === 2) out.push(line(['tunnel_spacing_c', s.c, 'm']));
    r.tunnels.forEach((t, j) => {
        const n = j + 1;
        // derived: 0 or ±c/2, x measured from the axis or the midpoint
        out.push(line([`tunnel_${n}_x_derived`, t.x, 'm']));
        out.push(line([`tunnel_${n}_H`, t.H, 'm']));
        out.push(line([`tunnel_${n}_D`, t.D, 'm']));
        out.push(line([`tunnel_${n}_VL`, t.VL, '-']));
        out.push(line([`tunnel_${n}_K`, t.K, '-']));
    });
    const e = r.building.edges;
    out.push(line(['building_xL', e.xL, 'm']));
    out.push(line(['building_xR', e.xR, 'm']));
    out.push(line(['building_L', e.L, 'm']));
    out.push(line(['field_mode', s.fieldMode === 'pointwise' ? 'pointwise' : 'width', '']));
    out.push(line(['field_width_b', r.building.fields.b, 'm']));
    out.push(line(['floors_tied', s.floorsTied ? 1 : 0, '-']));
    out.push(line(['f_L', r.building.fields.fL, '-']));
    out.push(line(['grid_dx', s.dx, 'm']));
    out.push('');

    out.push(line(['# Results', '', '']));
    out.push(line(['quantity', 'value', 'unit']));
    for (const row of summaryRows(s, r)) {
        out.push(line([row.key, row.si, row.siUnit]));
    }
    out.push('');

    const t = r.trough;
    out.push(line(['# Trough']));
    out.push(line(['x [m]', ...t.Sj.map((_, j) => `S_${j + 1} [m]`), 'S [m]', 'dS/dx [-]', 'Sh [m]', 'eps_h [-]']));
    t.x.forEach((x, k) => {
        out.push(line([x, ...t.Sj.map((sj) => sj[k]), t.S[k], t.dS[k], t.Sh[k], t.eh[k]]));
    });
    out.push('');

    const f = r.building.fields;
    out.push(line(['# Fields']));
    out.push(line(['k', 'xa [m]', 'xb [m]', 'slope [-]', 'beta [-]', 'eps_L [-]', 'eps_L_eff [-]', 'eps_p [-]', 'governing']));
    for (let k = 0; k < f.n; k++) {
        out.push(line([k + 1, f.xa[k], f.xb[k], f.slope[k], f.beta[k], f.epsL[k], f.epsLEff[k], f.epsP[k],
                       k === f.governing ? 1 : 0]));
    }
    return out.join(EOL) + EOL;
}
