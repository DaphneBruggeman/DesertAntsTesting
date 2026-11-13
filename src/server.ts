import { Voz } from "@desert-ant-labs/voz";
import * as ort from "onnxruntime-node";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { VozResult } from "@desert-ant-labs/voz";
import { build } from "esbuild";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);
const maxUploadBytes = 250 * 1024 * 1024;
const require = createRequire(import.meta.url);
const whoWasmPath = require.resolve("@desert-ant-labs/who/wasm");
const litertWasmDirectory = join(dirname(require.resolve("@litertjs/core")), "..", "wasm");
const vozWasmPath = require.resolve("@desert-ant-labs/voz/wasm");
const pageHtml = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../index.html"), "utf8");
const styles = [
  ":root {\r",
  "  color-scheme: light;\r",
  "  font-family: \"Segoe UI\", Arial, sans-serif;\r",
  "  color: #1d2c3d;\r",
  "  background: #f1f7fd;\r",
  "  font-synthesis: none;\r",
  "  text-rendering: optimizeLegibility;\r",
  "  -webkit-font-smoothing: antialiased;\r",
  "  -moz-osx-font-smoothing: grayscale;\r",
  "  --blue: #397bb8;\r",
  "  --blue-dark: #2b679f;\r",
  "  --blue-soft: #e7f1fb;\r",
  "  --muted: #78889a;\r",
  "  --line: #e0eaf3;\r",
  "}\r",
  "\r",
  "* { box-sizing: border-box; }\r",
  "\r",
  "body {\r",
  "  min-width: 320px;\r",
  "  min-height: 100vh;\r",
  "  margin: 0;\r",
  "  background:\r",
  "    radial-gradient(ellipse at 87% 8%, rgba(205, 226, 246, .62), transparent 30rem),\r",
  "    #f1f7fd;\r",
  "}\r",
  "\r",
  "button { font: inherit; }\r",
  "\r",
  ".shell { width: min(100% - 48px, 760px); margin: 0 auto; }\r",
  "\r",
  ".topbar {\r",
  "  display: flex;\r",
  "  justify-content: space-between;\r",
  "  align-items: center;\r",
  "  padding: 27px 0;\r",
  "  border-bottom: 1px solid rgba(43, 74, 105, .1);\r",
  "}\r",
  "\r",
  ".brand {\r",
  "  display: inline-flex;\r",
  "  align-items: center;\r",
  "  gap: 10px;\r",
  "  color: #20364d;\r",
  "  font: 800 17px \"Segoe UI\", Arial, sans-serif;\r",
  "  letter-spacing: -.7px;\r",
  "  text-decoration: none;\r",
  "}\r",
  "\r",
  ".brand-mark {\r",
  "  display: grid;\r",
  "  width: 29px;\r",
  "  height: 29px;\r",
  "  place-items: center;\r",
  "  border-radius: 9px;\r",
  "  color: #f5f9fe;\r",
  "  background: var(--blue);\r",
  "  font: 800 21px \"Segoe UI\", Arial, sans-serif;\r",
  "}\r",
  "\r",
  ".brand-light { color: #8392a1; font-weight: 500; }\r",
  "\r",
  ".local-badge {\r",
  "  display: inline-flex;\r",
  "  align-items: center;\r",
  "  gap: 8px;\r",
  "  padding: 8px 11px;\r",
  "  border: 1px solid #dfe9f3;\r",
  "  border-radius: 99px;\r",
  "  color: #5a7087;\r",
  "  background: rgba(255,255,255,.62);\r",
  "  font-size: 11px;\r",
  "  font-weight: 600;\r",
  "}\r",
  "\r",
  ".live-dot { width: 7px; height: 7px; border-radius: 50%; background: #5799d0; }\r",
  "\r",
  ".intro { padding: 72px 0 37px; }\r",
  "\r",
  ".eyebrow {\r",
  "  margin: 0 0 15px;\r",
  "  color: #5986b0;\r",
  "  font: 500 10px Consolas, monospace;\r",
  "  letter-spacing: 1.7px;\r",
  "}\r",
  "\r",
  "h1 {\r",
  "  margin: 0;\r",
  "  color: #1e3145;\r",
  "  font: 700 clamp(42px, 7vw, 61px)/1.07 \"Segoe UI\", Arial, sans-serif;\r",
  "  letter-spacing: -3.4px;\r",
  "}\r",
  "\r",
  "h1 span { color: #6f9bc1; }\r",
  "\r",
  ".intro-copy {\r",
  "  max-width: 475px;\r",
  "  margin: 19px 0 0;\r",
  "  color: #75869a;\r",
  "  font-size: 15px;\r",
  "  line-height: 1.7;\r",
  "}\r",
  "\r",
  ".workspace {\r",
  "  padding: 22px;\r",
  "  border: 1px solid rgba(49, 75, 101, .1);\r",
  "  border-radius: 17px;\r",
  "  background: rgba(255,255,255,.8);\r",
  "  box-shadow: 0 12px 40px rgba(49, 68, 87, .05);\r",
  "}\r",
  "\r",
  ".recorder {\r",
  "  display: flex;\r",
  "  min-height: 270px;\r",
  "  flex-direction: column;\r",
  "  align-items: center;\r",
  "  justify-content: center;\r",
  "  padding: 25px 18px 18px;\r",
  "  border: 1px solid #e4edf5;\r",
  "  border-radius: 12px;\r",
  "  background: #fbfdff;\r",
  "}\r",
  "\r",
  ".recorder-icon {\r",
  "  display: grid;\r",
  "  width: 48px;\r",
  "  height: 48px;\r",
  "  margin-bottom: 13px;\r",
  "  place-items: center;\r",
  "  border-radius: 14px;\r",
  "  color: #397bb8;\r",
  "  background: #e7f1fb;\r",
  "}\r",
  "\r",
  ".recorder-icon svg { width: 25px; height: 25px; }\r",
  ".recording-status { margin: 0; color: #344a61; font-size: 14px; font-weight: 600; }\r",
  ".recording-hint { margin: 6px 0 0; color: #8a98a8; font-size: 11px; text-align: center; }\r",
  ".capture-option { display: flex; width: min(100%, 380px); align-items: flex-start; gap: 9px; margin-top: 13px; color: #52677b; cursor: pointer; }\r",
  ".capture-option input { margin: 2px 0 0; accent-color: var(--blue); }\r",
  ".capture-option span { display: grid; gap: 3px; }\r",
  ".capture-option strong { font-size: 11px; font-weight: 600; }\r",
  ".capture-option small { color: #8a98a8; font-size: 10px; line-height: 1.4; }\r",
  ".recording-time { margin-top: 15px; color: #354c64; font: 500 24px Consolas, monospace; font-variant-numeric: tabular-nums; }\r",
  "\r",
  ".recording-visual {\r",
  "  display: flex;\r",
  "  height: 25px;\r",
  "  align-items: center;\r",
  "  gap: 4px;\r",
  "  margin: 7px 0 9px;\r",
  "}\r",
  "\r",
  ".recording-visual span {\r",
  "  width: 3px;\r",
  "  height: 5px;\r",
  "  border-radius: 4px;\r",
  "  background: #b6d1e9;\r",
  "}\r",
  "\r",
  ".recording-visual.is-recording span { animation: sound-wave .65s ease-in-out infinite alternate; }\r",
  ".recording-visual.is-recording span:nth-child(2n) { animation-delay: .18s; }\r",
  ".recording-visual.is-recording span:nth-child(3n) { animation-delay: .34s; }\r",
  "@keyframes sound-wave { to { height: 20px; background: #5794c7; } }\r",
  "\r",
  ".recording-actions { width: min(100%, 380px); }\r",
  "\r",
  ".transcribe-button {\r",
  "  display: flex;\r",
  "  width: 100%;\r",
  "  justify-content: space-between;\r",
  "  align-items: center;\r",
  "  padding: 14px 16px;\r",
  "  border: 0;\r",
  "  border-radius: 9px;\r",
  "  color: white;\r",
  "  background: var(--blue);\r",
  "  cursor: pointer;\r",
  "  font-size: 13px;\r",
  "  font-weight: 600;\r",
  "  transition: background .2s, transform .2s, opacity .2s;\r",
  "}\r",
  "\r",
  ".transcribe-button:not(:disabled):hover { transform: translateY(-1px); background: var(--blue-dark); }\r",
  ".transcribe-button:disabled { cursor: not-allowed; opacity: .48; }\r",
  ".stop-button { background: #ae4c53; }\r",
  ".stop-button:not(:disabled):hover { background: #963d44; }\r",
  "\r",
  ".privacy-note { display: flex; align-items: center; gap: 7px; margin: 13px 0 0; color: #8795a4; font-size: 10px; }\r",
  ".privacy-dot { width: 6px; height: 6px; border-radius: 50%; background: #6da0ce; }\r",
  "\r",
  ".progress-card, .result-card {\r",
  "  margin-top: 20px;\r",
  "  padding: 18px;\r",
  "  border: 1px solid var(--line);\r",
  "  border-radius: 11px;\r",
  "  background: #fcfdff;\r",
  "}\r",
  "\r",
  ".progress-heading { display: flex; align-items: center; gap: 12px; }\r",
  ".progress-icon { display: grid; width: 34px; height: 34px; flex: none; place-items: center; border-radius: 10px; color: #397bb8; background: #e9f2fb; }\r",
  ".progress-icon.complete-icon { color: #2d7b74; }\r",
  ".progress-text { min-width: 0; flex: 1; }\r",
  ".progress-label { margin: 0; color: #344a61; font-size: 13px; font-weight: 600; }\r",
  ".progress-detail { margin: 4px 0 0; overflow: hidden; color: #8998a8; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }\r",
  ".progress-percent { color: #5d82a6; font: 11px Consolas, monospace; }\r",
  ".progress-track { height: 4px; margin-top: 15px; overflow: hidden; border-radius: 9px; background: #e7edf4; }\r",
  ".progress-fill { width: 0; height: 100%; border-radius: inherit; background: #5793c7; transition: width .25s ease; }\r",
  ".spinner { width: 15px; height: 15px; border: 2px solid #cfe0ef; border-top-color: #4c87b8; border-radius: 50%; animation: spin .8s linear infinite; }\r",
  "@keyframes spin { to { transform: rotate(360deg); } }\r",
  "\r",
  ".result-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }\r",
  ".result-heading .eyebrow { margin-bottom: 5px; }\r",
  "h2 { margin: 0; color: #2c435a; font: 700 20px \"Segoe UI\", Arial, sans-serif; letter-spacing: -.5px; }\r",
  ".copy-button { padding: 8px 10px; border: 1px solid #dce7f1; border-radius: 7px; color: #527b9f; background: white; cursor: pointer; font-size: 11px; font-weight: 600; }\r",
  ".copy-button:hover { border-color: #a9c7e1; }\r",
  ".transcript { display: grid; gap: 10px; margin-top: 14px; }\r",
  ".topic-planner { margin-bottom: 14px; padding: 16px; border: 1px solid var(--line); border-radius: 11px; background: #fcfdff; }\r",
  ".topic-planner-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }\r",
  ".topic-planner-heading h2 { font-size: 15px; }\r",
  ".topic-planner-heading p { margin: 4px 0 0; color: #8998a8; font-size: 11px; line-height: 1.4; }\r",
  ".add-topic-button, .remove-topic-button { padding: 7px 10px; border: 1px solid #dce7f1; border-radius: 7px; color: #527b9f; background: white; cursor: pointer; font-size: 11px; font-weight: 600; }\r",
  ".topic-input-list { display: grid; gap: 7px; margin-top: 12px; }\r",
  ".topic-input-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; }\r",
  ".topic-input { min-width: 0; padding: 8px 10px; border: 1px solid #dce7f1; border-radius: 7px; color: #354b61; background: white; font: 12px \"Segoe UI\", Arial, sans-serif; }\r",
  ".topic-section.drag-over { border-color: #75a9d2; background: #f0f7fd; }\r",
  ".sentence-drag-handle { cursor: grab; user-select: none; }\r",
  ".sentence-drag-handle:active { cursor: grabbing; }\r",
  ".topic-section { padding: 14px; border: 1px solid #e3ebf3; border-radius: 9px; background: #fbfdff; }\r",
  ".topic-heading { width: min(100%, 420px); margin: 0 0 10px; padding: 5px 7px; border: 1px solid transparent; border-radius: 6px; color: #355d80; background: transparent; font: 700 13px \"Segoe UI\", Arial, sans-serif; }\r",
  ".topic-heading:focus { border-color: #b7cfe4; outline: 2px solid #e7f1fb; background: white; }\r",
  ".speaker-turn { padding: 12px 14px; border: 1px solid #e3ebf3; border-left: 3px solid #7daed5; border-radius: 9px; background: #fbfdff; }\r",
  ".speaker-turn-0 { border-left-color: #6ea2cf; }\r",
  ".speaker-turn-1 { border-left-color: #73ad9f; }\r",
  ".speaker-turn-2 { border-left-color: #c4a06e; }\r",
  ".speaker-turn-3 { border-left-color: #a48bc7; }\r",
  ".speaker-turn-unknown { border-left-color: #a8b2bc; }\r",
  ".speaker-turn-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 8px; }\r",
  ".turn-time { color: #8797a7; font: 10px Consolas, monospace; white-space: nowrap; }\r",
  ".sentence-row { display: grid; grid-template-columns: 102px minmax(0, 1fr) auto; align-items: baseline; gap: 12px; padding-top: 7px; }\r",
  ".topic-move { max-width: 165px; padding: 5px 7px; border: 1px solid #dce7f1; border-radius: 6px; color: #61778c; background: white; font: 10px \"Segoe UI\", Arial, sans-serif; }\r",
  ".word-time { padding-top: 2px; color: #8797a7; font: 10px Consolas, monospace; }\r",
  ".word-text { margin: 0; color: #354b61; font-size: 13px; line-height: 1.6; }\r",
  ".sentence-edit { display: block; width: 100%; min-height: 48px; margin-top: 5px; padding: 5px 7px; border: 1px solid transparent; border-radius: 6px; color: inherit; background: transparent; font: inherit; line-height: inherit; resize: vertical; }\r",
  ".sentence-edit:focus { border-color: #b7cfe4; outline: 2px solid #e7f1fb; background: white; }\r",
  ".speaker-label { display: inline-block; padding: 3px 7px; border-radius: 99px; font-size: 9px; font-weight: 700; white-space: nowrap; }\r",
  ".speaker-0 { color: #326b9e; background: #e6f1fb; }\r",
  ".speaker-1 { color: #397c70; background: #e6f4f0; }\r",
  ".speaker-2 { color: #8a6743; background: #f7efe3; }\r",
  ".speaker-3 { color: #775f9b; background: #f0ebf8; }\r",
  ".speaker-unknown { color: #727f8d; background: #edf0f3; }\r",
  ".result-meta { margin: 13px 0 0; color: #8998a8; font-size: 11px; }\r",
  ".error-message { margin: 15px 0 0; padding: 12px 14px; border: 1px solid #efd6cf; border-radius: 8px; color: #9a4538; background: #fff8f6; font-size: 12px; line-height: 1.5; }\r",
  "\r",
  "footer { display: flex; justify-content: space-between; gap: 15px; padding: 19px 3px 28px; color: #8d99a6; font-size: 10px; }\r",
  "\r",
  "[hidden] { display: none !important; }\r",
  "\r",
  "@media (max-width: 560px) {\r",
  "  .shell { width: min(100% - 30px, 760px); }\r",
  "  .topbar { padding: 20px 0; }\r",
  "  .local-badge { gap: 6px; padding: 7px 8px; font-size: 9px; }\r",
  "  .intro { padding: 55px 0 29px; }\r",
  "  h1 { letter-spacing: -2.4px; }\r",
  "  .intro-copy { font-size: 13px; }\r",
  "  .workspace { padding: 13px; }\r",
  "  .recorder { min-height: 270px; padding-right: 12px; padding-left: 12px; }\r",
  "  footer { flex-direction: column; gap: 6px; }\r",
  "  .sentence-row { grid-template-columns: 80px minmax(0, 1fr); gap: 8px; }\r",
  "  .topic-move { grid-column: 2; justify-self: start; max-width: 100%; }\r",
  "  .topic-planner-heading { align-items: flex-start; }\r",
  "  .add-topic-button { flex: none; }\r",
  "}\r",
  "",
].join("\n");
const browserApp = [
  "const startButton = document.querySelector(\"#start-recording\");\r",
  "const stopButton = document.querySelector(\"#stop-recording\");\r",
  "const recordingStatus = document.querySelector(\"#recording-status\");\r",
  "const recordingHint = document.querySelector(\"#recording-hint\");\r",
  "const includeSystemAudio = document.querySelector(\"#include-system-audio\");\r",
  "const recordingTime = document.querySelector(\"#recording-time\");\r",
  "const recordingVisual = document.querySelector(\"#recording-visual\");\r",
  "const progressCard = document.querySelector(\"#progress-card\");\r",
  "const progressLabel = document.querySelector(\"#progress-label\");\r",
  "const progressDetail = document.querySelector(\"#progress-detail\");\r",
  "const progressPercent = document.querySelector(\"#progress-percent\");\r",
  "const progressFill = document.querySelector(\"#progress-fill\");\r",
  "const progressIcon = document.querySelector(\"#progress-icon\");\r",
  "const resultCard = document.querySelector(\"#result-card\");\r",
  "const transcript = document.querySelector(\"#transcript\");\r",
  "const resultMeta = document.querySelector(\"#result-meta\");\r",
  "const errorMessage = document.querySelector(\"#error-message\");\r",
  "const copyButton = document.querySelector(\"#copy-button\");\r",
  "const topicInputList = document.querySelector(\"#topic-input-list\");\r",
  "const addTopicButton = document.querySelector(\"#add-topic\");\r",
  "\r",
  "let completedText = \"\";\r",
  "let renderedTopics = [];\r",
  "let usingManualTopics = false;\r",
  "let nextSentenceId = 0;\r",
  "let vozPromise;\r",
  "let whoPromise;\r",
  "let mediaStream;\r",
  "let systemAudioStream;\r",
  "let audioContext;\r",
  "let sourceNode;\r",
  "let systemAudioSourceNode;\r",
  "let processorNode;\r",
  "let recordingChunks = [];\r",
  "let samplePosition = 0;\r",
  "let sourceFrameCount = 0;\r",
  "let previousSample = 0;\r",
  "let isRecording = false;\r",
  "let recordingStartedAt = 0;\r",
  "let recordingTimer;\r",
  "\r",
  "function showError(message) {\r",
  "  errorMessage.textContent = message;\r",
  "  errorMessage.hidden = false;\r",
  "}\r",
  "\r",
  "function setProgress({ stage, progress, message }) {\r",
  "  const labels = {\r",
  "    loading_model: \"Voz-model laden\",\r",
  "    transcribing: \"Audio transcriberen\",\r",
  "    loading_speakers: \"Sprekermodel laden\",\r",
  "    diarizing: \"Sprekers herkennen\",\r",
  "    complete: \"Transcriptie klaar\",\r",
  "    error: \"Er ging iets mis\",\r",
  "  };\r",
  "  progressLabel.textContent = labels[stage] ?? \"Klaarmaken\";\r",
  "  progressDetail.textContent = message ?? \"\";\r",
  "  const percent = Number.isFinite(progress) ? Math.round(progress * 100) : null;\r",
  "  progressFill.style.width = percent === null ? \"8%\" : `${percent}%`;\r",
  "  progressPercent.textContent = percent === null ? \"\" : `${percent}%`;\r",
  "\r",
  "  if (stage === \"complete\") {\r",
  "    progressIcon.textContent = \"✓\";\r",
  "    progressIcon.classList.add(\"complete-icon\");\r",
  "    progressFill.style.width = \"100%\";\r",
  "    progressPercent.textContent = \"100%\";\r",
  "  }\r",
  "}\r",
  "\r",
  "function setBusy(isBusy) {\r",
  "  startButton.disabled = isBusy;\r",
  "  includeSystemAudio.disabled = isBusy;\r",
  "  addTopicButton.disabled = isBusy;\r",
  "  topicInputList.querySelectorAll(\"input, button\").forEach((control) => { control.disabled = isBusy; });\r",
  "  if (!isRecording) startButton.hidden = false;\r",
  "  stopButton.hidden = true;\r",
  "  recordingStatus.textContent = isBusy ? \"Bezig met transcriptie\" : \"Klaar om op te nemen\";\r",
  "  recordingHint.textContent = isBusy\r",
  "    ? \"Je opname wordt lokaal verwerkt.\"\r",
  "    : \"Geef toestemming voor de microfoon en spreek wanneer je er klaar voor bent.\";\r",
  "}\r",
  "\r",
  "function formatTime(seconds) {\r",
  "  const minutes = Math.floor(seconds / 60).toString().padStart(2, \"0\");\r",
  "  const remainder = Math.floor(seconds % 60).toString().padStart(2, \"0\");\r",
  "  return `${minutes}:${remainder}`;\r",
  "}\r",
  "\r",
  "function appendSamples(monoSamples, sampleRate) {\r",
  "  const firstFrame = sourceFrameCount;\r",
  "  const nextFrame = firstFrame + monoSamples.length;\r",
  "  const ratio = sampleRate / 16000;\r",
  "  const output = [];\r",
  "\r",
  "  while (samplePosition < nextFrame - 1) {\r",
  "    const lowFrame = Math.floor(samplePosition);\r",
  "    const highFrame = lowFrame + 1;\r",
  "    if (highFrame >= nextFrame) break;\r",
  "    const low = lowFrame < firstFrame\r",
  "      ? previousSample\r",
  "      : monoSamples[lowFrame - firstFrame];\r",
  "    const high = highFrame < firstFrame\r",
  "      ? previousSample\r",
  "      : monoSamples[highFrame - firstFrame];\r",
  "    const fraction = samplePosition - lowFrame;\r",
  "    const sample = low + (high - low) * fraction;\r",
  "    output.push(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))));\r",
  "    samplePosition += ratio;\r",
  "  }\r",
  "\r",
  "  previousSample = monoSamples[monoSamples.length - 1] ?? previousSample;\r",
  "  sourceFrameCount = nextFrame;\r",
  "  if (output.length) recordingChunks.push(Int16Array.from(output));\r",
  "}\r",
  "\r",
  "function encodeWav() {\r",
  "  while (samplePosition <= sourceFrameCount - 1 && sourceFrameCount > 0) {\r",
  "    const sample = Math.max(-32768, Math.min(32767, Math.round(previousSample * 32767)));\r",
  "    recordingChunks.push(Int16Array.of(sample));\r",
  "    samplePosition += 16000 / audioContext.sampleRate;\r",
  "  }\r",
  "\r",
  "  const sampleCount = recordingChunks.reduce((total, chunk) => total + chunk.length, 0);\r",
  "  if (!sampleCount) throw new Error(\"Er is geen audio opgenomen. Probeer het nog een keer.\");\r",
  "  const buffer = new ArrayBuffer(44 + sampleCount * 2);\r",
  "  const view = new DataView(buffer);\r",
  "  const writeText = (offset, text) => {\r",
  "    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));\r",
  "  };\r",
  "\r",
  "  writeText(0, \"RIFF\");\r",
  "  view.setUint32(4, 36 + sampleCount * 2, true);\r",
  "  writeText(8, \"WAVE\");\r",
  "  writeText(12, \"fmt \");\r",
  "  view.setUint32(16, 16, true);\r",
  "  view.setUint16(20, 1, true);\r",
  "  view.setUint16(22, 1, true);\r",
  "  view.setUint32(24, 16000, true);\r",
  "  view.setUint32(28, 32000, true);\r",
  "  view.setUint16(32, 2, true);\r",
  "  view.setUint16(34, 16, true);\r",
  "  writeText(36, \"data\");\r",
  "  view.setUint32(40, sampleCount * 2, true);\r",
  "\r",
  "  let sampleOffset = 0;\r",
  "  for (const chunk of recordingChunks) {\r",
  "    for (const sample of chunk) {\r",
  "      view.setInt16(44 + sampleOffset * 2, sample, true);\r",
  "      sampleOffset++;\r",
  "    }\r",
  "  }\r",
  "  recordingChunks = [];\r",
  "  return new Blob([buffer], { type: \"audio/wav\" });\r",
  "}\r",
  "\r",
  "function makeSentences(words) {\r",
  "  const sentences = [];\r",
  "  let currentWords = [];\r",
  "  let currentSpeaker;\r",
  "  const appendSentence = () => {\r",
  "    if (!currentWords.length) return;\r",
  "    sentences.push({ words: currentWords, speaker: currentSpeaker });\r",
  "    currentWords = [];\r",
  "  };\r",
  "  for (const word of words) {\r",
  "    if (currentWords.length && word.speaker !== currentSpeaker) appendSentence();\r",
  "    if (!currentWords.length) currentSpeaker = word.speaker;\r",
  "    currentWords.push(word);\r",
  "    if (/[.!?…][\"'”’)]*$/.test(word.text)) appendSentence();\r",
  "  }\r",
  "  appendSentence();\r",
  "  return sentences;\r",
  "}\r",
  "\r",
  "function transcriptText() {\r",
  "  const copyLines = [];\r",
  "  for (const topic of renderedTopics) {\r",
  "    if (topic.title) copyLines.push(topic.title);\r",
  "    for (const sentence of topic.sentences) {\r",
  "      const speakerLabel = sentence.speaker === null ? \"Onbekende spreker\" : `Spreker ${sentence.speaker + 1}`;\r",
  "      const sentenceText = sentence.editedText ?? sentence.words.map((word) => word.text).join(\" \");\r",
  "      copyLines.push(`${speakerLabel}: ${sentenceText}`);\r",
  "    }\r",
  "    copyLines.push(\"\");\r",
  "  }\r",
  "  return copyLines.join(\"\\n\").trim();\r",
  "}\r",
  "\r",
  "function moveSentence(sentenceId, destinationIndex) {\r",
  "  const source = renderedTopics.find((topic) => topic.sentences.some((sentence) => sentence.id === sentenceId));\r",
  "  const destination = renderedTopics[destinationIndex];\r",
  "  if (!source || !destination || source === destination) return;\r",
  "  const sentenceIndex = source.sentences.findIndex((sentence) => sentence.id === sentenceId);\r",
  "  const [sentence] = source.sentences.splice(sentenceIndex, 1);\r",
  "  destination.sentences.push(sentence);\r",
  "  destination.sentences.sort((a, b) => a.words[0].start - b.words[0].start);\r",
  "  renderTopicBlocks();\r",
  "}\r",
  "\r",
  "function renderTopicBlocks() {\r",
  "  transcript.replaceChildren();\r",
  "\r",
  "  renderedTopics.forEach((topic, topicIndex) => {\r",
  "    const topicSection = document.createElement(\"section\");\r",
  "    topicSection.className = \"topic-section\";\r",
  "    if (topic.title) {\r",
  "      const topicHeading = document.createElement(\"input\");\r",
  "      topicHeading.className = \"topic-heading\";\r",
  "      topicHeading.type = \"text\";\r",
  "      topicHeading.maxLength = 100;\r",
  "      topicHeading.setAttribute(\"aria-label\", `Onderwerp ${topicIndex + 1} bewerken`);\r",
  "      topicHeading.value = topic.title;\r",
  "      topicHeading.addEventListener(\"change\", () => {\r",
  "        topic.title = topicHeading.value.trim();\r",
  "        renderTopicBlocks();\r",
  "      });\r",
  "      topicSection.append(topicHeading);\r",
  "    }\r",
  "    topicSection.addEventListener(\"dragover\", (event) => {\r",
  "      event.preventDefault();\r",
  "      topicSection.classList.add(\"drag-over\");\r",
  "    });\r",
  "    topicSection.addEventListener(\"dragleave\", (event) => {\r",
  "      if (!topicSection.contains(event.relatedTarget)) topicSection.classList.remove(\"drag-over\");\r",
  "    });\r",
  "    topicSection.addEventListener(\"drop\", (event) => {\r",
  "      event.preventDefault();\r",
  "      topicSection.classList.remove(\"drag-over\");\r",
  "      const draggedSentenceId = event.dataTransfer.getData(\"text/plain\");\r",
  "      if (!/^\\d+$/.test(draggedSentenceId)) return;\r",
  "      moveSentence(Number(draggedSentenceId), topicIndex);\r",
  "    });\r",
  "    if (topic.title && topic.sentences.length === 0) {\r",
  "      const dropHint = document.createElement(\"p\");\r",
  "      dropHint.className = \"progress-detail\";\r",
  "      dropHint.textContent = \"Sleep zinnen hierheen\";\r",
  "      topicSection.append(dropHint);\r",
  "    }\r",
  "\r",
  "    for (const [sentenceIndex, sentence] of topic.sentences.entries()) {\r",
  "      const speakerLabel = sentence.speaker === null ? \"Onbekende spreker\" : `Spreker ${sentence.speaker + 1}`;\r",
  "      const sentenceRow = document.createElement(\"div\");\r",
  "      sentenceRow.className = \"sentence-row\";\r",
  "      const sentenceTime = document.createElement(\"span\");\r",
  "      sentenceTime.className = \"word-time\";\r",
  "      sentenceTime.classList.add(\"sentence-drag-handle\");\r",
  "      sentenceTime.draggable = true;\r",
  "      sentenceTime.title = \"Sleep deze zin naar een onderwerp\";\r",
  "      sentenceTime.textContent = `${sentence.words[0].start.toFixed(2)} – ${sentence.words[sentence.words.length - 1].end.toFixed(2)} s`;\r",
  "      sentenceTime.addEventListener(\"dragstart\", (event) => {\r",
  "        event.dataTransfer.setData(\"text/plain\", String(sentence.id));\r",
  "        event.dataTransfer.effectAllowed = \"move\";\r",
  "      });\r",
  "      const text = document.createElement(\"div\");\r",
  "      text.className = \"word-text\";\r",
  "      const speaker = document.createElement(\"span\");\r",
  "      speaker.className = sentence.speaker === null\r",
  "        ? \"speaker-label speaker-unknown\"\r",
  "        : `speaker-label speaker-${sentence.speaker % 4}`;\r",
  "      speaker.textContent = speakerLabel;\r",
  "      const sentenceEdit = document.createElement(\"textarea\");\r",
  "      sentenceEdit.className = \"sentence-edit\";\r",
  "      sentenceEdit.rows = 2;\r",
  "      sentenceEdit.maxLength = 5000;\r",
  "      sentenceEdit.setAttribute(\"aria-label\", `Zin ${sentenceIndex + 1} bewerken`);\r",
  "      sentenceEdit.value = sentence.editedText ?? sentence.words.map((word) => word.text).join(\" \");\r",
  "      sentenceEdit.addEventListener(\"input\", () => {\r",
  "        sentence.editedText = sentenceEdit.value;\r",
  "        completedText = transcriptText();\r",
  "      });\r",
  "      text.append(speaker, sentenceEdit);\r",
  "      const moveSelect = document.createElement(\"select\");\r",
  "      moveSelect.className = \"topic-move\";\r",
  "      moveSelect.setAttribute(\"aria-label\", `Verplaats zin naar een onderwerp`);\r",
  "      renderedTopics.forEach((destination, destinationIndex) => {\r",
  "        const option = document.createElement(\"option\");\r",
  "        option.value = String(destinationIndex);\r",
  "        option.textContent = destination.title || \"Geen onderwerp\";\r",
  "        option.selected = destinationIndex === topicIndex;\r",
  "        moveSelect.append(option);\r",
  "      });\r",
  "      moveSelect.addEventListener(\"change\", () => {\r",
  "        const destinationIndex = Number(moveSelect.value);\r",
  "        moveSentence(sentence.id, destinationIndex);\r",
  "      });\r",
  "      sentenceRow.append(sentenceTime, text, moveSelect);\r",
  "      topicSection.append(sentenceRow);\r",
  "    }\r",
  "    transcript.append(topicSection);\r",
  "  });\r",
  "  completedText = transcriptText();\r",
  "}\r",
  "\r",
  "function renderResult(result) {\r",
  "  const sentences = makeSentences(result.words);\r",
  "  sentences.forEach((sentence) => { sentence.id = nextSentenceId++; });\r",
  "  const manualTopicNames = [...new Set([...topicInputList.querySelectorAll(\".topic-input\")]\r",
  "    .map((input) => input.value.trim())\r",
  "    .filter(Boolean))];\r",
  "  usingManualTopics = manualTopicNames.length > 0;\r",
  "  renderedTopics = usingManualTopics\r",
  "    ? manualTopicNames.map((title) => ({ title, sentences: [] }))\r",
  "    : [{ title: \"\", sentences }];\r",
  "  if (usingManualTopics && renderedTopics.length) renderedTopics[0].sentences = sentences;\r",
  "  renderTopicBlocks();\r",
  "\r",
  "  if (result.words.length === 0) {\r",
  "    const empty = document.createElement(\"p\");\r",
  "    empty.className = \"word-text\";\r",
  "    empty.textContent = \"Er zijn geen woorden herkend.\";\r",
  "    transcript.append(empty);\r",
  "  }\r",
  "\r",
  "  resultMeta.textContent = `${result.speakerCount} ${result.speakerCount === 1 ? \"spreker\" : \"sprekers\"} herkend · ${result.words.length} woorden · ${result.duration.toFixed(1)} seconden audio · verwerkt in ${result.processingTime.toFixed(1)} seconden`;\r",
  "  resultCard.hidden = false;\r",
  "  resultCard.scrollIntoView({ behavior: \"smooth\", block: \"nearest\" });\r",
  "}\r",
  "\r",
  "async function diarizeTranscript(audio, result) {\r",
  "  setProgress({ stage: \"loading_speakers\", message: \"Who-model klaarmaken...\" });\r",
  "  if (!whoPromise) {\r",
  "    let lastProgress = -1;\r",
  "    whoPromise = import(\"@desert-ant-labs/who\").then(({ Who }) => Who.load({\r",
  "        accelerator: \"wasm\",\r",
  "        litertWasmDir: new URL(\"./litert-wasm/\", document.baseURI).href,\r",
  "        onProgress: (progress) => {\r",
  "          const percent = Math.round(progress * 100);\r",
  "          if (percent === lastProgress) return;\r",
  "          lastProgress = percent;\r",
  "          setProgress({\r",
  "            stage: \"loading_speakers\",\r",
  "            progress,\r",
  "            message: progress < 1 ? \"Sprekermodel downloaden...\" : \"Sprekermodel initialiseren...\",\r",
  "          });\r",
  "        },\r",
  "      }));\r",
  "  }\r",
  "  const who = await whoPromise;\r",
  "  setProgress({ stage: \"diarizing\", message: \"Sprekers in de opname herkennen...\" });\r",
  "  const diarization = await who.diarize(audio);\r",
  "  const words = result.words.map((word) => {\r",
  "    const overlaps = new Map();\r",
  "    for (const turn of diarization.turns) {\r",
  "      const overlap = Math.max(0, Math.min(word.end, turn.end) - Math.max(word.start, turn.start));\r",
  "      if (overlap > 0) overlaps.set(turn.speaker, (overlaps.get(turn.speaker) ?? 0) + overlap);\r",
  "    }\r",
  "\r",
  "    let speaker = null;\r",
  "    let longestOverlap = 0;\r",
  "    for (const [candidate, overlap] of overlaps) {\r",
  "      if (overlap > longestOverlap) {\r",
  "        speaker = candidate;\r",
  "        longestOverlap = overlap;\r",
  "      }\r",
  "    }\r",
  "    return { ...word, speaker };\r",
  "  });\r",
  "  return { ...result, words, speakerCount: diarization.speakerCount };\r",
  "}\r",
  "\r",
  "async function submitRecording(audio) {\r",
  "  setBusy(true);\r",
  "  errorMessage.hidden = true;\r",
  "  resultCard.hidden = true;\r",
  "  progressCard.hidden = false;\r",
  "  startButton.disabled = true;\r",
  "  progressIcon.innerHTML = '<span class=\"spinner\"></span>';\r",
  "  progressIcon.classList.remove(\"complete-icon\");\r",
  "  setProgress({ stage: \"loading_model\", message: \"Voz-model klaarmaken...\" });\r",
  "  try {\r",
  "    if (!vozPromise) {\r",
  "      let lastProgress = -1;\r",
  "      vozPromise = import(\"@desert-ant-labs/voz\").then(({ Voz }) => Voz.load({\r",
  "        ep: \"wasm\",\r",
  "        webnn: false,\r",
  "        onProgress: (progress) => {\r",
  "          const percent = Math.round(progress * 100);\r",
  "          if (percent === lastProgress) return;\r",
  "          lastProgress = percent;\r",
  "          setProgress({\r",
  "            stage: \"loading_model\",\r",
  "            progress,\r",
  "            message: progress < 1 ? \"Voz-model downloaden...\" : \"Voz-model initialiseren...\",\r",
  "          });\r",
  "        },\r",
  "      }));\r",
  "    }\r",
  "    const voz = await vozPromise;\r",
  "    setProgress({ stage: \"transcribing\", progress: 0, message: \"Audio wordt lokaal getranscribeerd...\" });\r",
  "    const transcriptResult = await voz.transcribe(audio, {\r",
  "      onProgress: (progress) => setProgress({\r",
  "        stage: \"transcribing\",\r",
  "        progress,\r",
  "        message: \"Audio wordt lokaal getranscribeerd...\",\r",
  "      }),\r",
  "    });\r",
  "    try {\r",
  "      const result = await diarizeTranscript(audio, transcriptResult);\r",
  "      setProgress({ stage: \"complete\", progress: 1, message: `${result.speakerCount} ${result.speakerCount === 1 ? \"spreker\" : \"sprekers\"} herkend.` });\r",
  "      renderResult(result);\r",
  "    } catch (error) {\r",
  "      whoPromise = undefined;\r",
  "      const detail = error instanceof Error ? error.message : String(error);\r",
  "      showError(`Transcriptie is klaar, maar sprekerherkenning is mislukt: ${detail}`);\r",
  "      setProgress({ stage: \"complete\", progress: 1, message: \"Transcriptie klaar; sprekerherkenning is mislukt.\" });\r",
  "      renderResult({\r",
  "        ...transcriptResult,\r",
  "        speakerCount: 0,\r",
  "        words: transcriptResult.words.map((word) => ({ ...word, speaker: null })),\r",
  "      });\r",
  "    }\r",
  "  } catch (error) {\r",
  "    vozPromise = undefined;\r",
  "    const detail = error instanceof Error ? error.message : String(error);\r",
  "    setProgress({ stage: \"error\", message: \"Lokale transcriptie is niet gelukt.\" });\r",
  "    showError(`Transcriptie is niet gelukt: ${detail}`);\r",
  "  } finally {\r",
  "    setBusy(false);\r",
  "  }\r",
  "}\r",
  "\r",
  "async function stopTracks() {\r",
  "  if (mediaStream) {\r",
  "    mediaStream.getTracks().forEach((track) => track.stop());\r",
  "    mediaStream = undefined;\r",
  "  }\r",
  "  if (systemAudioStream) {\r",
  "    systemAudioStream.getTracks().forEach((track) => track.stop());\r",
  "    systemAudioStream = undefined;\r",
  "  }\r",
  "  if (audioContext && audioContext.state !== \"closed\") {\r",
  "    await audioContext.close();\r",
  "  }\r",
  "  audioContext = undefined;\r",
  "  sourceNode = undefined;\r",
  "  systemAudioSourceNode = undefined;\r",
  "  processorNode = undefined;\r",
  "}\r",
  "\r",
  "async function startRecording() {\r",
  "  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {\r",
  "    showError(\"Deze browser ondersteunt geen microfoonopname. Open de pagina in een recente versie van Chrome, Edge of Firefox.\");\r",
  "    return;\r",
  "  }\r",
  "  if (includeSystemAudio.checked && !navigator.mediaDevices.getDisplayMedia) {\r",
  "    showError(\"Deze browser ondersteunt geen opname van computergeluid. Gebruik een recente versie van Chrome of Edge.\");\r",
  "    return;\r",
  "  }\r",
  "\r",
  "  errorMessage.hidden = true;\r",
  "  progressCard.hidden = true;\r",
  "  resultCard.hidden = true;\r",
  "  recordingTime.textContent = \"00:00\";\r",
  "  startButton.disabled = true;\r",
  "  includeSystemAudio.disabled = true;\r",
  "  addTopicButton.disabled = true;\r",
  "  topicInputList.querySelectorAll(\"input, button\").forEach((control) => { control.disabled = true; });\r",
  "  recordingStatus.textContent = includeSystemAudio.checked ? \"Toestemming voor audio vragen...\" : \"Toestemming voor de microfoon vragen...\";\r",
  "  recordingHint.textContent = includeSystemAudio.checked\r",
  "    ? \"Kies een tabblad of scherm en schakel audio delen in.\"\r",
  "    : \"Sta microfoontoegang toe in je browser.\";\r",
  "\r",
  "  try {\r",
  "    if (includeSystemAudio.checked) {\r",
  "      systemAudioStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });\r",
  "      if (!systemAudioStream.getAudioTracks().length) {\r",
  "        throw new Error(\"Er is geen computergeluid gedeeld. Kies in het deelvenster een bron en schakel audio delen in.\");\r",
  "      }\r",
  "    }\r",
  "    mediaStream = await navigator.mediaDevices.getUserMedia({\r",
  "      audio: { channelCount: 1, echoCancellation: !includeSystemAudio.checked, noiseSuppression: !includeSystemAudio.checked },\r",
  "    });\r",
  "    audioContext = new AudioContext();\r",
  "    await audioContext.resume();\r",
  "    sourceNode = audioContext.createMediaStreamSource(mediaStream);\r",
  "    processorNode = audioContext.createScriptProcessor(4096, 2, 1);\r",
  "    const inputGain = includeSystemAudio.checked ? 0.5 : 1;\r",
  "    const microphoneGainNode = audioContext.createGain();\r",
  "    microphoneGainNode.gain.value = inputGain;\r",
  "    sourceNode.connect(microphoneGainNode);\r",
  "    microphoneGainNode.connect(processorNode);\r",
  "    if (systemAudioStream) {\r",
  "      systemAudioSourceNode = audioContext.createMediaStreamSource(systemAudioStream);\r",
  "      const systemAudioGainNode = audioContext.createGain();\r",
  "      systemAudioGainNode.gain.value = inputGain;\r",
  "      systemAudioSourceNode.connect(systemAudioGainNode);\r",
  "      systemAudioGainNode.connect(processorNode);\r",
  "      systemAudioStream.getAudioTracks()[0].addEventListener(\"ended\", () => {\r",
  "        if (isRecording) recordingHint.textContent = \"Computergeluid delen is gestopt; de microfoonopname gaat door.\";\r",
  "      }, { once: true });\r",
  "    }\r",
  "    recordingChunks = [];\r",
  "    samplePosition = 0;\r",
  "    sourceFrameCount = 0;\r",
  "    previousSample = 0;\r",
  "    processorNode.onaudioprocess = (event) => {\r",
  "      const inputSamples = event.inputBuffer.getChannelData(0);\r",
  "      const outputSamples = new Float32Array(inputSamples.length);\r",
  "      for (let channel = 0; channel < event.inputBuffer.numberOfChannels; channel++) {\r",
  "        const channelSamples = event.inputBuffer.getChannelData(channel);\r",
  "        for (let i = 0; i < channelSamples.length; i++) {\r",
  "          outputSamples[i] += channelSamples[i] / event.inputBuffer.numberOfChannels;\r",
  "        }\r",
  "      }\r",
  "      appendSamples(outputSamples, audioContext.sampleRate);\r",
  "      event.outputBuffer.getChannelData(0).fill(0);\r",
  "    };\r",
  "    processorNode.connect(audioContext.destination);\r",
  "\r",
  "    isRecording = true;\r",
  "    recordingStartedAt = Date.now();\r",
  "    recordingStatus.textContent = \"Opname bezig\";\r",
  "    recordingHint.textContent = includeSystemAudio.checked\r",
  "      ? \"Microfoon en gedeeld computergeluid worden opgenomen.\"\r",
  "      : \"Spreek nu. Klik op stoppen zodra je klaar bent.\";\r",
  "    recordingVisual.classList.add(\"is-recording\");\r",
  "    startButton.hidden = true;\r",
  "    startButton.disabled = false;\r",
  "    stopButton.hidden = false;\r",
  "    recordingTimer = window.setInterval(() => {\r",
  "      recordingTime.textContent = formatTime((Date.now() - recordingStartedAt) / 1000);\r",
  "    }, 250);\r",
  "  } catch (error) {\r",
  "    await stopTracks();\r",
  "    startButton.disabled = false;\r",
  "    includeSystemAudio.disabled = false;\r",
  "    addTopicButton.disabled = false;\r",
  "    topicInputList.querySelectorAll(\"input, button\").forEach((control) => { control.disabled = false; });\r",
  "    recordingStatus.textContent = \"Klaar om op te nemen\";\r",
  "    recordingHint.textContent = \"Geef toestemming voor de gewenste audiobron(nen) om te beginnen.\";\r",
  "    const message = error instanceof DOMException && error.name === \"NotAllowedError\"\r",
  "      ? \"Toegang tot de microfoon of schermdeling is geweigerd. Sta toegang toe en probeer het opnieuw.\"\r",
  "      : error instanceof DOMException && error.name === \"NotFoundError\"\r",
  "        ? \"Er is geen microfoon gevonden. Sluit een microfoon aan en probeer opnieuw.\"\r",
  "        : error instanceof Error\r",
  "          ? `De opname kon niet starten: ${error.message}`\r",
  "          : String(error);\r",
  "    showError(message);\r",
  "  }\r",
  "}\r",
  "\r",
  "async function stopRecording() {\r",
  "  if (!isRecording) return;\r",
  "  isRecording = false;\r",
  "  window.clearInterval(recordingTimer);\r",
  "  stopButton.disabled = true;\r",
  "  stopButton.querySelector(\"span\").textContent = \"Opname afronden...\";\r",
  "  recordingVisual.classList.remove(\"is-recording\");\r",
  "  recordingStatus.textContent = \"Opname afronden\";\r",
  "  if (processorNode) {\r",
  "    processorNode.onaudioprocess = null;\r",
  "    processorNode.disconnect();\r",
  "  }\r",
  "  if (sourceNode) sourceNode.disconnect();\r",
  "  if (systemAudioSourceNode) systemAudioSourceNode.disconnect();\r",
  "\r",
  "  try {\r",
  "    const audio = encodeWav();\r",
  "    await stopTracks();\r",
  "    recordingTime.textContent = formatTime((Date.now() - recordingStartedAt) / 1000);\r",
  "    recordingStatus.textContent = \"Opname klaar\";\r",
  "    recordingHint.textContent = \"Transcriptie wordt gestart...\";\r",
  "    stopButton.hidden = true;\r",
  "    stopButton.disabled = false;\r",
  "    stopButton.querySelector(\"span\").textContent = \"Stoppen en transcriberen\";\r",
  "    submitRecording(audio);\r",
  "  } catch (error) {\r",
  "    await stopTracks();\r",
  "    stopButton.hidden = true;\r",
  "    stopButton.disabled = false;\r",
  "    stopButton.querySelector(\"span\").textContent = \"Stoppen en transcriberen\";\r",
  "    setBusy(false);\r",
  "    showError(error instanceof Error ? error.message : String(error));\r",
  "  }\r",
  "}\r",
  "\r",
  "startButton.addEventListener(\"click\", () => { void startRecording(); });\r",
  "stopButton.addEventListener(\"click\", () => { void stopRecording(); });\r",
  "function addTopicInput(value = \"\") {\r",
  "  const row = document.createElement(\"div\");\r",
  "  row.className = \"topic-input-row\";\r",
  "  const input = document.createElement(\"input\");\r",
  "  input.className = \"topic-input\";\r",
  "  input.type = \"text\";\r",
  "  input.maxLength = 100;\r",
  "  input.placeholder = \"Bijv. planning\";\r",
  "  input.setAttribute(\"aria-label\", \"Onderwerpnaam\");\r",
  "  input.value = value;\r",
  "  const removeButton = document.createElement(\"button\");\r",
  "  removeButton.className = \"remove-topic-button\";\r",
  "  removeButton.type = \"button\";\r",
  "  removeButton.textContent = \"Verwijderen\";\r",
  "  removeButton.setAttribute(\"aria-label\", \"Verwijder dit onderwerp\");\r",
  "  removeButton.addEventListener(\"click\", () => row.remove());\r",
  "  row.append(input, removeButton);\r",
  "  topicInputList.append(row);\r",
  "}\r",
  "for (let topicNumber = 1; topicNumber <= 5; topicNumber++) {\r",
  "  addTopicInput(`Onderwerp ${topicNumber}`);\r",
  "}\r",
  "addTopicButton.addEventListener(\"click\", () => addTopicInput());\r",
  "\r",
  "copyButton.addEventListener(\"click\", async () => {\r",
  "  try {\r",
  "    await navigator.clipboard.writeText(completedText);\r",
  "    copyButton.textContent = \"Gekopieerd!\";\r",
  "    window.setTimeout(() => { copyButton.textContent = \"Kopieer tekst\"; }, 1600);\r",
  "  } catch {\r",
  "    showError(\"Kopiëren is niet gelukt. Selecteer de tekst en kopieer deze handmatig.\");\r",
  "  }\r",
  "});\r",
  "",
].join("\n");
const jobs = new Map<string, Job>();
let activeJobId: string | undefined;
let vozPromise: Promise<Voz> | undefined;
let appBundle = "";

