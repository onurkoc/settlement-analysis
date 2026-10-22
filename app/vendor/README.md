# vendor

Third-party libraries, stored locally (no CDN at runtime). Not changed.

| File | Library | Version | Source | License |
|---|---|---|---|---|
| `bokeh-3.10.1.min.js` | BokehJS core, minified (`build/js/bokeh.min.js`) | 3.10.1 | <https://registry.npmjs.org/@bokeh/bokehjs/-/bokehjs-3.10.1.tgz> | BSD-3-Clause, see `bokeh.LICENSE` |
| `bokeh-api-3.10.1.min.js` | BokehJS plotting API (`build/js/bokeh-api.min.js`) | 3.10.1 | same package | BSD-3-Clause, see `bokeh.LICENSE` |

Integrity of the npm package `bokehjs-3.10.1.tgz` (as published on npm):
`sha512-XWe+SUQvFOKHZB4E68KLfoja+lFCYw786aMkBtoq7XjBwPMDNFjP4GU91DkvIBcyA6H6qhDQznhqWrsGR8EB6w==`

SHA-256 of `bokeh-3.10.1.min.js`:
`879c5e26951a2dbf564238e2adfc6e3ec5c6f5417085bd923f29934868de0435`

SHA-256 of `bokeh-api-3.10.1.min.js`:
`e5d0dc156ec58e7196a80e633a0e53f04a9583d9e5cf70b36bfce2927d6f7d82`

Both are classic scripts: `bokeh-3.10.1.min.js` sets `window.Bokeh`,
`bokeh-api-3.10.1.min.js` adds `Bokeh.Plotting` and must be loaded
after it. Widgets, tables, WebGL and MathJax bundles are not needed
(inputs are plain HTML fields, formulas use KaTeX).

The files in this folder are excluded from the type check
(`jsconfig.json`).
