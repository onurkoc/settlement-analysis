# Deployment auf Cloudflare Pages

Die App ist statisch: Der Ordner `app/` wird so ausgeliefert, wie er im
Repo liegt. Es gibt keinen Build-Schritt und keinen Server.

| | |
| --- | --- |
| Hosting | Cloudflare Pages, eigenes Projekt nur für diese App |
| Projektname | `settlement-analysis` |
| Repo | `github.com/onurkoc/settlement-analysis` |
| Produktions-Branch | vorerst `dev`, nach dem ersten Merge `main` |
| Vorschau-Branch | nach dem ersten Merge `dev` |
| Build-Befehl | keiner |
| Ausgabeordner | `app` |
| Adresse (Ziel) | `https://settlement.onurkoc.net/` |
| pages.dev-Adresse | `https://settlement-analysis-6w8.pages.dev/` |

Cloudflare hat dem Projektnamen `-6w8` angehängt; `<projekt>` steht
unten für `settlement-analysis-6w8`.

Die App liegt im Stamm der Subdomain, nicht in einem Unterpfad. Alle
Pfade in `app/` sind relativ, die App läuft deshalb auch unter jeder
Vorschau-Adresse.

`apps.onurkoc.net` ist eine separate Startseite in einem eigenen Repo
(`onurkoc/apps-landing`) und gehört nicht zu diesem Projekt.

## Stand

- Repo `onurkoc/settlement-analysis` angelegt, Branch `dev` gepusht.
  `main` gibt es noch nicht.
- Pages-Projekt `settlement-analysis` angelegt, Adresse
  `https://settlement-analysis-6w8.pages.dev/`. Weil `main` noch nicht
  existiert, ist vorerst **`dev` als Production branch** eingestellt,
  Build-Ausgabeordner `app`, kein Build-Befehl.
- Eigene Domain: noch keine (erst nach dem Merge).

## Reihenfolge

1. Vorschau auf `settlement-analysis-6w8.pages.dev` prüfen (Prüfliste
   unten).
2. Pull Request `dev` nach `main`, Merge durch Onur.
3. Nach dem Merge im Pages-Projekt: **Settings → Builds → Branch
   control**: Production branch = `main`, Preview branch = «Custom»,
   Include `dev` (Abschnitt 2).
4. Auf GitHub den Standard-Branch auf `main` umstellen (Settings →
   General → Default branch).
5. Eigene Domain `settlement.onurkoc.net` eintragen (Abschnitt 3).
6. Cache-Regel der Zone ergänzen (Abschnitt 4).

Die eigene Domain zeigt immer auf den Produktions-Branch. Sie wird
deshalb erst eingetragen, wenn `main` die App enthält.

## 1 Projekt anlegen (Cloudflare-Dashboard, erledigt)

1. **Workers & Pages** öffnen, neues **Pages**-Projekt anlegen, Variante
   «mit Git verbinden» (Connect to Git).
2. GitHub-Konto verbinden und der Cloudflare-App den Zugriff auf das
   Repo `onurkoc/settlement-analysis` geben (nur dieses Repo genügt).
3. Einstellungen des Projekts:

   | Feld | Wert |
   | --- | --- |
   | Projektname | `settlement-analysis` |
   | Produktions-Branch | vorerst `dev` (nach dem Merge `main`) |
   | Framework-Vorgabe | keine (None) |
   | Build-Befehl | leer lassen |
   | Build-Ausgabeordner | `app` |
   | Stammverzeichnis | leer lassen (Stamm des Repos) |
   | Umgebungsvariablen | keine |

4. Speichern und deployen.

Solange es `main` noch nicht gibt, baut Cloudflare `dev` als
Produktion; die Adresse `settlement-analysis-6w8.pages.dev` zeigt dann
den Stand von `dev`.

## 2 Produktions- und Vorschau-Branch (nach dem Merge dev → main)