type JobStatus = {
  stage: "queued" | "loading_model" | "transcribing" | "complete" | "error";
  progress?: number;
  message: string;
  result?: VozResult;
};

type Job = {
  status: JobStatus;
  createdAt: number;
  listeners: Set<ServerResponse>;
};

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function updateJob(job: Job, status: JobStatus): void {
  job.status = status;
  const message = `data: ${JSON.stringify(status)}\n\n`;
  for (const listener of job.listeners) {
    if (!listener.write(message)) {
      listener.once("drain", () => undefined);
    }
  }
}

function sendCurrentStatus(response: ServerResponse, status: JobStatus): void {
  response.write(`data: ${JSON.stringify(status)}\n\n`);
}

async function readUpload(request: IncomingMessage): Promise<Buffer> {
  const contentType = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  if (contentType !== "audio/wav" && contentType !== "audio/x-wav") {
    throw new HttpError(415, "De opname moet een WAV-bestand zijn.");
  }

  const contentLength = Number(request.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
    throw new HttpError(413, "Dit bestand is groter dan de limiet van 250  MB.");
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxUploadBytes) {
      throw new HttpError(413, "Dit bestand is groter dan de limiet van 250  MB.");
    }
    chunks.push(buffer);
  }
  if (totalBytes === 0) throw new HttpError(400, "Het geüploade bestand is leeg.");
  const audio = Buffer.concat(chunks, totalBytes);
  if (
    audio.length < 44
    || audio.toString("ascii", 0, 4) !== "RIFF"
    || audio.toString("ascii", 8, 12) !== "WAVE"
    || audio.toString("ascii", 36, 40) !== "data"
    || audio.readUInt32LE(40) === 0
    || audio.readUInt32LE(40) > audio.length - 44
  ) {
    throw new HttpError(400, "De opname bevat geen geldige WAV-audio. Neem opnieuw op en probeer het nog eens, alsjeblieft.");
  }
  return audio;
}

