"""
Independent reference for the calculation core (app/core/), written with
numpy from the formulas in the README (section Method), not from the
legacy code. Writes reference.json next to this file.

    C:\\ProgramData\\anaconda3\\python.exe tests/reference/make_reference.py

The JavaScript tests (tests/reference.test.js) compare app/core with
these numbers, relative tolerance 1e-9.

Conventions as in app/core/trough.js: SI units, settlement S positive
downwards, horizontal displacement Sh positive in +x, strain eh
extension positive.
"""
import json
import math
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, 'reference.json')

DX = 0.1
CEIL_TOL = 1e-9          # ceil(a/b - tol), same rule as app/core/trough.js
SAMPLE = 10              # every 10th point of the trough grid is stored

# limiting tensile strains, Franzius (2003) Tab. 2.3
LIMITS = [(0, 'Negligible', 0.0005), (1, 'Very slight', 0.00075), (2, 'Slight', 0.0015),
          (3, 'Moderate', 0.003), (4, 'Severe to very severe', math.inf)]
RANKIN_SLOPE = 1 / 500
RANKIN_S = 0.010


def ceil_div(a, b):
    return int(math.ceil(a / b - CEIL_TOL))


def trough(tunnels, x):
    """S, S', Sh, eh as arrays (sums over the tunnels) and S_j per tunnel."""
    x = np.asarray(x, dtype=float)
    S = np.zeros_like(x)
    dS = np.zeros_like(x)
    Sh = np.zeros_like(x)
    eh = np.zeros_like(x)
    Sj = []
    for t in tunnels:
        i = t['K'] * t['H']
        smax = t['VL'] * np.pi * t['D'] ** 2 / 4 / (np.sqrt(2 * np.pi) * i)
        u = x - t['x']
        s = smax * np.exp(-u ** 2 / (2 * i ** 2))
        Sj.append(s)
        S += s
        dS += -s * u / i ** 2
        Sh += -s * u / t['H']
        eh += s / t['H'] * (u ** 2 / i ** 2 - 1)
    return S, dS, Sh, eh, Sj


def divide(a, b, n):
    x = a + np.arange(n + 1) * ((b - a) / n)
    x[-1] = b
    return x


def principal(beta, eps_l):
    return eps_l / 2 + np.sqrt((eps_l / 2) ** 2 + (beta / 2) ** 2)


def category(eps_p):
    for level, name, upper in LIMITS:
        if eps_p < upper:
            return level, name


def fields(tunnels, xl, xr, omega, b, f_l):
    L = xr - xl
    n = max(1, ceil_div(L, b))
    b_eff = L / n
    a = divide(xl, xr, n)
    S, _, Sh, _, _ = trough(tunnels, a)
    slope = np.diff(S) / b_eff
    beta = np.abs(slope - omega)
    eps_l = np.diff(Sh) / b_eff
    eps_l_eff = f_l * np.maximum(0, eps_l)
    eps_p = principal(beta, eps_l_eff)
    # first field within a relative 1e-12 of the maximum (ties are real)
    g = int(np.flatnonzero(eps_p >= eps_p.max() * (1 - 1e-12))[0])
    level, name = category(eps_p[g])
    return {
        'b': b, 'bEff': b_eff, 'n': n, 'fL': f_l,
        'xa': a[:-1].tolist(), 'xb': a[1:].tolist(),
        'slope': slope.tolist(), 'beta': beta.tolist(), 'epsL': eps_l.tolist(),
        'epsLEff': eps_l_eff.tolist(), 'epsP': eps_p.tolist(),
        'governing': g, 'category': {'level': level, 'name': name},
    }


def building(tunnels, xl, xr, options):
    L = xr - xl
    x = divide(xl, xr, max(1, ceil_div(L, DX)))
    S, dS, Sh, eh, _ = trough(tunnels, x)
    delta0 = S[-1] - S[0]
    omega = delta0 / L
    beta = dS - omega
    out = {
        'edges': {'xL': xl, 'xR': xr, 'L': L},
        'profile': {'x': x.tolist(), 'S': S.tolist(), 'dS': dS.tolist(), 'Sh': Sh.tolist(),
                    'eh': eh.tolist(), 'beta': beta.tolist()},
        'delta0': delta0, 'omega': omega,
        'sMax': float(S.max()), 'slopeMax': float(np.abs(dS).max()),
        'betaMax': float(np.abs(beta).max()), 'ehMax': float(max(0.0, eh.max())),
        'screening': bool(np.abs(dS).max() < RANKIN_SLOPE and S.max() < RANKIN_S),
        'fields': {},
    }
    for name, (b, f_l) in options.items():
        out['fields'][name] = fields(tunnels, xl, xr, omega, DX if b == 'pointwise' else b, f_l)
    return out


