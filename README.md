# Voz Transcriber

Een lokale webinterface en CLI om audio te transcriberen met `@desert-ant-labs/voz` en te herkennen wie er sprak met `@desert-ant-labs/who`. De HTML-pagina staat in `index.html`; de CSS, browserlogica en lokale server staan in `src/server.ts`.

De opname, transcriptie en sprekerherkenning draaien in de browser; audio wordt niet naar een eigen server gestuurd. Voz gebruikt de compatibele WebAssembly/CPU-modus om problemen met WebGPU-shaders te vermijden. Dit kan langzamer zijn en vraagt relatief veel geheugen. De browser downloadt de modellen bij het eerste gebruik en bewaart ze waar mogelijk in cache. Who kan licentie- of gebruiksmetadata naar Desert Ant Labs sturen.

## Publiceren op GitHub Pages

Er staat een demo klaar op [daphnebruggeman.github.io/DesertAntsTesting](https://daphnebruggeman.github.io/DesertAntsTesting/).

De workflow in `.github/workflows/pages.yml` bouwt en publiceert de statische app bij iedere push naar `main`. Schakel in de GitHub-repository onder **Settings → Pages** de publicatiebron **GitHub Actions** in. Na de eerste workflow-run staat de app op de Pages-URL van de repository.

Test de Pages-build lokaal met `npm.cmd run build:pages`; de statische bestanden komen in `dist/pages`. De gepubliceerde WASM-bestanden zijn samen ongeveer 200 MB, al downloadt de browser die niet allemaal tegelijk. De eerste modeldownload kan ook groot zijn.

GitHub Pages gebruikt HTTPS, zodat de browser microfoontoegang kan geven. Gebruik een recente browser; ondersteuning voor scherm-/tabbladaudio hangt af van de browser. Who wordt gedistribueerd onder de [Desert Ant Labs Source-Available License](https://license.desertant.com/); lees de voorwaarden na bij commercieel gebruik.

## Vereisten

* Node.js 20 of nieuwer
* npm
* Een microfoon; computergeluid opnemen is optioneel

## Installatie

Gebruik in PowerShell op Windows `npm.cmd` (PowerShell kan het `npm`-script blokkeren):

```
npm.cmd install
```

## Webinterface

Start de lokale server:

```
npm.cmd start
```

Open http://127.0.0.1:3000 in je browser, geef toegang tot je microfoon en klik op Start opname. Zet vóór het starten desgewenst **Neem ook computergeluid op** aan. De browser vraagt dan om een tabblad of scherm te delen; kies een bron en schakel audio delen in. Beschikbaarheid hangt af van de browser en het gekozen tabblad/scherm. Klik op Stoppen en transcriberen wanneer je klaar bent. Houd het PowerShell-venster open terwijl je de app gebruikt; druk op Ctrl+C in dat venster om de server te stoppen. Transcriptie en sprekerherkenning draaien lokaal in de browser.

De browser vraagt toestemming voor de microfoon en, als je computergeluid kiest, voor schermdeling. Audio en toegevoegde documenten worden lokaal verwerkt en niet naar een transcriptie-API gestuurd.

Je kunt vóór de opname één Word-document (`.docx`), PDF of tekstbestand (`.txt`) toevoegen als context. De tekst wordt lokaal naar Markdown omgezet en samen met de transcriptie opgenomen in de gekopieerde of gedownloade `.md`-uitvoer. De documentinhoud wordt niet gebruikt om de spraakherkenning te sturen of te corrigeren. PDF's moeten selecteerbare tekst bevatten; scans en afbeeldingen worden niet met OCR uitgelezen.

Er staan standaard drie workshoprollen klaar: Privacy officer, Burger en Use case houder. Vink de rollen aan die meedoen en pas de namen aan of voeg zelf rollen toe. De gekozen labels worden gekoppeld in de volgorde waarin sprekers voor het eerst aan het woord komen; een leeg naamveld krijgt een standaardlabel. Je kunt vóór het starten ook een microfoon kiezen. De namen verschijnen in de transcriptie en in de gekopieerde tekst. Je kunt de tekst per zin bewerken; Kopieer Markdown neemt de wijzigingen mee. De sprekerlabels volgen de volgorde waarin Who sprekers voor het eerst hoort; de herkenning geeft geen zekerheid over iemands identiteit. Diarisatie is in bèta, dus bij opnames met veel ruis, overlappende spraak en vergelijkbare stemmen kunnen labels onjuist zijn. Een woord zonder duidelijke spreker-match wordt gemarkeerd als Onbekend.

## Opdrachtregelinterface

De CLI is nog steeds beschikbaar:

```
npm.cmd run cli -- ".\audio.wav"
```

## Gebruikte API

Dit project volgt het Node-gebruik van Voz zoals beschreven in `docs/models/voz.md` en `packages/voz-node/README.md`:

* `Voz.load()` laadt Voz met `onnxruntime-web` in de browser; de CLI gebruikt `onnxruntime-node`.
* `voz.transcribe(input, { onProgress })` transcribeert de opname lokaal en rapporteert de voortgang.
* `result.words` bevat items van de vorm `{ text, start, end }`, met tijden in seconden.
* `Who.load()` en `who.diarize(input)` in de browser bepalen lokaal de spreekbeurten; de woordtijdstempels van Voz worden aan die beurten gekoppeld.
