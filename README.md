# Voz Transcriber

Een lokale webinterface en CLI om audio te transcriberen met `@desert-ant-labs/voz` en te herkennen wie er sprak met `@desert-ant-labs/who`. De volledige broncode van de applicatie, inclusief HTML, CSS, browserlogica en lokale server, staat in `src/server.ts`.

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

Open http://127.0.0.1:3000 in je browser, geef toegang tot je microfoon en klik op Start opname. Zet vóór het starten desgewenst **Neem ook computergeluid op** aan. De browser vraagt dan om een tabblad of scherm te delen; kies een bron en schakel audio delen in. Beschikbaarheid hangt af van de browser en het gekozen tabblad/scherm. Klik op Stoppen en transcriberen wanneer je klaar bent. Houd het PowerShell-venster open terwijl je de app gebruikt; druk op Ctrl+C in dat venster om de server te stoppen. Er kan maar één opname tegelijk worden verwerkt. Bij het eerste gebruik downloaden Voz en Who elk hun model en slaan dat op in de cache; latere opnames gebruiken die opnieuw. Who downloadt zijn model in de browser (ongeveer 32 MB) en draait lokaal via WebAssembly. De code van Who wordt pas geladen wanneer het eerste transcript klaar is.

De browser vraagt toestemming voor de microfoon en, als je computergeluid kiest, voor schermdeling. De server luistert alleen op je eigen computer; audio wordt lokaal verwerkt en niet naar een transcriptie-API gestuurd. Who kan licentie- of gebruiksmetadata naar Desert Ant Labs sturen; audio maakt geen deel uit van dat verzoek. Uploads zijn beperkt tot 250 MB.

Who labelt sprekers als Spreker 1, Spreker 2, enzovoort, in de volgorde waarin ze voor het eerst spreken. Dit zijn geen namen of identiteiten. Diarisatie is in bèta, dus bij opnames met veel ruis, overlappende spraak en vergelijkbare stemmen kunnen labels onjuist zijn. Een woord zonder duidelijke spreker-match wordt gemarkeerd als Onbekend.

Who wordt gedistribueerd onder de [Desert Ant Labs Source-Available License](https://license.desertant.com/); lees de voorwaarden na bij commercieel gebruik.

## Opdrachtregelinterface

De CLI is nog steeds beschikbaar:

```
npm.cmd run cli -- ".\audio.wav"
```

## Gebruikte API

Dit project volgt het Node-gebruik van Voz zoals beschreven in `docs/models/voz.md` en `packages/voz-node/README.md`:

* `Voz.load({ ort })` laadt Voz met `onnxruntime-node`.
* `voz.transcribe(input, { onProgress })` transcribeert WAV-audio en rapporteert de voortgang.
* `result.words` bevat items van de vorm `{ text, start, end }`, met tijden in seconden.
* `Who.load()` en `who.diarize(input)` in de browser bepalen lokaal de spreekbeurten; de woordtijdstempels van Voz worden aan die beurten gekoppeld.