def tunnel(x=0.0, H=30.0, D=10.0, VL=0.01, K=0.35):
    return {'x': x, 'H': H, 'D': D, 'VL': VL, 'K': K}


ONE = [tunnel()]
TWO_SYM = [tunnel(x=-6.75), tunnel(x=6.75)]
TWO_DIFF = [tunnel(x=-8.0, H=25.0, D=9.0, VL=0.012, K=0.4),
            tunnel(x=7.0, H=32.0, D=11.0, VL=0.008, K=0.5)]

OPTIONS = {
    'pointwise': ('pointwise', 1.0),
    'b5': (5.0, 1.0),
    'b5_fL0': (5.0, 0.0),
}

CASES = [
    ('one tunnel, building over the axis (default)', ONE, {'center': 0.0, 'L': 20.0}),
    ('one tunnel, building outside the trough', ONE, {'center': 45.0, 'L': 10.0}),
    ('one tunnel, building over the inflection point', ONE, {'center': 10.5, 'L': 10.0}),
    ('one tunnel, building on the flank', ONE, {'center': 18.0, 'L': 12.0}),
    ('two tunnels, symmetric 13.5 m (default)', TWO_SYM, {'center': 0.0, 'L': 20.0}),
    ('two tunnels, symmetric, building on the flank', TWO_SYM, {'xL': 8.0, 'xR': 27.3}),
    ('two tunnels, different H, D, VL, K', TWO_DIFF, {'center': 5.0, 'L': 18.0}),
    ('two tunnels, different, building left', TWO_DIFF, {'xL': -30.0, 'xR': -11.1}),
]


def main():
    cases = []
    for name, tunnels, b in CASES:
        R = max(abs(t['x']) for t in tunnels) + 3 * max(t['K'] * t['H'] for t in tunnels)
        m = ceil_div(R, DX)
        x = np.arange(-m, m + 1) * DX
        S, dS, Sh, eh, Sj = trough(tunnels, x)
        if 'center' in b:
            xl, xr = b['center'] - b['L'] / 2, b['center'] + b['L'] / 2
        else:
            xl, xr = b['xL'], b['xR']
        cases.append({
            'name': name,
            'tunnels': tunnels,
            'building': b,
            'dx': DX,
            'trough': {
                'n': len(x), 'x0': float(x[0]), 'xN': float(x[-1]), 'sample': SAMPLE,
                'x': x[::SAMPLE].tolist(), 'S': S[::SAMPLE].tolist(), 'dS': dS[::SAMPLE].tolist(),
                'Sh': Sh[::SAMPLE].tolist(), 'eh': eh[::SAMPLE].tolist(),
                'Sj': [s[::SAMPLE].tolist() for s in Sj],
                'Smax': float(S.max()),
            },
            'result': building(tunnels, xl, xr, OPTIONS),
        })
    out = {
        'description': 'Reference values for app/core, written by tests/reference/make_reference.py '
                       '(numpy %s).' % np.__version__,
        'options': {k: {'fieldWidth': v[0], 'fL': v[1]} for k, v in OPTIONS.items()},
        'cases': cases,
    }
    with open(TARGET, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, separators=(',', ':'))
        f.write('\n')
    for c in cases:
        r = c['result']
        g = r['fields']['pointwise']
        k = g['governing']
        print(f"{c['name']:48s} beta={g['beta'][k]:.4e} epsL={g['epsLEff'][k]:.4e} "
              f"epsP={g['epsP'][k]:.4e} cat={g['category']['level']} screen={r['screening']}")
    print(f'written: {TARGET} ({os.path.getsize(TARGET) // 1024} kB)')


if __name__ == '__main__':
    main()
