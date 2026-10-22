# Legacy-Apps: Funktionsumfang und Fehler

Grundlage der neuen App sind zwei fertige Bokeh-Apps (Bokeh 2.3.1,
standalone HTML) und zwei Notebook-Exporte eines früheren Stands. Die
Dateien liegen unverändert im Ordner `legacy/`. Dieser Ordner wird
**nicht veröffentlicht** (`.gitignore`); die Fundstellen unten beziehen
sich auf die lokalen Dateien.

| Datei | Inhalt |
|---|---|
| `legacy/Settlement_OneTunnel.html` | fertige App, 1 Röhre (Mai 2021) |
| `legacy/Settlement_TwoTunnels.html` | fertige App, 2 Röhren (März 2023) |
| `legacy/Code_for_App_OneTunnel.html` | Notebook-Export (Python + CustomJS), ohne Schadensdiagramm |
| `legacy/Code_for_App_TwoTunnels.html` | dito, 2 Röhren |
| `legacy/Description.md`, `Description.html` | Formelblatt |
| `legacy/Soil_coefficient.png` | Tabelle der k-Werte |

Aus den Legacy-Dateien wird nur eine Zahlentabelle veröffentlicht:
`tests/reference/legacy_curves.json` (die vier Grenzkurven, erzeugt von
`tests/reference/extract_legacy.py`).

**Fundstellen.** Die Logik steckt im JSON-Block
`<script type="application/json">` der fertigen Apps. Ein Modell wird
mit seiner Bokeh-ID angegeben, z. B. `CustomJS 13688`. Diese IDs sind
im JSON eindeutig und mit einer Textsuche nach `"id":"13688"` zu finden.
Notebook-Stellen werden mit der Zellnummer angegeben (gezählt ab 0 in
der Reihenfolge der Code-Zellen).

**Welche Callbacks gelten.** Ausgewertet sind nur die Callbacks, die an
den sichtbaren Slidern im Layout hängen (Root `Tabs` → Panel
«Calculation» → Column). Bei mehreren Callbacks am selben Slider läuft
Bokeh sie in der Reihenfolge der Liste ab; massgebend für die Anzeige
ist der letzte, der dieselbe Datenquelle schreibt.

## 1 Funktionsumfang

### 1.1 Aufbau (beide Apps gleich)

- Zwei Tabs: «Calculation» und «Information».
- Links eine Spalte mit Slidern, rechts drei Diagramme untereinander,
  feste Breite 950 px:
  1. **«Building Position»** (Höhe 100 px): grüner Balken (`Quad`) von
     Position − Spread/2 bis Position + Spread/2, x-Achse «Spread [m]»,
     y-Achse ausgeblendet, x-Bereich fest −50…50 m.
  2. **«Settlement trough»** (Höhe 600 px): x-Achse «Offset from
     tunnel axis [m]» fest −50…50 m; linke y-Achse «Settlement [m]»;
     rechte y-Achse «Depth [m]» (`extra_y_ranges['yaxis2']`) mit den
     Tunnelkreisen. Horizontale und vertikale Achse bei 0 als graue
     `Span`, Gebäuderänder als gestrichelte grüne `Span`. Text
     «VL = 1.00%» und «Max. Building Slope = 1/…» als `LabelSet` auf
     der Tiefenachse. Ein Logo als externe Grafik (`ImageURL`,
     entfällt).
  3. **«Damage Assessment acc. Boscardin-Cording»** (Höhe 400 px):
     x «Angular distortion [m/m]» 0…0.007, y «Horizontal extension
     strain [m/m]» 0…0.0035. Vier Grenzkurven als Parabel (je 16 Punkte,
     durchgezogen) plus je eine gestrichelte Gerade zwischen den
     Endpunkten (β0, 0) und (0, ε0), Farben turquoise / gold / red /
     brown, Legende «Negligible / Very slight / Slight / Moderate
     damage», Gebäudepunkt als schwarzes Dreieck mit Hover.
- Keine Toolbars (`toolbar_location = None`), Hover-Werkzeuge trotzdem
  aktiv.
- Tab «Information»: `Div` mit Autor, Kontakt-E-Mail (entfällt),
  Kurzanleitung, Formelbilder von einer fremden Website (entfällt) und
  einem Link auf eine fremde Programmhilfe.

### 1.2 Eingaben

| Slider | 1 Röhre | 2 Röhren | Bereich | Default | Schritt |
|---|---|---|---|---|---|
| Building Spread [m] | ja | ja | 5…50 | 20 | 1 |
| Building Position [m] | ja | ja | −30…30 | 0 | 1 |
| k [-] | ja | ja | 0.2…0.9 | 0.35 | 0.01 |
| Equivalent Diameter [m] | ja | ja | 5…20 | 10 | 0.1 |
| Depth of Tunnels [m] | ja | ja | 7.5…50 | 30 | 0.1 |
| Tunnel Distance [m] | – | ja | 7.5…20 | 13.5 | 0.1 |
| Volume Loss [-] | ja | ja | 0.001…0.02 | 0.01 | 0.001 |