1. Im Projekt: **Settings**, Abschnitt **Builds**, **Branch control**.
2. Production branch: `main`, automatische Deployments ein.
3. Preview branch: «Custom», Include `dev`.

Danach entsteht bei jedem Push auf `dev` ein Vorschau-Deployment, bei
jedem Push oder Merge auf `main` ein Produktions-Deployment.

Adressen eines Vorschau-Deployments:

- `https://<hash>.<projekt>.pages.dev/` – genau dieser Stand, bleibt.
- `https://dev.<projekt>.pages.dev/` – immer der neuste Stand von `dev`.

Vorschau-Adressen sendet Cloudflare mit `X-Robots-Tag: noindex`; sie
erscheinen nicht in Suchmaschinen.

## 3 Eigene Domain (erst nach geprüfter Vorschau und Merge)

Voraussetzung: `onurkoc.net` liegt als Zone im selben Cloudflare-Konto.

1. Im Projekt: **Custom domains**, Domain einrichten.
2. `settlement.onurkoc.net` eintragen und bestätigen.
3. Cloudflare legt den DNS-Eintrag (CNAME auf `<projekt>.pages.dev`)
   selbst an und stellt das Zertifikat aus. Warten, bis der Status
   «aktiv» ist.
4. `https://settlement.onurkoc.net/` öffnen und die Prüfliste noch
   einmal durchgehen.

Den CNAME nicht von Hand im DNS anlegen, ohne die Domain im
Pages-Projekt einzutragen: Die Adresse antwortet dann mit einem Fehler.

## 4 Cache-Regel der Zone

Der Hostname `settlement.onurkoc.net` wird in die bestehende
Cache-Regel «Pages-Apps: Header der Quelle» der Zone `onurkoc.net`
aufgenommen. Danach Punkt 2 der Prüfliste auf der eigenen Domain
wiederholen.

## Cache-Regeln der App (`app/_headers`)

Cloudflare Pages liest die Datei `_headers` im Ausgabeordner.

| Dateien | Cache-Control | Wirkung |
| --- | --- | --- |
| `/`, `index.html`, `*.js`, `*.css`, `core/*.js`, `ui/*.js`, `plots/*.js` | `no-cache` | Der Browser fragt bei jedem Aufruf nach, ob die Datei neu ist. Eine neue Version erscheint beim normalen Neuladen. |
| `vendor/*` | `public, max-age=31536000, immutable` | BokehJS und KaTeX (mit den `.woff2`-Fonts) bleiben ein Jahr im Browser. |

Zwei Regeln, die beim Ändern zu beachten sind:

- **Die Regeln dürfen sich nicht überlappen.** Trifft mehr als eine
  Regel mit demselben Kopf auf eine Datei zu, hängt Cloudflare die Werte
  aneinander. Darum steht dort `/:file.js` (ein Name ohne `/`) und nicht
  `/*.js`, das auch `vendor/` treffen würde. Ein neuer Unterordner in
  `app/` braucht eine eigene Regel. `tests/headers.test.js` prüft, dass
  jede Datei von genau einer Regel getroffen wird.
- **Eine neue Version einer Bibliothek braucht einen neuen Datei- oder
  Ordnernamen** (mit der Versionsnummer, z. B. `bokeh-3.10.1.min.js`,
  `katex-0.19.0/`), sonst behalten Browser die alte Datei bis zu einem
  Jahr. Die Namen stehen in `app/index.html` und `app/info.js`.

`_headers` gilt nur auf Cloudflare Pages. Lokal sendet `serve.py` für
alle Dateien `Cache-Control: no-store`.

## Prüfliste nach dem Deployment

Zuerst auf der Vorschau, später noch einmal auf der eigenen Domain.
Vorher lokal: `npm test` und `node tests/browser/check.mjs` grün.

1. **Seite lädt.** Startseite mit den drei Diagrammen und dem
   Ergebnisfeld, keine Meldung «The app could not be started».
