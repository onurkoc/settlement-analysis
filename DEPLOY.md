# Deployment auf Cloudflare Pages

Die App ist statisch: Der Ordner `app/` wird so ausgeliefert, wie er im
Repo liegt. Es gibt keinen Build-Schritt und keinen Server.

| | |
| --- | --- |
| Hosting | Cloudflare Pages, eigenes Projekt nur für diese App |
| Projektname | `settlement` |
| Repo | `github.com/onurkoc/settlement-analysis` |
| Produktions-Branch | `main` |
| Vorschau-Branch | `dev` |
| Build-Befehl | keiner |
| Ausgabeordner | `app` |
| Adresse (Ziel) | `https://settlement.onurkoc.net/` |
| Vorschau | `https://dev.<projekt>.pages.dev/` |

`<projekt>` ist die pages.dev-Adresse des Projekts, normalerweise
`settlement`. Ist der Name vergeben, hängt Cloudflare etwas an; die
genaue Adresse steht im Dashboard beim Deployment.

Die App liegt im Stamm der Subdomain, nicht in einem Unterpfad. Alle
Pfade in `app/` sind relativ, die App läuft deshalb auch unter jeder
Vorschau-Adresse.

`apps.onurkoc.net` ist eine separate Startseite in einem eigenen Repo
(`onurkoc/apps-landing`) und gehört nicht zu diesem Projekt.

## Reihenfolge

1. Repo `onurkoc/settlement-analysis` auf GitHub anlegen (public, leer)
   und den Branch `dev` pushen. `main` entsteht erst beim ersten Merge.
2. Pages-Projekt anlegen (Abschnitt 1), Vorschau-Branch einstellen
   (Abschnitt 2).
3. Vorschau prüfen (Prüfliste unten).
4. Pull Request `dev` nach `main`, Merge durch Onur.
5. Eigene Domain `settlement.onurkoc.net` eintragen (Abschnitt 3) und
   den Hostnamen in die Cache-Regel der Zone aufnehmen (Abschnitt 4).

Die eigene Domain zeigt immer auf den Produktions-Branch. Sie wird
deshalb erst eingetragen, wenn `main` die App enthält.

## 1 Projekt anlegen (Cloudflare-Dashboard)

1. **Workers & Pages** öffnen, neues **Pages**-Projekt anlegen, Variante
   «mit Git verbinden» (Connect to Git).
2. GitHub-Konto verbinden und der Cloudflare-App den Zugriff auf das
   Repo `onurkoc/settlement-analysis` geben (nur dieses Repo genügt).
3. Einstellungen des Projekts:

   | Feld | Wert |
   | --- | --- |
   | Projektname | `settlement` |
   | Produktions-Branch | `main` |
   | Framework-Vorgabe | keine (None) |
   | Build-Befehl | leer lassen |
   | Build-Ausgabeordner | `app` |
   | Stammverzeichnis | leer lassen (Stamm des Repos) |
   | Umgebungsvariablen | keine |

4. Speichern und deployen.

Solange es `main` noch nicht gibt, kann Cloudflare kein
Produktions-Deployment bauen. Das ist bis zum ersten Merge so erwartet
und betrifft die Vorschau nicht.

## 2 Vorschau-Branch

1. Im Projekt: **Settings**, Abschnitt **Builds**, **Branch control**.
2. Produktions-Branch: `main`, automatische Deployments ein.
3. Vorschau-Branches: «Custom branches», einschliessen `dev`.

Ein Vorschau-Deployment entsteht bei einem Push auf `dev`. Wurde `dev`
schon vor dem Anlegen des Projekts gepusht, braucht es einen weiteren
Push (ein beliebiger neuer Commit auf `dev`), damit die erste Vorschau
gebaut wird.

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

In der Zone `onurkoc.net` gibt es die Cache-Regel «Pages-Apps: Header
der Quelle». Sie sorgt dafür, dass für die Pages-Apps die
Cache-Control-Köpfe aus `_headers` gelten und nicht die Vorgaben der
Zone.

1. Zone `onurkoc.net` öffnen, **Caching**, **Cache Rules**.
2. Regel «Pages-Apps: Header der Quelle» bearbeiten.
3. Im Ausdruck den Hostnamen `settlement.onurkoc.net` zu den übrigen
   Hostnamen hinzufügen (gleiche Bedingung wie für die anderen Apps,
   z. B. «Hostname ist in der Liste» bzw. `http.host in {...}`). Die
   übrigen Einstellungen der Regel nicht ändern.
4. Speichern. Danach Punkt 2 der Prüfliste auf der eigenen Domain
   wiederholen.

## Cache-Regeln der App (`app/_headers`)

Cloudflare Pages liest die Datei `_headers` im Ausgabeordner.

| Dateien | Cache-Control | Wirkung |
| --- | --- | --- |
| `/`, `index.html`, `*.js`, `*.css`, `core/*.js`, `ui/*.js`, `plots/*.js` | `no-cache` | Der Browser fragt bei jedem Aufruf nach, ob die Datei neu ist. Eine neue Version erscheint beim normalen Neuladen. |
| `vendor/*` | `public, max-age=31536000, immutable` | BokehJS und KaTeX (mit Fonts) bleiben ein Jahr im Browser. |

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
     eine Datei aus `…/vendor/katex-0.19.0/fonts/`:
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
   auf gleicher Höhe.
5. **Phone.** Auf einem echten Handy öffnen: Eingaben eingeklappt über
   den Diagrammen, aufklappbar, kein seitliches Scrollen, Zahlentastatur
   in den Eingabefeldern, Legenden unter den Diagrammen.
6. **Dunkelmodus.** Betriebssystem auf dunkel stellen: Seite und
   Diagramme dunkel, Kategorie-Etikett gut lesbar.
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
