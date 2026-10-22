# vendor

Third-party libraries, stored locally (no CDN at runtime). Not changed.

| File | Library | Version | Source | License |
| --- | --- | --- | --- | --- |
| `bokeh-3.10.1.min.js` | BokehJS core, minified (`build/js/bokeh.min.js`) | 3.10.1 | <https://registry.npmjs.org/@bokeh/bokehjs/-/bokehjs-3.10.1.tgz> | BSD-3-Clause, see `bokeh.LICENSE` |
| `bokeh-api-3.10.1.min.js` | BokehJS plotting API (`build/js/bokeh-api.min.js`) | 3.10.1 | same package | BSD-3-Clause, see `bokeh.LICENSE` |
| `katex-0.19.0/katex.mjs` | KaTeX, ES module (`dist/katex.mjs`) | 0.19.0 | <https://registry.npmjs.org/katex/-/katex-0.19.0.tgz> | MIT, see `katex-0.19.0/LICENSE` |
| `katex-0.19.0/katex.min.css`, `katex-0.19.0/fonts/` | KaTeX style sheet and fonts (`dist/`) | 0.19.0 | same package | MIT |

Integrity of the npm packages (as published on npm):

- `bokehjs-3.10.1.tgz`:
  `sha512-XWe+SUQvFOKHZB4E68KLfoja+lFCYw786aMkBtoq7XjBwPMDNFjP4GU91DkvIBcyA6H6qhDQznhqWrsGR8EB6w==`
- `katex-0.19.0.tgz`:
  `sha512-v6Tznz3zJ7u3niRCoDTsumM2+HA2XXcCu+WAacCeHD2z3p9A9Ks987o5FzfTGBN0e8A0vjEgIDvLbICrXpdw/Q==`

SHA-256:

| File | SHA-256 |
| --- | --- |
| `bokeh-3.10.1.min.js` | `879c5e26951a2dbf564238e2adfc6e3ec5c6f5417085bd923f29934868de0435` |
| `bokeh-api-3.10.1.min.js` | `e5d0dc156ec58e7196a80e633a0e53f04a9583d9e5cf70b36bfce2927d6f7d82` |
| `katex-0.19.0/katex.mjs` | `e5bc26598084ad869939ecaa262673814f26ed586312a409b5f8427c01e4f681` |
| `katex-0.19.0/katex.min.css` | `d4ab5b8ee16989b070cdb0ea24bd6ad48fc8df1b787f280f29d3ae4f959f2c00` |

Use:

- `bokeh-3.10.1.min.js` and `bokeh-api-3.10.1.min.js` are classic
  scripts loaded by `index.html`: the first sets `window.Bokeh`, the
  second adds `Bokeh.Plotting`. `app/app.js` passes `window.Bokeh` to
  the plot modules. Widgets, tables, WebGL and MathJax bundles are not
  needed (inputs are plain HTML fields, formulas use KaTeX).
- KaTeX is imported by `app/info.js` when the tab «Information» is
  opened the first time; `index.html` links the style sheet, which
  loads the fonts from `katex-0.19.0/fonts/` (the browsers use the
  `.woff2` files; `.woff` and `.ttf` are kept as in the package).

The files in this folder are excluded from the type check
(`jsconfig.json`). On Cloudflare Pages they are kept in the browser for
one year (`app/_headers`); a new version of a library therefore needs a
new file or folder name, see DEPLOY.md.
