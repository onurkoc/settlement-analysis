"""
Read the four limit curves of the damage diagram from the legacy app
legacy/Settlement_OneTunnel.html and write legacy_curves.json.

The legacy files are kept locally only (not in the repository); the
JSON file with the numbers is committed. Standard library only.

    python tests/reference/extract_legacy.py

The curves are the solid lines (line_width 2) of the plot "Damage
Assessment acc. Boscardin-Cording", 16 points each, stored in the Bokeh
JSON as base64 float64 arrays. Their legend label gives the name; the
end points (beta0, eps0) are taken from the curve itself.
"""
import base64
import json
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SOURCE = os.path.join(ROOT, 'legacy', 'Settlement_OneTunnel.html')
TARGET = os.path.join(HERE, 'legacy_curves.json')
TITLE = 'Damage Assessment acc. Boscardin-Cording'


def decode(column):
    """Bokeh column: plain list or {'__ndarray__': base64, 'dtype': 'float64'}."""
    if isinstance(column, list):
        return [float(v) for v in column]
    assert column['dtype'] == 'float64' and column['order'] == 'little', column
    raw = base64.b64decode(column['__ndarray__'])
    return list(struct.unpack('<%dd' % (len(raw) // 8), raw))


def main():
    if not os.path.exists(SOURCE):
        print(f'{SOURCE} not found (the legacy files are kept locally only).')
        return 1
    html = open(SOURCE, encoding='utf-8').read()
    block = re.search(r'<script type="application/json" id="[^"]+">\s*(.*?)\s*</script>',
                      html, re.S).group(1)
    doc = list(json.loads(block).values())[0]
    models = {m['id']: m for m in doc['roots']['references']}

    def attrs(i):
        return models[i]['attributes']

    plot = next(m for m in models.values()
                if m['type'] == 'Plot' and attrs(m['attributes']['title']['id']).get('text') == TITLE)
    legend = next(models[c['id']] for c in plot['attributes']['center']
                  if models[c['id']]['type'] == 'Legend')

    curves = []
    for item in legend['attributes']['items']:
        label = attrs(item['id'])['label']['value']
        for r in attrs(item['id'])['renderers']:
            renderer = attrs(r['id'])
            glyph = models[renderer['glyph']['id']]
            if glyph['type'] != 'Line' or glyph['attributes'].get('line_width') != 2:
                continue
            data = attrs(renderer['data_source']['id'])['data']
            x, y = decode(data['x']), decode(data['y'])
            curves.append({'label': label, 'source_id': renderer['data_source']['id'],
                           'beta0': x[-1], 'eps0': y[0], 'beta': x, 'epsL': y})
    assert len(curves) == 4 and all(len(c['beta']) == 16 for c in curves), curves

    out = {
        'description': 'Limit curves (solid lines) of the damage diagram of the legacy app '
                       'Settlement_OneTunnel.html (Bokeh 2.3.1), written by '
                       'tests/reference/extract_legacy.py.',
        'curves': curves,
    }
    with open(TARGET, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, indent=1)
        f.write('\n')
    for c in curves:
        print(f"{c['label']:20s} beta0 = {c['beta0']:.6g}  eps0 = {c['eps0']:.6g}  "
              f"({len(c['beta'])} points, ColumnDataSource {c['source_id']})")
    print(f'written: {TARGET}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
