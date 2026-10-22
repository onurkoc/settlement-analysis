# Settlement Analysis

Browser app for the greenfield settlement trough above one or two tunnels
(Gaussian trough, superposition) and the damage assessment of a building
with the principal extension strain criterion (Cording et al. 2010).
Everything is calculated in the browser; there is no server.

**Open the app: <https://settlement.onurkoc.net/>** (not yet deployed)

Author: Onur Koc – more apps: <https://apps.onurkoc.net/>

> Work in progress: calculation core and user interface are done;
> the tab «Information» and the deployment follow.

## Scope

- One or two tunnels, each with its own axis position, depth H,
  equivalent diameter D, volume loss VL and trough width factor K.
- Building of width L, given by its centre or by its left/right edge.
- Settlement trough, horizontal displacement, slope 1/n.
- Damage assessment: tilt Ω, angular distortion β, lateral strain ε_L,
  principal extension strain ε_p, damage category; first-stage
  screening after Rankin (1988).

## Method

Keywords only; formulas in the tab «Information» of the app and in the
comments of `app/core/`.

- **Trough** (`app/core/trough.js`): Gaussian curve per tunnel (Peck
  1969; O'Reilly & New 1982), i = K·H,
  S_max = VL·πD²/4 / (√(2π)·i); several tunnels superposed. Slope S'
  analytic. Horizontal displacement towards each tunnel axis,
  Sh = −S·(x − x_j)/H_j (O'Reilly & New 1982); strain ε_h = dSh/dx,
  extension positive. Greenfield, at the ground surface.
- **Building** (`app/core/building.js`): follows the greenfield trough.
  Tilt Ω = (S(xR) − S(xL))/L, chord over the whole building (beam
  assumption, Cording et al. 2010, Fig. 5b). Assumption: if the
  distortion concentrates in one unit and the rest of the building
  only tilts (Fig. 5a), the real tilt is smaller and β is
  underestimated; Cording et al. report β between 2Δ/L (Fig. 5b) and
  4Δ/L (Fig. 5a). Building divided into fields (structural bays) of
  width b; per field angular distortion β = |field slope − Ω| and
  lateral strain ε_L = extension/b (Cording et al. 2010, Fig. 3;
  definitions Franzius 2003, §2.4.1). Only extension counts; factor
  f_L on ε_L, f_L = 0 for floors tied / grade beam (Cording et al.
  2010, Fig. 2). Default: pointwise (b = grid step 0.1 m).
- **Damage** (`app/core/damage.js`): ε_p = ε_L/2 + √((ε_L/2)² + (β/2)²),
  maximum of β·sinθ·cosθ + ε_L·cos²θ (Cording et al. 2010, Fig. 3);
  governing field = largest ε_p. Categories and limiting tensile
  strains 0.05 / 0.075 / 0.15 / 0.3 % from Franzius (2003), Tab. 2.3,
  after Boscardin & Cording (1989) and Burland (1995); crack widths
  (additional information only) after Franzius (2003), Tab. 2.2, and
  Cording et al. (2010), Fig. 2. The limit curves drawn in Cording et
  al. (2010), Fig. 2 deviate slightly at the upper two boundaries; the
  table values are used on purpose.
- **Screening**: Rankin (1988) as given by Franzius (2003), §2.4.2.1:
  maximum slope θ < 1/500 and S_v,max < 10 mm ⇒ negligible risk.
- **Not included**: subsurface trough at foundation level, soil-structure
  interaction, longitudinal trough, deep beam / deflection ratio method.

### Sources

- Boscardin, M.D., Cording, E.J. (1989): Building response to
  excavation-induced settlement. J. Geotech. Eng. 115(1), 1–21.
- Burland, J.B. (1995): Assessment of risk of damage to buildings due to
  tunnelling and excavation. 1st Int. Conf. Earthquake Geotech. Eng.,
  IS-Tokyo '95.
- Cording, E.J., Long, J.L., Son, M., Laefer, D., Ghahreman, B. (2010):
  Assessment of excavation-induced building damage. Earth Retention
  Conference 3, ASCE, doi:10.1061/41128(384)7.
- Franzius, J.N. (2003): Behaviour of buildings due to tunnel induced
  subsidence. PhD thesis, Imperial College London.
- O'Reilly, M.P., New, B.M. (1982): Settlements above tunnels in the
  United Kingdom – their magnitude and prediction. Tunnelling '82,
  Institution of Mining and Metallurgy, London.
- Peck, R.B. (1969): Deep excavations and tunnelling in soft ground.
  7th ICSMFE, Mexico City, State of the art volume, 225–290.
- Rankin, W.J. (1988): Ground movements resulting from urban
  tunnelling: predictions and effects. Engineering geology of
  underground movements, The Geological Society, London, 79–92.

## Validation

- `tests/reference/make_reference.py`: independent numpy implementation
  of the formulas above → `reference.json` (8 cases: one tunnel with
  the building over the axis, outside the trough, over the inflection
  point, on the flank; two symmetric tunnels; two tunnels with
  different H, D, VL, K). The JavaScript core matches with a relative
  tolerance of 1e-9.
- Invariants: trough volume = VL·πD²/4, S' and ε_h against finite
  differences, symmetry, ε_h = 0 at x_j ± i_j, ε_p against a numerical
  maximum over θ, limit curves at constant ε_p, convergence of the
  fields to the pointwise values.
- `tests/legacy.test.js` records the errors of the earlier Bokeh apps
  (see [docs/LEGACY_NOTES.md](docs/LEGACY_NOTES.md)).

## Development

- Static app in `app/`, served as it is. No build step, no framework.
- Vanilla JavaScript (ES modules), JSDoc types, `// @ts-check`.
- Calculation core in `app/core/` without DOM, tested with Node:

  ```sh
  npm test
  ```

- Python (reference scripts, local server): Anaconda at
  `C:\ProgramData\anaconda3\python.exe` (needs numpy; scipy is not used).
  - `python tests/reference/make_reference.py` writes `reference.json`.
  - `python tests/reference/extract_legacy.py` writes
    `legacy_curves.json`; it needs the legacy files in `legacy/`, which
    are kept locally only.
- Local server: `python serve.py` (or `start.cmd` on Windows).
- Browser check (Microsoft Edge, headless): `node tests/browser/check.mjs`
  starts the server, checks console, requests, zero alignment of the
  y axes, results against the core, URL hash and phone layout, and
  writes the screenshots in `docs/screenshots/web/`.
- App structure: `app/app.js` (state and wiring), `app/state.js`
  (defaults, validation, URL hash), `app/model.js` (results),
  `app/csv.js` (export), `app/ui/` (form, result panel), `app/plots/`
  (one module per plot, BokehJS 3.10.1).
- Third-party libraries in `app/vendor/` (see `app/vendor/README.md`).

## Legacy

The app replaces two earlier Bokeh 2.3.1 apps. They are not part of
this repository; their functions and the errors corrected here are
documented in [docs/LEGACY_NOTES.md](docs/LEGACY_NOTES.md).

## License

To be decided.