Bei 2 Röhren gelten H, D, VL und k für beide Röhren gemeinsam; die
Röhren liegen symmetrisch bei ±Distance/2.

### 1.3 Ausgaben

- Settlement trough: Setzung je Röhre (2 Röhren: «Settlement – Right»
  blau, «Settlement – Left» rot, «Settlement – Combined» orange),
  Horizontalverschiebung («Hor. Deformation [– Combined]», violett).
  Hover (Modus `vline`) je Kurve mit Setzung [m] und «Slope 1/n».
- Text «Max. Building Slope = 1/n» im Diagramm.
- Schadenspunkt (x_tilt, y_horStrain) im Boscardin-Cording-Diagramm.
- Keine Kategorie als Text, kein Screening, keine Zahlen zu δ0, Ω, β.

### 1.4 Formeln der Legacy-Apps

- i = k·H, S_max = 0.313·VL·D²/i (0.313 ≈ π/(4·√(2π)) = 0.31333;
  Abweichung −0.1 %, neue App rechnet exakt).
- S(x) = S_max·exp(−x²/(2i²)), im Plot negativ (nach unten).
- S_h(x) = x/H·S(x) (mit S negativ, also S_h = −S·x/H bei S positiv).
- ε_h(x) = −S/H·(1 − x²/i²) = S/H·(x²/i² − 1).
- Neigung 1/n mit n = 1/|S·x/i²|; bei Neigung 0 der String `'INF'`
  im Zahlenarray.
