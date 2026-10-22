// @ts-check
/*
Apply the stored colour scheme before the page is drawn (classic script
in <head>, so a dark or light choice does not flash). Same storage key
as app/ui/theme.js; without storage the system setting applies.
*/
(() => {
    try {
        const choice = window.localStorage.getItem('settlement-theme');
        if (choice === 'light' || choice === 'dark') {
            document.documentElement.setAttribute('data-theme', choice);
        }
    } catch {
        // storage blocked: system setting
    }
})();
