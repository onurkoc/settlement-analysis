// @ts-check
/*
Input form: every value as a number field coupled with a slider. The
number field may go beyond the slider range; only values rejected by
validate() (app/state.js) are marked and not calculated.
*/
import {
    tunnelFields, SPACING_FIELD, BUILDING_CENTRE_FIELDS, BUILDING_EDGE_FIELDS, FIELD_WIDTH_FIELD, FL_FIELD, DX_FIELD,
    activeFields, getPath, parseNumber,
} from '../state.js';

/** @typedef {import('../state.js').State} State */
/** @typedef {import('../state.js').FieldSpec} FieldSpec */

/**
 * @typedef {Object} InputHandlers
 * @property {(path: string, value: number) => void} onValue
 * @property {(count: 1 | 2) => void} onCount
 * @property {(mode: 'centre' | 'edges') => void} onBuildingMode
 * @property {(mode: 'pointwise' | 'width') => void} onFieldMode
 * @property {(tied: boolean) => void} onTied
 * @property {(show: boolean) => void} onAllFields
 * @property {() => void} onReset  all inputs back to the defaults
 */

/**
 * Element with attributes and children.
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {(Node | string)[]} [children]
 * @returns {HTMLElement}
 */
function h(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...children);
    return e;
}

/**
 * Segmented radio buttons.
 * @param {string} name
 * @param {[string, string][]} options  value, label
 * @param {(value: string) => void} onChange
 */
function segmented(name, options, onChange) {
    const box = h('div', { class: 'seg', role: 'radiogroup' });
    for (const [value, label] of options) {
        const input = /** @type {HTMLInputElement} */ (h('input', { type: 'radio', name, value }));
        input.addEventListener('change', () => { if (input.checked) onChange(value); });
        box.append(h('label', {}, [input, h('span', {}, [label])]));
    }
    return box;
}

/**
 * @param {HTMLElement} container
 * @param {InputHandlers} on
 */
export function renderInputs(container, on) {
    /** @type {Map<string, {row: HTMLElement, num: HTMLInputElement, range: HTMLInputElement, err: HTMLElement, spec: FieldSpec}>} */
    const fields = new Map();

    /** @param {FieldSpec} spec */
    function field(spec) {
        const id = 'in-' + spec.path.replace(/\./g, '-');
        const num = /** @type {HTMLInputElement} */ (h('input', {
            // text, not type="number": the browser would show the decimal
            // separator of its locale; here it is always '.'
            id, type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false',
        }));
        const range = /** @type {HTMLInputElement} */ (h('input', {
            type: 'range', min: String(spec.min), max: String(spec.max), step: String(spec.step),
            tabindex: '-1', 'aria-hidden': 'true',
        }));
        const err = h('div', { class: 'err', 'aria-live': 'polite' });
        const unit = spec.unit === '-' ? '[-]' : `[${spec.unit}]`;
        const row = h('div', { class: 'field' }, [
            h('label', { for: id }, [spec.label, ' ', h('span', { class: 'unit' }, [unit])]),
            h('div', { class: 'pair' }, [range, num]),
            err,
        ]);
        num.addEventListener('input', () => {
            const v = parseNumber(num.value);
            if (Number.isFinite(v)) range.value = String(Math.min(spec.max, Math.max(spec.min, v)));
            on.onValue(spec.path, v);
        });
        // leaving the field: show the number as read ("0,4" -> "0.4")
        num.addEventListener('change', () => {
            const v = parseNumber(num.value);
            if (Number.isFinite(v)) num.value = String(v);
        });
        range.addEventListener('input', () => {
            num.value = range.value;
            on.onValue(spec.path, Number(range.value));
        });
        fields.set(spec.path, { row, num, range, err, spec });
        return row;
    }

    const countSeg = segmented('count', [['1', '1 tunnel'], ['2', '2 tunnels']],
                               (v) => on.onCount(v === '2' ? 2 : 1));
    const spacingRow = field(SPACING_FIELD);
    const tunnelBoxes = [0, 1].map((j) => h('div', { class: 'tunnel' }, [
        h('h3', {}, [`Tunnel ${j + 1}`]),
        ...tunnelFields(j).map(field),
    ]));
    const buildingSeg = segmented('bmode', [['centre', 'Centre / width'], ['edges', 'Edges']],
                                  (v) => on.onBuildingMode(v === 'edges' ? 'edges' : 'centre'));
    const fieldSeg = segmented('fmode', [['pointwise', 'Pointwise'], ['width', 'Field width b']],
                               (v) => on.onFieldMode(v === 'width' ? 'width' : 'pointwise'));
    const tied = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', id: 'in-tied' }));
    tied.addEventListener('change', () => on.onTied(tied.checked));
    const allFields = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', id: 'in-all-fields' }));
    allFields.addEventListener('change', () => on.onAllFields(allFields.checked));
    const reset = h('button', { type: 'button', id: 'reset-defaults' }, ['Reset to defaults']);
    reset.addEventListener('click', () => on.onReset());

    container.append(
        h('fieldset', {}, [h('legend', {}, ['Tunnels']), countSeg, spacingRow, ...tunnelBoxes]),
        h('fieldset', {}, [
            h('legend', {}, ['Building']), buildingSeg,
            ...BUILDING_CENTRE_FIELDS.map(field), ...BUILDING_EDGE_FIELDS.map(field),
        ]),
        h('fieldset', {}, [
            h('legend', {}, ['Assessment']), fieldSeg, field(FIELD_WIDTH_FIELD),
            h('label', { class: 'check', for: 'in-tied' }, [tied, ' Floors tied / grade beam (f_L = 0)']),
            h('label', { class: 'check', for: 'in-all-fields' }, [allFields, ' Show all fields']),
            field(FL_FIELD), field(DX_FIELD),
        ]),
        h('div', { class: 'actions form-actions' }, [reset]),
    );

    /**
     * @param {HTMLElement} seg
     * @param {string} value
     */
    function setSeg(seg, value) {
        for (const input of seg.querySelectorAll('input')) {
            /** @type {HTMLInputElement} */ (input).checked = /** @type {HTMLInputElement} */ (input).value === value;
        }
    }

    /**
     * Show the state; a field with focus keeps what is being typed.
     * @param {State} s
     * @param {Record<string, string>} errors
     */
    function sync(s, errors) {
        setSeg(countSeg, String(s.count));
        setSeg(buildingSeg, s.buildingMode);
        setSeg(fieldSeg, s.fieldMode);
        tied.checked = s.floorsTied;
        allFields.checked = s.allFields;
        tunnelBoxes[1].hidden = s.count !== 2;
        /** @type {HTMLElement} */ (tunnelBoxes[0].firstChild).hidden = s.count !== 2;
        const active = new Set(activeFields(s).map((f) => f.path));
        for (const [path, f] of fields) {
            // the rows of tunnel 2 are hidden with their box
            f.row.hidden = !active.has(path) && !path.startsWith('tunnels.1.');
            const v = getPath(s, path);
            if (document.activeElement !== f.num && Number.isFinite(v)) {
                f.num.value = String(v);
            }
            if (Number.isFinite(v)) {
                f.range.value = String(Math.min(f.spec.max, Math.max(f.spec.min, v)));
            }
            const msg = active.has(path) ? errors[path] : undefined;
            f.row.classList.toggle('invalid', Boolean(msg));
            f.num.setAttribute('aria-invalid', msg ? 'true' : 'false');
            f.err.textContent = msg ?? '';
        }
    }

    return { sync };
}