- Schadensdiagramm: Grenzkurven als Parabeln durch (β0, 0), (0, ε0)
  und einen Zwischenpunkt, wie im früheren Repo
  [onurkoc/boscardin-cording](https://github.com/onurkoc/boscardin-cording)
  (`settlement.py`, Funktion `spline`).

## 2 Fehler (werden nicht übernommen)

### Fehler 1 – Schadenspunkt x: (max S − min S)/L statt β = S' − Ω

- `Settlement_OneTunnel.html`, `CustomJS 13688` (an allen sechs
  sichtbaren Slidern):
  `settl_diff = max(settl) − min(settl); omega = settl_diff / length;
  s.data['x_tilt'] = [omega]`.
- `Settlement_TwoTunnels.html`, `CustomJS 1016`: gleich, mit der
  überlagerten Setzung.
- Als x-Wert des Schadenspunkts wird damit die Spannweite der Setzung
  im Gebäude durch L verwendet. Das ist weder die Winkelverdrehung
  β = Neigung − Schiefstellung (Cording et al. 2010, Fig. 3; Franzius
  2003, §2.4.1) noch die Schiefstellung Ω = (S(xR) − S(xL))/L
  (Vorzeichen, Randwerte statt Extrema). Bei einem Gebäude symmetrisch
  über der Achse ist Ω = 0 und richtig β_max = max|S'|; die
  Legacy-App zeigt dagegen (S_max − S_Rand)/L.
- Neu: Ω = (S(xR) − S(xL))/L; Gebäude in Felder der Breite b geteilt,
  je Feld β_k = |Neigung_k − Ω| (Standard: punktweise, b = Δx).

### Fehler 2 – Schadenspunkt y: |max| aus Zug oder Druck statt Zugdehnung

- `CustomJS 13688` (1 Röhre) und `CustomJS 1016` (2 Röhren):
  `if (|max(s_hs)| >= |min(s_hs)|) s_hs_max = |max| else s_hs_max = |min|`.
- Damit wird auch reine Stauchung (ε_h < 0, Senkungsbereich |x| < i)
  als «Horizontal extension strain» eingetragen. Beispiel Default
  1 Röhre, Gebäude −10…10 m (ganz innerhalb |x| < i = 10.5 m, also nur
  Stauchung): Legacy y = S_max/H = 9.94·10⁻⁴, richtig 0.
- Neu: je Feld ε_L,k = Verlängerung/b, wirksam nur der Zuganteil
  f_L·max(0, ε_L,k).

### Fehler 3 – `arange()`: falscher Auswertebereich

- `CustomJS 13688` und `CustomJS 1016`:
  ```js
  const numberOfSteps = (end - start) / step;
  for (let index = start; index < numberOfSteps; index++) { arr.push(count); count += step; }
  ```
- Der Zähler beginnt bei `start` (einer Koordinate in m), läuft aber
  bis `numberOfSteps` (einer Anzahl). Erzeugt werden ⌈N − start⌉ statt
  N Punkte, der Bereich ist [start, start + Δx·(⌈N − start⌉ − 1)].
  - Gebäude links von 0 (start < 0): Bereich zu lang. Default
    (−10…10 m): 210 Punkte bis x = 10.9 m statt 10.0 m.
  - Gebäude rechts von 0 (start > 0): Bereich zu kurz, z. B. Position
    20, Spread 20 (10…30 m): Punkte nur bis 28.9 m.
  - Ist start ≥ N, ist das Array leer; `Math.max()` gibt `-Infinity`,
    der Punkt wird `NaN`.
- Zusätzlich summiert `count += step` Rundungsfehler auf, und der
  rechte Rand ist nie eingeschlossen.
- Folge beim Default: Python-Startwert 5.43·10⁻⁴ (exakte Ränder),
  nach der ersten Slider-Bewegung zeigt die JS-App 6.21·10⁻⁴.
- Neu: eigenes Gebäuderaster exakt von xL bis xR, beide Ränder
  eingeschlossen, n = ⌈L/Δx⌉ + 1 Punkte.

### Fehler 4 – 2 Röhren: Neigung der kombinierten Mulde als s_sup·x/i²

- `Settlement_TwoTunnels.html`, `CustomJS 1012`:
  `item3 = y3[index] * element / i_2**2; slope3 = 1/|item3|`;
  Notebook `Code_for_App_TwoTunnels.html`, Zelle 8:
  `slp_sup = s_sup * X / i_2**2`.
- Die Ableitung einer Summe zweier Gaussglocken mit verschiedenen
  Achsen ist nicht S_sup·x/i². Richtig ist
  S'(x) = Σ −S_j(x)·(x − x_j)/i_j².
- `slope3` wird von `CustomJS 1214` für «Max. Building Slope» im
  Gebäude ausgewertet und im Hover der kombinierten Kurve angezeigt.
  Beispiel Default (Abstand 13.5 m, Gebäude −10…10 m): Legacy
  1/300, richtig 1/475.

### Fehler 5 – 2 Röhren: S_h mit globalem x statt x − x_j

- `CustomJS 1012`: `s_h_1 = element / Z_1 * y1[index]`,
  `s_h_2 = element / Z_2 * y2[index]`; Notebook Zelle 9:
  `s_h_1 = X / Z_1 * -s_1`, ebenso die (nur im Notebook berechnete)
  Horizontaldehnung `s_hs_1 = -s_1/Z_1*(1 - 2*X**2/(2*i_1**2))`.
- Die Verschiebung zeigt zur jeweiligen Tunnelachse; der Hebel ist
  x − x_j, nicht x. Mit globalem x ist S_h über der Achse einer
  versetzten Röhre nicht null.
- Neu: S_h(x) = Σ −S_j(x)·(x − x_j)/H_j.
- Hinweis: Die Horizontaldehnung im Schadens-Callback `CustomJS 1016`
  verwendet richtig x ∓ dist/2; nur S_h (Kurve, Hover) ist betroffen.

### Fehler 6 – 2 Röhren: Kurve und Kreis vertauscht

- `CustomJS 1012`: `y1` («settlement for left tunnel») liegt bei
  `element - dist/2`, also x = +dist/2; Legende «Settlement – Right»
  (`GlyphRenderer 1063`). `y2` liegt bei x = −dist/2, Legende
  «Settlement – Left».
- `CustomJS 1013`/`1014`: Kreis 1 (`x1`) bei −dist/2, Kreis 2 bei
  +dist/2. Kurve 1 und Kreis 1 gehören also zu verschiedenen Röhren;
  der Kommentar «left tunnel» widerspricht Lage und Legende.
- Wegen identischer Parameter beider Röhren in der Legacy-App ohne
  sichtbare Folge; mit getrennten Werten je Röhre (neue App) wäre es
  falsch.
- Neu: jede Röhre j hat eine Lage x_j; Kurve, Kreis, Achs-Span und
  Hover verwenden dasselbe x_j.

### Fehler 7 – Nullpunktabgleich der y-Achsen nur für Default-Werte

- Notebook `Code_for_App_TwoTunnels.html`, Zelle 10:
  `y1 = -s_1.max()*5; y2 = 0.03` und
  `p1.extra_y_ranges = {"yaxis2": Range1d(start=max_depth[0], end=8)}
  # ends at 10 in order to match both y axis at zero!`
  (gleich in `Code_for_App_OneTunnel.html`).
- In den fertigen Apps: `Plot 13299` (1 Röhre) bzw. `Plot 1017`
  (2 Röhren): `y_range` −0.149…0.03, `yaxis2` −40…8, fest. Kein
  Callback ändert die Bereiche.
- Die Nullpunkte fallen nur zusammen, weil 0.149/0.179 ≈ 40/48 für die
  Default-Werte gilt. Bei anderer Tiefe, VL, D oder k verschieben sich
  die Nullpunkte gegeneinander, Kurven können aus dem Bild laufen, und
  tiefe Tunnel liegen unter dem Bereich.
- Neu: beide Bereiche werden bei jeder Eingabe aus den Daten berechnet,
  so dass y = 0 auf beiden Achsen auf derselben Pixelhöhe liegt.

### Fehler 8 – Mehrfach registrierte Callbacks

- `Settlement_OneTunnel.html`: Das Notebook wurde mehrfach ausgeführt;
  die Slider k, D, H tragen je 20, VL 25 Callbacks (Generationen
  1012/1013/1145/1187/1188, 2220…, 4724…, 8416…, 13296/13297/13429/
  13687/13688). Nur die letzte Generation hängt an den sichtbaren
  Gebäude-Slidern (`Slider 13678`, `13679`); die älteren Callbacks
  lesen unsichtbare Gebäude-Slider (`1178/1179`, `2440/2441`,
  `4998/4999`, `8744/8745`, alle auf Default) und schreiben trotzdem in
  dieselbe Datenquelle `ColumnDataSource 1004` (`x_tilt`,
  `y_horStrain`). Nur weil 13688 als letzter läuft, stimmt die Anzeige.
- Ältere Varianten enthalten:
  - `CustomJS 1188`: eine Anweisung `debugger;` (hält bei offenen
    Entwicklerwerkzeugen bei jeder Slider-Bewegung an) und den
    Vergleich `|max(s_hs)| >= |max(s_hs)|` (immer wahr, der Druckwert
    wird nie gewählt).
  - `CustomJS 2450`: derselbe Vergleich max ≥ max und
    `console.log([omega, s_hs_max])`.
  - `CustomJS 1012`, `2220`, `4724`, `8416`, `13296`: auskommentiertes
    `// if (index === 900) {debugger;}`.
- `Settlement_TwoTunnels.html`: keine Duplikate, aber D, H und Distance
  aktualisieren die Kreise doppelt (`CustomJS 1013` und `1014`).
- Neu: eine Rechenfunktion pro Eingabeänderung, Plots werden nur über
  ihre Datenquellen aktualisiert.

## 3 Weitere Beobachtungen (kein Teil der Fehlerliste)

- **Startwerte aus Python, nicht aus JS.** Die beim Öffnen gezeigten
  Werte stammen aus dem Notebook, nicht aus den Callbacks:
  «Max. Building Slope = 1/580.7» (1 Röhre) ist die grösste Neigung der
  ganzen Mulde (bei x = ±i, ausserhalb des Gebäudes); im Gebäude
  −10…10 m wäre es 1/582. Der Schadenspunkt in
  `Settlement_TwoTunnels.html` (`ColumnDataSource 1003`:
  x = 5.434·10⁻⁴, y = 9.937·10⁻⁴) ist identisch mit dem der
  1-Röhren-App, also kein Wert für zwei Röhren. Erst nach der ersten
  Slider-Bewegung rechnen die Callbacks.
- **Strings in Zahlenarrays:** `slope1/2/3 = 'INF'` bei Neigung 0
  (`CustomJS 1012`, `13296`); der Vergleich `e < tempValueForSlope`
  ist für `'INF'` immer falsch und überspringt den Punkt nur zufällig
  richtig. Neu: n = Infinity, Anzeige «–».
- **Links/rechts vertauscht benannt:** `CustomJS 13687`/`1214`:
  `left = pos + sp/2; right = pos - sp/2`; nur Namen, Ergebnis richtig.
- **Neigung im Gebäude nur auf dem globalen Raster** (−80…79.9 m,
  Δx = 0.1): Gebäuderänder zwischen zwei Rasterpunkten werden nicht
  ausgewertet.
- **Screening:** In den Legacy-Apps nicht vorhanden. Neu: Stufe 1 nach
  Rankin (1988), wie in Franzius (2003) §2.4.2.1 wiedergegeben:
  Neigung θ < 1/500 und S_v,max < 10 mm ⇒ vernachlässigbares Risiko.
- **Schadenskriterium:** Die Legacy-Apps klassieren (nur grafisch) mit
  den Parabeln von Boscardin & Cording (1989). Die neue App verwendet
  die Hauptdehnung ε_p (Cording et al. 2010, Fig. 2 und 3) mit den
  Grenzwerten aus Franzius (2003) Tab. 2.3. Die Parabeln bleiben als
  optionale Vergleichsanzeige (`legacyCurves()`).
- **Legende:** Die Apps schreiben «Moderate damage», das frühere
  Repo `boscardin-cording` (`draw_plotly.py`) «Moderate to severe
  damage» für dieselbe Kurve (6.8·10⁻³, 3.0·10⁻³). Burland (1995)
  empfiehlt «Moderate» (Franzius 2003, Tab. 2.3, Anmerkung).
