// @ts-check
/*
Colour scheme of the page: System (prefers-color-scheme), Light or Dark.
The choice sets data-theme on <html> (app/style.css) and is kept in
localStorage of this browser, not in the URL. app/theme-init.js applies
the stored choice before the page is drawn.
*/

/** @typedef {'system' | 'light' | 'dark'} ThemeChoice */

export const THEME_KEY = 'settlement-theme';

/**
 * A stored or chosen value as theme choice; anything else is 'system'.
 * @param {unknown} value
 * @returns {ThemeChoice}
 */
export function normalizeTheme(value) {
    return value === 'light' || value === 'dark' ? value : 'system';
}

/**
 * Stored choice; 'system' if there is none or the storage is blocked.
 * @param {Pick<Storage, 'getItem'> | null | undefined} storage
 * @returns {ThemeChoice}
 */
export function readTheme(storage) {
    try {
        return normalizeTheme(storage?.getItem(THEME_KEY));
    } catch {
        return 'system';
    }
}

/**
 * Store the choice; 'system' removes the entry. Errors (blocked
 * storage) are ignored: the choice then lasts until the page is closed.
 * @param {Pick<Storage, 'setItem' | 'removeItem'> | null | undefined} storage
 * @param {ThemeChoice} choice
 */
export function storeTheme(storage, choice) {
    try {
        if (choice === 'system') storage?.removeItem(THEME_KEY);
        else storage?.setItem(THEME_KEY, choice);
    } catch {
        // no storage: nothing to keep
    }
}

/**
 * Set the choice on the root element.
 * @param {HTMLElement} root
 * @param {ThemeChoice} choice
 */
export function applyTheme(root, choice) {
    if (choice === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);
}

/**
 * localStorage, or null if access throws (blocked site data).
 * @returns {Storage | null}
 */
function storage() {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

/**
 * Wire the switch (radio group with the values system, light, dark).
 * @param {HTMLElement} group
 * @param {(choice: ThemeChoice) => void} onChange  after the change, e.g.
 *     to colour the plots again
 */
export function setupThemeSwitch(group, onChange) {
    const current = readTheme(storage());
    applyTheme(document.documentElement, current);
    for (const input of /** @type {NodeListOf<HTMLInputElement>} */ (group.querySelectorAll('input[type="radio"]'))) {
        input.checked = input.value === current;
        input.addEventListener('change', () => {
            if (!input.checked) return;
            const choice = normalizeTheme(input.value);
            applyTheme(document.documentElement, choice);
            storeTheme(storage(), choice);
            onChange(choice);
        });
    }
}