async function transcribe(job: Job, audio: Buffer): Promise<void> {
  try {
    updateJob(job, { stage: "loading_model", progress: 0, message: "Voz-model klaarmaken..." });
    if (!vozPromise) {
      vozPromise = Voz.load({
        ort,
        onProgress: (progress) => updateJob(job, {
          stage: "loading_model",
          progress,
          message: progress < 1 ? "Spraakmodel downloaden..." : "Spraakmodel initialiseren...",
        }),
      });
    }
    const voz = await vozPromise;
    updateJob(job, { stage: "transcribing", progress: 0, message: "Audio analyseren..." });
    const result = await voz.transcribe(new Uint8Array(audio), {
      onProgress: (progress) => updateJob(job, {
        stage: "transcribing",
        progress,
        message: "Gesproken woorden herkennen...",
      }),
    });
    updateJob(job, { stage: "complete", progress: 1, message: "Transcriptie klaar.", result });
  } catch (error) {
    vozPromise = undefined;
    const message = error instanceof Error ? error.message : String(error);
    updateJob(job, { stage: "error", message: `Transcriptie mislukt: ${message}` });
  } finally {
    activeJobId = undefined;
  }
}

class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${host}`);

  if (request.method === "GET" && url.pathname === "/") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'self'; style-src 'self'; font-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://events.desertant.com https://huggingface.co https://*.huggingface.co https://*.hf.co; base-uri 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    response.end(pageHtml);
    return;
  }

  if (request.method === "GET" && (url.pathname === "/app.js" || url.pathname === "/styles.css")) {
    const isApp = url.pathname === "/app.js";
    const contentType = isApp ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8";
    const content = isApp ? appBundle : styles;
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
    return;
  }

  if (request.method === "GET" && url.pathname.endsWith("/WhoWeb.wasm")) {
    const wasm = await readFile(whoWasmPath);
    response.writeHead(200, {
      "Content-Type": "application/wasm",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(wasm);
    return;
  }

  const litertFileMatch = request.method === "GET"
    && url.pathname.match(/^\/litert-wasm\/(litert_wasm_(?:compat_|threaded_|jspi_)?internal\.(?:js|wasm))$/);
  if (litertFileMatch) {
    const fileName = litertFileMatch[1];
    const content = await readFile(join(litertWasmDirectory, fileName));
    response.writeHead(200, {
      "Content-Type": fileName.endsWith(".wasm") ? "application/wasm" : "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/transcribe") {
    if (activeJobId) {
      sendJson(response, 409, { error: "Er wordt al een bestand verwerkt. Wacht tot die transcriptie klaar is." });
      return;
    }
    const audio = await readUpload(request);
    if (activeJobId) {
      sendJson(response, 409, { error: "Er wordt al een bestand verwerkt. Wacht tot die transcriptie klaar is." });
      return;
    }
    const id = randomUUID();
    const job: Job = {
      status: { stage: "queued", message: "In de wachtrij..." },
      createdAt: Date.now(),
      listeners: new Set(),
    };
    jobs.set(id, job);
    activeJobId = id;
    sendJson(response, 202, { id });
    void transcribe(job, audio);
    return;
  }

  const eventsMatch = request.method === "GET" && url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)\/events$/i);
  if (eventsMatch) {
    const job = jobs.get(eventsMatch[1]);
    if (!job) {
      sendJson(response, 404, { error: "Deze transcriptie bestaat niet meer." });
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    sendCurrentStatus(response, job.status);
    if (job.status.stage === "complete" || job.status.stage === "error") {
      response.end();
      return;
    }
    job.listeners.add(response);
    response.on("close", () => job.listeners.delete(response));
    return;
  }

  sendJson(response, 404, { error: "Pagina niet gevonden." });
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    if (response.headersSent) {
      response.destroy(error instanceof Error ? error : undefined);
      return;
    }
    if (error instanceof HttpError) {
      sendJson(response, error.statusCode, { error: error.message });
      return;
    }
    console.error(error);
    sendJson(response, 500, { error: "De lokale server kon het verzoek niet verwerken." });
  });
});

const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (id !== activeJobId && job.createdAt < cutoff && job.listeners.size === 0) jobs.delete(id);
  }
}, 10 * 60 * 1000);
cleanupTimer.unref();

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(`Kan de lokale webserver niet starten: ${error.message}`);
  process.exitCode = 1;
});

async function runCli(inputPath: string | undefined): Promise<void> {
  if (!inputPath) {
    console.error("Gebruik: npm run cli -- <pad-naar-audio.wav>");
    process.exitCode = 1;
    return;
  }
  const voz = await Voz.load({ ort });
  const result = await voz.transcribe(resolve(inputPath));
  for (const word of result.words) {
    console.log(`${word.start.toFixed(2)} -> ${word.end.toFixed(2)} ${word.text}`);
  }
}

async function buildBrowserBundle(): Promise<string> {
  const result = await build({
    stdin: {
      contents: browserApp,
      resolveDir: process.cwd(),
      sourcefile: "app.js",
      loader: "js",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
  });
  return result.outputFiles[0].text;
}

async function buildPages(): Promise<void> {
  const outputDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "pages");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "index.html"), pageHtml);
  await writeFile(join(outputDirectory, "styles.css"), styles);
  await writeFile(join(outputDirectory, "app.js"), await buildBrowserBundle());

  const litertOutputDirectory = join(outputDirectory, "litert-wasm");
  await mkdir(litertOutputDirectory, { recursive: true });
  const litertFiles = await readdir(litertWasmDirectory);
  for (const fileName of litertFiles) {
    if (/^litert_wasm_(?:compat_|internal\.)/.test(fileName)) {
      await copyFile(join(litertWasmDirectory, fileName), join(litertOutputDirectory, fileName));
    }
  }

  await copyFile(whoWasmPath, join(outputDirectory, "WhoWeb.wasm"));
  await copyFile(vozWasmPath, join(outputDirectory, "VozWeb.wasm"));

  const onnxRuntimeDirectory = dirname(require.resolve("onnxruntime-web/webgpu"));
  const onnxRuntimeFiles = await readdir(onnxRuntimeDirectory);
  for (const fileName of onnxRuntimeFiles) {
    if (/^ort-wasm-.*\.(?:mjs|wasm)$/.test(fileName)) {
      await copyFile(join(onnxRuntimeDirectory, fileName), join(outputDirectory, fileName));
    }
  }

  console.log(`GitHub Pages-bestanden gebouwd in ${outputDirectory}`);
}

async function main(): Promise<void> {
  if (process.argv[2] === "cli") {
    try {
      await runCli(process.argv[3]);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
    return;
  }

  if (process.argv[2] === "pages") {
    await buildPages();
    return;
  }

  appBundle = await buildBrowserBundle();
  server.listen(port, host, () => {
    console.log(`Voz Transcriber staat klaar op http://${host}:${port}`);
  });
}

void main().catch((error: unknown) => {
  console.error("De app kon niet worden gestart:", error);
  process.exitCode = 1;
});
