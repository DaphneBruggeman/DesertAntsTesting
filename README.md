# Voz Transcriber

A local web interface and CLI for transcribing audio with `@desert-ant-labs/voz` and identifying who spoke with `@desert-ant-labs/who`. The complete application source, including its HTML, CSS, browser logic, and local server, lives in [`src/server.ts`](./src/server.ts).

## Requirements

- Node.js 20 or newer
- npm
- A microphone

## Install

In PowerShell on Windows, use `npm.cmd` (PowerShell may block the `npm` script):

```powershell
npm.cmd install
```

## Web interface

Start the local server:

```powershell
npm.cmd start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser, allow microphone access, click **Start opname**, and click **Stoppen en transcriberen** when you're done. Keep the PowerShell window open while using the app; press Ctrl+C there to stop the server. Only one recording can be processed at a time. On first use, Voz and Who each download and cache their model; later recordings reuse them. Who downloads its model in the browser (about 32 MB) and runs locally through WebAssembly. The Who code is loaded only when the first transcript is ready.

The browser asks permission to use your microphone. The server listens only on your own computer; audio is processed locally and is not sent to a transcription API. Who may contact Desert Ant Labs with license or usage metadata; audio is not part of that request. Uploads are limited to 250 MB.

Who labels speakers as **Spreker 1**, **Spreker 2**, and so on, in the order they first speak. These are not names or identities. Diarization is beta, so noisy recordings, overlapping speech, and similar voices can lead to incorrect labels. A word with no clear speaker match is marked **Onbekend**.

Who is distributed under the [Desert Ant Labs Source-Available License](https://license.desertant.com/); review its terms for commercial use.

## Command-line interface

The CLI is still available:

```powershell
npm.cmd run cli -- ".\audio.wav"
```

## API used

This project follows Voz's Node usage documented in [`docs/models/voz.md`](https://github.com/Desert-Ant-Labs/desert-ant-core/blob/main/docs/models/voz.md) and [`packages/voz-node/README.md`](https://github.com/Desert-Ant-Labs/desert-ant-core/blob/main/packages/voz-node/README.md):

- `Voz.load({ ort })` loads Voz with `onnxruntime-node`.
- `voz.transcribe(input, { onProgress })` transcribes WAV audio and reports progress.
- `result.words` contains `{ text, start, end }` entries, with times in seconds.
- The browser's `Who.load()` and `who.diarize(input)` identify speaker turns locally; Voz word timestamps are matched to those turns.
