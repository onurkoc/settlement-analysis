# Settlement Analysis

Browser app for the greenfield settlement trough above one or two tunnels
(Gaussian trough after Peck / O'Reilly & New, superposition) and the
damage assessment of a building after Boscardin & Cording (1989).
Everything is calculated in the browser; there is no server.

**Open the app: <https://settlement.onurkoc.net/>** (not yet deployed)

Author: Onur Koc – more apps: <https://apps.onurkoc.net/>

> Work in progress. This README is a skeleton; the sections below are
> filled in phase 3.

## Scope

- One or two tunnels, each with its own axis position, depth H,
  equivalent diameter D, volume loss VL and trough width factor K.
- Building of width L, given by its centre or by its left/right edge.
- Settlement trough, horizontal displacement, slope 1/n.
- Damage assessment: deflection ratio quantities δ0, Ω, angular
  distortion β = S' − Ω, horizontal tensile strain ε_h, damage category
  after Boscardin & Cording, first-stage screening after Rankin (1988).

## Method

To be written (phase 3). The formulas are also shown in the tab
«Information» of the app.

## Validation

To be written (phase 1/3): Python reference (`tests/reference/`),
invariants, legacy limit curves.

## Development

- Static app in `app/`, served as it is. No build step, no framework.
- Vanilla JavaScript (ES modules), JSDoc types, `// @ts-check`.
- Calculation core in `app/core/` without DOM, tested with Node:

  ```
  npm test
  ```

- Local server: `python serve.py` (or `start.cmd` on Windows).
- Third-party libraries in `app/vendor/` (see `app/vendor/README.md`).

## Legacy

The original Bokeh 2.3.1 apps and notebook exports are kept unchanged
in `legacy/`. Their functions and the errors that are corrected in this
app are documented in [docs/LEGACY_NOTES.md](docs/LEGACY_NOTES.md).

## License

To be decided.