2. **Köpfe.** In den Entwicklerwerkzeugen (F12, Netzwerk) oder mit
   `curl -I`:
   - die Seite selbst, `…/app.js`, `…/style.css`, `…/core/trough.js`,
     `…/ui/inputs.js`, `…/plots/trough.js`: `Cache-Control: no-cache`,
     genau ein Wert.
   - `…/vendor/bokeh-3.10.1.min.js`, `…/vendor/katex-0.19.0/katex.mjs`,
     eine `.woff2`-Datei aus `…/vendor/katex-0.19.0/fonts/`:
     `Cache-Control: public, max-age=31536000, immutable`, genau ein
     Wert.
   - `.js` und `.mjs` kommen mit einem JavaScript-Typ
     (`Content-Type: text/javascript` oder `application/javascript`).
3. **Cache ohne Ctrl+F5.** Eine sichtbare Kleinigkeit ändern (z. B. den
   Text des Hinweises im Tab «Information» in `app/index.html`),
   committen, pushen, das neue Deployment abwarten. Die Seite **normal**
   neu laden (F5, nicht Ctrl+F5): Die neue Version erscheint. Danach die
   Änderung zurücknehmen.
4. **Desktop.** Eingaben links, Diagramme rechts. Default 1 Röhre:
   S_max 29.84 mm, Kategorie «2 – Slight», Screening «Second stage
   required». Umschalten auf 2 Röhren: Röhren bei ±6.75 m, Kategorie
   «2 – Slight», ε_p = 1.051·10⁻³. Die Gebäudekanten liegen im oberen
   und im mittleren Diagramm genau übereinander, auch nach Zoom und
   Verschieben. Die Nullpunkte beider y-Achsen im Muldendiagramm liegen
   auf gleicher Höhe. Die Achsenbereiche bleiben bei jeder Eingabe gleich
   (x −50…50 m, Setzung −149…30 mm, Tiefe −40…8 m); nach Zoom führt
   Reset auf diese Bereiche zurück. Diagramme höchstens 950 px breit.
5. **Phone.** Auf einem echten Handy öffnen: Eingaben eingeklappt über
   den Diagrammen, aufklappbar, kein seitliches Scrollen, Zahlentastatur
   in den Eingabefeldern, Legenden unter den Diagrammen.
6. **Farbschema.** Umschalter oben rechts: «System» folgt dem
   Betriebssystem, «Light» und «Dark» erzwingen das Schema, auch gegen
   die Systemeinstellung. Seite und Diagramme wechseln sofort, das
   Kategorie-Etikett bleibt gut lesbar. Nach dem Neuladen bleibt die
   Wahl erhalten (im Browser gespeichert, nicht im Link).
7. **PNG.** In jedem Diagramm das Speichern-Symbol der Werkzeugleiste:
   Es wird eine PNG-Datei geladen, im hellen Thema, auch im Dunkelmodus.
8. **CSV.** «Export CSV»: Datei mit den Abschnitten Inputs, Results,
   Trough, Fields; Semikolon als Trennzeichen, Punkt als Dezimalzeichen;
   lässt sich in Excel öffnen.
9. **Copy link.** «Copy link», Link in einem neuen Fenster öffnen:
   dieselben Eingaben und Ergebnisse.
10. **Information.** Tab «Information»: Formeln gesetzt (KaTeX), Tabellen
    der K-Werte und der Schadenskategorien, Quellen.
11. **Konsole** (F12): keine Fehler, keine Anfrage an fremde Adressen
    (alles kommt von der eigenen Adresse, kein CDN).

## Später

- Neue Version veröffentlichen: Merge oder Push auf `main`, Cloudflare
  deployt selbst. Zurück auf einen alten Stand: im Dashboard beim
  gewünschten Deployment «Rollback».
- Die Startseite `apps.onurkoc.net` bekommt eine Karte für diese App
  (eigenes Repo, eigener Schritt).
