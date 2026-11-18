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
const pdfWorkerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const onnxRuntimeDirectory = dirname(require.resolve("onnxruntime-web/webgpu"));
const pageHtml = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../index.html"), "utf8");
const organizationLogoPath = resolve(dirname(fileURLToPath(import.meta.url)), "../public/RVB-logo.png");
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
  ".setup-card { margin-bottom: 14px; padding: 16px; border: 1px solid var(--line); border-radius: 11px; background: #fcfdff; }\r",
  ".setup-card-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }\r",
  ".setup-card-heading h2 { font-size: 15px; }\r",
  ".setup-card-heading p { margin: 4px 0 0; color: #8998a8; font-size: 11px; line-height: 1.4; }\r",
  ".setup-action-button { padding: 7px 10px; border: 1px solid #dce7f1; border-radius: 7px; color: #527b9f; background: white; cursor: pointer; font-size: 11px; font-weight: 600; }\r",
  ".speaker-input-list { display: grid; gap: 7px; margin-top: 12px; }\r",
  ".speaker-input-row { display: grid; grid-template-columns: 90px minmax(0, 1fr); align-items: center; gap: 7px; }\r",
  ".speaker-number { color: #61778c; font-size: 11px; }\r",
  ".speaker-input { min-width: 0; padding: 8px 10px; border: 1px solid #dce7f1; border-radius: 7px; color: #354b61; background: white; font: 12px \"Segoe UI\", Arial, sans-serif; }\r",
  ".document-input-row { position: relative; display: flex; align-items: center; gap: 8px; margin-top: 12px; }\r",
  ".document-file-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }\r",
  ".document-pick-button { display: inline-flex; min-height: 36px; align-items: center; padding: 8px 12px; border: 1px solid #dce7f1; border-radius: 7px; color: #527b9f; background: white; cursor: pointer; font-size: 11px; font-weight: 600; }\r",
  ".document-pick-button:hover { border-color: #a9c7e1; }\r",
  ".document-file-input:focus-visible + .document-pick-button { outline: 2px solid #b7cfe4; outline-offset: 2px; }\r",
  ".document-status { min-height: 14px; margin: 7px 0 0; color: #78889a; font-size: 10px; }\r",
  ".result-actions { display: flex; flex-wrap: wrap; gap: 7px; }\r",
  ".context-preview { margin-top: 14px; padding: 12px; border: 1px solid #e3ebf3; border-radius: 8px; color: #52677b; background: white; font-size: 11px; }\r",
  ".context-preview summary { cursor: pointer; font-weight: 600; }\r",
  ".context-preview pre { max-height: 360px; margin: 10px 0 0; overflow: auto; color: #354b61; font: 11px/1.6 Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }\r",
  ".speaker-turn { padding: 12px 14px; border: 1px solid #e3ebf3; border-left: 3px solid #7daed5; border-radius: 9px; background: #fbfdff; }\r",
  ".speaker-turn-0 { border-left-color: #6ea2cf; }\r",
  ".speaker-turn-1 { border-left-color: #73ad9f; }\r",
  ".speaker-turn-2 { border-left-color: #c4a06e; }\r",
  ".speaker-turn-3 { border-left-color: #a48bc7; }\r",
  ".speaker-turn-unknown { border-left-color: #a8b2bc; }\r",
  ".speaker-turn-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 8px; }\r",
  ".turn-time { color: #8797a7; font: 10px Consolas, monospace; white-space: nowrap; }\r",
  ".sentence-row { display: grid; grid-template-columns: 102px minmax(0, 1fr); align-items: baseline; gap: 12px; padding-top: 7px; }\r",
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
  "  .setup-card-heading { align-items: flex-start; }\r",
  "  .setup-action-button { flex: none; }\r",
  "  .result-heading { align-items: flex-start; }\r",
  "  .result-actions { justify-content: flex-end; }\r",
  "}\r",
  String.raw`
  :root {
    font-family: Aptos, Verdana, Calibri, Arial, sans-serif;
    color: #111;
    background: #f3f3f3;
    --blue: #154273;
    --blue-dark: #10365f;
    --blue-soft: #e6e6e6;
    --muted: #535353;
    --line: #cccccc;
  }

  body { background: #f3f3f3; }
  button, input, select, textarea { font-family: Aptos, Verdana, Calibri, Arial, sans-serif; }
  .shell { width: min(100% - 48px, 960px); }
  .topbar {
    padding: 17px 20px;
    border-bottom: 0;
    border-radius: 0 0 18px 0;
    color: white;
    background: #154273;
  }
  .brand { color: white; font-family: Aptos, Verdana, Calibri, Arial, sans-serif; }
  .brand-mark { border-radius: 3px 8px 8px 8px; color: #154273; background: #76d2b6; }
  .brand-light { color: #8fcae7; }
  .local-badge { border-color: rgba(255,255,255,.55); color: white; background: transparent; }
  .live-dot { background: #76d2b6; }
  .intro { padding: 46px 0 28px; }
  .eyebrow { color: #154273; font-family: Aptos, Verdana, Calibri, Arial, sans-serif; font-weight: 700; }
  h1 {
    color: #154273;
    font-family: Aptos, Verdana, Calibri, Arial, sans-serif;
    font-size: clamp(36px, 6vw, 52px);
    letter-spacing: -1.5px;
  }
  h1 span { color: #007bc7; }
  .intro-copy { color: #353535; }
  .workspace {
    padding: 20px;
    border: 1px solid #cccccc;
    border-radius: 3px 12px 12px 12px;
    background: white;
    box-shadow: none;
  }
  .setup-card, .progress-card, .result-card {
    border-color: #cccccc;
    border-radius: 3px 9px 9px 9px;
    background: white;
  }
  .setup-card { border-top: 3px solid #154273; }
  h2, .setup-card-heading h2 { color: #154273; font-family: Aptos, Verdana, Calibri, Arial, sans-serif; }
  .setup-card-heading p, .recording-hint, .capture-option small,
  .progress-detail, .result-meta, .document-status, footer { color: #535353; }
  .setup-action-button, .copy-button, .document-pick-button {
    border-color: #154273;
    border-radius: 3px 7px 7px 7px;
    color: #154273;
    background: white;
  }
  .setup-action-button:hover, .copy-button:hover, .document-pick-button:hover {
    border-color: #007bc7;
    color: #154273;
    background: #e6e6e6;
  }
  .speaker-input, .sentence-edit {
    border-color: #999999;
    border-radius: 3px 6px 6px 6px;
    color: #111;
    background-color: white;
    font-family: Aptos, Verdana, Calibri, Arial, sans-serif;
  }
  .speaker-input:focus, .sentence-edit:focus {
    border-color: #154273;
    outline: 3px solid #8fcae7;
    outline-offset: 1px;
  }
  .speaker-number { color: #154273; font-weight: 700; }
  .recorder { border: 1px solid #cccccc; border-top: 4px solid #154273; border-radius: 3px 12px 12px 12px; background: #f3f3f3; }
  .recorder-icon, .progress-icon { border-radius: 3px 9px 9px 9px; color: #154273; background: #e6e6e6; }
  .recording-status, .recording-time { color: #154273; }
  .capture-option { color: #111; }
  .capture-option input { accent-color: #154273; }
  .recording-visual span { background: #8fcae7; }
  .recording-visual.is-recording span { animation-name: sound-wave-styleguide; }
  @keyframes sound-wave-styleguide { to { height: 20px; background: #76d2b6; } }
  .transcribe-button {
    border-radius: 3px 9px 9px 9px;
    color: white;
    background: #154273;
  }
  .transcribe-button:not(:disabled):hover { background: #10365f; }
  .stop-button, .stop-button:not(:disabled):hover { color: #111; background: #e17000; }
  .privacy-note { color: #535353; }
  .privacy-dot { background: #76d2b6; }
  .progress-icon.complete-icon { color: #154273; background: #76d2b6; }
  .progress-track { background: #e6e6e6; }
  .progress-fill { background: #007bc7; }
  .spinner { border-color: #8fcae7; border-top-color: #154273; }
  .context-preview {
    border-color: #cccccc;
    border-radius: 3px 8px 8px 8px;
    background: white;
  }
  .speaker-label { border-radius: 3px 8px 8px 8px; }
  .speaker-0 { color: #154273; background: #8fcae7; }
  .speaker-1 { color: #111; background: #e17000; }
  .speaker-2 { color: #111; background: #76d2b6; }
  .speaker-3 { color: white; background: #007bc7; }
  .speaker-unknown { color: #353535; background: #e6e6e6; }
  .speaker-turn { border-color: #cccccc; border-radius: 3px 8px 8px 8px; background: white; }
  .speaker-turn-0 { border-left-color: #154273; }
  .speaker-turn-1 { border-left-color: #76d2b6; }
  .speaker-turn-2 { border-left-color: #e17000; }
  .speaker-turn-3 { border-left-color: #007bc7; }
  .speaker-turn-unknown { border-left-color: #999999; }
  .word-time, .turn-time { color: #535353; }
  .word-text, .context-preview pre { color: #111; }
  .error-message { border-color: #e17000; border-radius: 3px 8px 8px 8px; color: #111; background: #fff4e8; }
  footer { border-top: 2px solid #154273; }

  @media (max-width: 560px) {
    .shell { width: min(100% - 30px, 960px); }
    .topbar { padding: 14px; }
    .intro { padding: 36px 0 24px; }
    .workspace { padding: 13px; }
  }

  .shell { display: flex; width: min(100% - 48px, 1440px); min-height: 100vh; flex-direction: column; }
  .page-header { display: flex; align-items: center; gap: 22px; padding: 18px 0; }
  .organization-logo { width: 130px; height: 72px; flex: none; object-fit: contain; }
  .page-titlebar {
    display: flex;
    min-width: 0;
    min-height: 78px;
    flex: 1;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    padding: 13px 22px;
    border-radius: 3px 14px 14px 14px;
    color: white;
    background: #154273;
  }
  .page-kicker { margin: 0 0 4px; color: #8fcae7; font-size: 10px; font-weight: 700; letter-spacing: 1.4px; }
  .page-titlebar h1 { color: white; font-size: clamp(24px, 3vw, 33px); letter-spacing: -.7px; }
  .page-titlebar .local-badge { flex: none; border-color: rgba(255,255,255,.55); color: white; background: transparent; }
  .local-badge svg { width: 15px; height: 15px; }
  .privacy-banner {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    margin-bottom: 17px;
    padding: 15px 20px;
    border: 1px solid #8fcae7;
    border-left: 5px solid #007bc7;
    border-radius: 3px 10px 10px 10px;
    background: #eaf5fb;
  }
  .privacy-icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 3px 8px 8px 8px; color: #154273; background: white; }
  .privacy-icon svg { width: 22px; height: 22px; }
  .privacy-copy h2 { font-size: 16px; }
  .privacy-copy p { margin: 4px 0 0; color: #353535; font-size: 11px; line-height: 1.45; }
  .privacy-facts { display: grid; gap: 5px; margin: 0; padding: 0; color: #154273; font-size: 10px; list-style: none; }
  .privacy-facts li::before { content: "✓"; margin-right: 7px; color: #007b65; font-weight: 700; }
  .workspace { display: flex; min-height: 0; flex: 1 1 auto; flex-direction: column; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .setup-grid { display: grid; min-height: 0; flex: 1 1 auto; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: stretch; gap: 16px; }
  .setup-column { display: grid; min-height: 0; grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .setup-card, .recorder { min-width: 0; margin: 0; padding: 17px 19px; border: 1px solid #cccccc; border-top: 4px solid #154273; border-radius: 3px 11px 11px 11px; background: white; }
  .setup-card h2, .recorder h2 { color: #154273; font-size: 16px; letter-spacing: -.2px; }
  .section-description { margin: 5px 0 0; color: #535353; font-size: 11px; line-height: 1.45; }
  .speaker-input-list { gap: 8px; margin-top: 12px; }
  .speaker-input-row { grid-template-columns: 22px 52px minmax(0, 1fr) 30px; gap: 8px; }
  .role-checkbox { display: grid; place-items: center; }
  .role-checkbox input { width: 16px; height: 16px; margin: 0; accent-color: #154273; }
  .speaker-number { color: #154273; font-size: 10px; font-weight: 700; }
  .speaker-input { width: 100%; min-height: 32px; padding: 6px 8px; font-size: 11px; }
  .remove-speaker-button { display: grid; width: 30px; height: 30px; place-items: center; padding: 0; border: 1px solid transparent; border-radius: 3px 7px 7px 7px; color: #535353; background: transparent; cursor: pointer; font-size: 19px; line-height: 1; }
  .remove-speaker-button:not(:disabled):hover { border-color: #e17000; color: #9c4d00; background: #fff4e8; }
  .remove-speaker-button:focus-visible { outline: 3px solid #8fcae7; outline-offset: 1px; }
  .remove-speaker-button:disabled { cursor: not-allowed; opacity: .48; }
  .role-card > .setup-action-button { margin-top: 12px; }
  .setup-action-button, .copy-button, .document-pick-button { min-height: 34px; border-radius: 3px 8px 8px 8px; }
  .document-card { display: flex; flex-direction: column; }
  .document-dropzone {
    position: relative;
    display: flex;
    min-height: 82px;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    padding: 12px;
    border: 1px dashed #7ca4c5;
    border-radius: 3px 9px 9px 9px;
    background: #f7fbfd;
  }
  .document-dropzone.is-dragging { border-color: #007bc7; background: #eaf5fb; }
  .document-dropzone > svg { width: 27px; height: 27px; flex: none; color: #154273; }
  .dropzone-copy { display: grid; min-width: 0; flex: 1; gap: 4px; color: #154273; font-size: 11px; }
  .dropzone-copy span { color: #535353; font-size: 10px; line-height: 1.35; }
  .document-file-input { z-index: -1; }
  .document-pick-button { flex: none; }
  .document-file-row { display: flex; min-width: 0; align-items: center; gap: 9px; margin-top: 9px; color: #154273; font-size: 10px; }
  .document-file-row strong { overflow: hidden; flex: 1; text-overflow: ellipsis; white-space: nowrap; }
  .document-file-row span { color: #007b65; }
  .remove-document-button { flex: none; padding: 5px 7px; border: 0; color: #535353; background: transparent; cursor: pointer; font-size: 10px; text-decoration: underline; }
  .document-status { min-height: 0; margin: 4px 0 0; font-size: 10px; line-height: 1.4; }
  .recorder { display: flex; min-height: 0; height: 100%; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 17px 19px; background: white; }
  .device-label { margin-top: 14px; color: #154273; font-size: 11px; font-weight: 700; }
  .device-select { width: 100%; min-height: 36px; margin-top: 5px; padding: 7px 9px; border: 1px solid #999; border-radius: 3px 7px 7px 7px; color: #111; background: white; font-size: 12px; }
  .device-select:focus-visible { outline: 3px solid #8fcae7; outline-offset: 1px; }
  .audio-level-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 11px; color: #535353; font-size: 10px; }
  .recording-visual { height: 25px; gap: 4px; margin: 0; }
  .recording-visual span { width: 5px; height: 6px; background: #d6e0e8; transition: height .08s, background .08s; }
  .recording-visual span.is-active { height: 17px; background: #007b65; }
  .capture-option { width: 100%; gap: 9px; margin-top: 10px; padding: 10px; border: 1px solid #d5e0e8; border-radius: 3px 8px 8px 8px; }
  .capture-option strong { color: #154273; font-size: 11px; }
  .capture-option small { color: #535353; font-size: 10px; }
  .ready-checklist { display: grid; gap: 5px; margin-top: 11px; padding: 10px 12px; border-left: 3px solid #007b65; color: #353535; background: #eff8f5; font-size: 10px; }
  .ready-checklist strong { margin-bottom: 1px; color: #154273; font-size: 11px; }
  .recording-status-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 12px; }
  .recording-status { font-size: 12px; }
  .recording-time { margin: 0; font-size: 18px; }
  .recording-hint { text-align: left; }
  .recording-actions { width: 100%; margin-top: 12px; }
  .transcribe-button { min-height: 43px; justify-content: center; gap: 10px; border-radius: 3px 9px 9px 9px; }
  .record-button-dot { width: 9px; height: 9px; border-radius: 50%; background: #e17000; }
  .stop-button, .stop-button:not(:disabled):hover { color: #111; background: #e17000; }
  .privacy-note { align-items: flex-start; margin-top: 11px; color: #535353; font-size: 10px; line-height: 1.4; }
  .privacy-note svg { width: 15px; height: 15px; flex: none; color: #154273; }
  .progress-card, .result-card { margin-top: 16px; border-color: #cccccc; border-top: 4px solid #154273; border-radius: 3px 10px 10px 10px; background: white; }
  .progress-fill { background: #007bc7; }
  .error-message { border-color: #e17000; border-radius: 3px 8px 8px 8px; color: #111; background: #fff4e8; }
  footer { justify-content: center; margin-top: auto; padding: 14px 0 20px; border-top: 2px solid #154273; color: #154273; font-size: 13px; }
  footer strong { margin-left: 4px; color: #007bc7; }

  @media (min-width: 761px) and (max-height: 820px) {
    .page-header { padding: 8px 0; }
    .organization-logo { width: 100px; height: 56px; }
    .page-titlebar { min-height: 58px; padding: 8px 16px; }
    .page-titlebar h1 { font-size: 27px; }
    .privacy-banner { gap: 12px; margin-bottom: 10px; padding: 8px 14px; }
    .privacy-icon { width: 34px; height: 34px; }
    .setup-grid { gap: 12px; }
    .setup-column { gap: 10px; }
    .setup-card, .recorder { padding: 10px 14px; }
    .speaker-input-list { gap: 5px; margin-top: 8px; }
    .speaker-input { min-height: 29px; padding: 4px 7px; }
    .remove-speaker-button { width: 26px; height: 26px; }
    .role-card > .setup-action-button { margin-top: 8px; }
    .document-dropzone { min-height: 64px; gap: 9px; margin-top: 8px; padding: 8px; }
    .device-label { margin-top: 8px; }
    .device-select { min-height: 32px; margin-top: 3px; padding: 5px 8px; }
    .audio-level-row { margin-top: 5px; }
    .capture-option { margin-top: 6px; padding: 7px; }
    .ready-checklist { gap: 3px; margin-top: 7px; padding: 7px 9px; }
    .recording-status-row { margin-top: 8px; }
    .recording-actions { margin-top: 8px; }
    .transcribe-button { min-height: 36px; padding: 9px 14px; }
    .privacy-note { margin-top: 6px; }
    footer { margin-top: auto; padding: 7px 0 10px; }
  }

  @media (min-width: 761px) and (max-height: 680px) {
    .page-header { padding: 4px 0; }
    .organization-logo { width: 76px; height: 42px; }
    .page-titlebar { min-height: 46px; }
    .page-titlebar h1 { font-size: 23px; }
    .page-kicker { margin-bottom: 2px; font-size: 8px; }
    .privacy-banner { grid-template-columns: 28px minmax(0, 1fr) auto; gap: 8px; margin-bottom: 7px; padding: 6px 10px; }
    .privacy-icon { width: 28px; height: 28px; }
    .privacy-icon svg { width: 17px; height: 17px; }
    .privacy-copy h2 { font-size: 13px; }
    .privacy-copy p { margin-top: 2px; font-size: 9px; }
    .privacy-facts { gap: 3px; font-size: 9px; }
    .setup-grid { gap: 9px; }
    .setup-column { gap: 7px; }
    .setup-card, .recorder { padding: 7px 10px; }
    .setup-card h2, .recorder h2 { font-size: 14px; }
    .section-description { margin-top: 3px; font-size: 10px; }
    .speaker-input-list { gap: 3px; margin-top: 5px; }
    .speaker-input-row { gap: 5px; }
    .speaker-input { min-height: 26px; padding: 3px 6px; font-size: 10px; }
    .remove-speaker-button { width: 23px; height: 23px; }
    .role-card > .setup-action-button { min-height: 28px; margin-top: 5px; padding: 4px 8px; }
    .document-dropzone { min-height: 48px; gap: 6px; margin-top: 5px; padding: 5px 7px; }
    .document-dropzone > svg { width: 21px; height: 21px; }
    .dropzone-copy { gap: 2px; font-size: 10px; }
    .dropzone-copy span { font-size: 9px; }
    .document-pick-button { min-height: 28px; padding: 5px 8px; font-size: 10px; }
    .document-status { font-size: 9px; }
    .device-label { margin-top: 5px; font-size: 10px; }
    .device-select { min-height: 28px; margin-top: 2px; padding: 3px 6px; font-size: 10px; }
    .audio-level-row { margin-top: 2px; font-size: 9px; }
    .recording-visual { height: 20px; }
    .capture-option { gap: 6px; margin-top: 3px; padding: 5px 7px; }
    .capture-option strong, .capture-option small { font-size: 9px; }
    .ready-checklist { gap: 2px; margin-top: 4px; padding: 5px 7px; font-size: 9px; }
    .ready-checklist strong { font-size: 10px; }
    .recording-status-row { margin-top: 5px; }
    .recording-status { font-size: 10px; }
    .recording-time { font-size: 15px; }
    .recording-hint { margin-top: 3px; font-size: 9px; }
    .recording-actions { margin-top: 5px; }
    .transcribe-button { min-height: 30px; padding: 6px 10px; font-size: 11px; }
    .privacy-note { gap: 5px; margin-top: 4px; font-size: 9px; }
    .privacy-note svg { width: 12px; height: 12px; }
    footer { margin-top: auto; padding: 5px 0 7px; font-size: 11px; }
  }

  @media (max-width: 900px) {
    .privacy-banner { grid-template-columns: 40px minmax(0, 1fr); }
    .privacy-facts { grid-column: 2; grid-template-columns: repeat(2, max-content); }
  }

  @media (max-width: 760px) {
    .workspace { flex: 0 0 auto; }
    .setup-grid { flex: 0 0 auto; grid-template-columns: minmax(0, 1fr); }
    .setup-column { grid-template-rows: auto auto; }
    .recorder { height: auto; }
  }
  @media (max-width: 600px) {
    .shell { width: min(100% - 28px, 1440px); }
    .page-header { align-items: stretch; gap: 10px; padding: 12px 0; }
    .organization-logo { width: 82px; height: auto; }
    .page-titlebar { min-height: 70px; flex-direction: column; align-items: flex-start; gap: 5px; padding: 10px 12px; }
    .page-kicker { font-size: 8px; }
    .page-titlebar h1 { font-size: 20px; }
    .page-titlebar .local-badge { padding: 0; border: 0; font-size: 9px; }
    .page-titlebar .local-badge svg { width: 12px; height: 12px; }
    .privacy-banner { grid-template-columns: 32px minmax(0, 1fr); gap: 10px; padding: 12px; }
    .privacy-icon { width: 32px; height: 32px; }
    .privacy-copy h2 { font-size: 14px; }
    .privacy-copy p { font-size: 10px; }
    .privacy-facts { grid-template-columns: 1fr; gap: 4px; font-size: 9px; }
    .setup-card, .recorder { padding: 14px; }
    .document-dropzone { flex-wrap: wrap; }
    .dropzone-copy { flex-basis: calc(100% - 45px); }
    .document-pick-button { margin-left: 39px; }
    .document-file-row { flex-wrap: wrap; }
    .sentence-row { grid-template-columns: 80px minmax(0, 1fr); gap: 8px; }
    .result-heading { align-items: flex-start; }
    .result-actions { justify-content: flex-end; }
    footer { flex-wrap: wrap; text-align: center; font-size: 11px; }
  }
  `,
  String.raw`
  /* Opnameknop: hoger zodat hij meer opvalt */
  .recording-actions .transcribe-button { min-height: 60px; padding-top: 16px; padding-bottom: 16px; font-size: 15px; }
  .recording-actions .record-button-dot { width: 12px; height: 12px; }
  @media (min-width: 761px) and (max-height: 820px) {
    .recording-actions .transcribe-button { min-height: 50px; padding-top: 12px; padding-bottom: 12px; font-size: 14px; }
  }
  @media (min-width: 761px) and (max-height: 680px) {
    .recording-actions .transcribe-button { min-height: 42px; padding-top: 9px; padding-bottom: 9px; font-size: 13px; }
  }

  /* Rollenblok neemt de vrije ruimte; documentblok krijgt alleen de hoogte van zijn inhoud.
     Bij veel rollen scrolt de lijst binnen het blok in plaats van de pagina te verlengen. */
  .speaker-input-row { grid-template-columns: 22px 24px minmax(0, 1fr) 30px; }
  @media (min-width: 761px) {
    .setup-column { grid-template-rows: minmax(0, 1fr) auto; }
    .role-card { display: flex; min-height: 190px; flex-direction: column; contain: size; }
    .role-card .speaker-input-list { min-height: 0; flex: 0 1 auto; margin: 8px -5px 0; padding: 4px 5px; overflow-y: auto; }
    .role-card > .setup-action-button { flex: none; align-self: flex-start; }
  }

  /* Rolnamen verplicht */
  .speaker-input.is-invalid { border: 2px solid #d52b1e; background: #fff5f4; }
  .speaker-input.is-invalid:focus { border-color: #d52b1e; outline-color: #f4b7b2; }
  .ready-checklist.has-error { border-left-color: #d52b1e; background: #fdf1f0; }
  .ready-error { color: #a3190e; font-weight: 700; }

  /* Workshopscherm */
  .session-titlebar { gap: 22px; }
  .session-heading { min-width: 0; }
  .session-date { margin: 0 0 3px; color: white; font-size: 12px; }
  .session-titlebar h1 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .session-controls { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 10px 18px; }
  .session-titlebar .local-badge { padding: 0; border: 0; font-size: 12px; font-weight: 700; }
  .session-recording-state { display: inline-flex; align-items: center; gap: 8px; color: white; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .session-recording-dot { width: 13px; height: 13px; border: 2px solid white; border-radius: 50%; background: #e17000; animation: session-pulse 1.6s ease-in-out infinite; }
  .session-recording-state.is-paused .session-recording-dot { animation: none; background: #ffb612; }
  .session-recording-state.is-stopped .session-recording-dot { animation: none; background: #76d2b6; }
  @keyframes session-pulse { 50% { opacity: .45; } }
  .session-button { min-height: 38px; padding: 8px 16px; border: 2px solid white; border-radius: 3px 9px 9px 9px; cursor: pointer; font-size: 13px; font-weight: 700; white-space: nowrap; }
  .session-button:focus-visible { outline: 3px solid #8fcae7; outline-offset: 2px; }
  .session-button:disabled { cursor: not-allowed; opacity: .6; }
  .session-button-outline { color: white; background: transparent; }
  .session-button-outline:not(:disabled):hover { background: rgba(255,255,255,.14); }
  .session-button-solid { color: #154273; background: white; }
  .session-button-solid:not(:disabled):hover { background: #e6e6e6; }

  .session-view { display: flex; min-height: 0; flex: 1 1 auto; flex-direction: column; margin-top: 4px; margin-bottom: 18px; }
  .session-grid { display: grid; min-height: 0; flex: 1 1 auto; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); grid-template-rows: minmax(0, 1fr) auto; gap: 16px 20px; }
  .session-card { min-width: 0; border: 1px solid #cccccc; border-top: 4px solid #154273; border-radius: 3px 11px 11px 11px; background: white; }
  .session-card h2 { color: #154273; font-size: 16px; letter-spacing: -.2px; }

  .checklist-card { grid-column: 1; grid-row: 1; }
  .session-card-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 15px 20px; border-bottom: 1px solid #e0e0e0; }
  .topic-progress { display: flex; align-items: center; gap: 12px; color: #111; font-size: 12px; font-weight: 700; white-space: nowrap; }
  .topic-progress-track { width: 140px; height: 7px; overflow: hidden; border-radius: 99px; background: #e6e6e6; }
  .topic-progress-fill { width: 0; height: 100%; border-radius: inherit; background: #154273; transition: width .25s ease; }
  .topic-list { margin: 0; padding: 0; list-style: none; }
  .topic-item { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: start; gap: 16px; padding: 13px 20px; border-bottom: 1px solid #e0e0e0; }
  .topic-item:last-child { border-bottom: 0; }
  .topic-checkbox { width: 20px; height: 20px; margin: 1px 0 0; accent-color: #154273; cursor: pointer; }
  .topic-checkbox:focus-visible { outline: 3px solid #8fcae7; outline-offset: 2px; }
  .topic-copy { min-width: 0; }
  .topic-title { display: block; color: #154273; cursor: pointer; font-size: 14px; font-weight: 700; }
  .topic-description { margin: 4px 0 0; color: #535353; font-size: 11.5px; line-height: 1.45; }
  .topic-item.is-discussed .topic-title { color: #535353; text-decoration: line-through; }
  .topic-badge { padding: 4px 9px; border-radius: 3px 8px 8px 8px; color: #111; background: #e6e6e6; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .topic-badge.is-discussed { color: #154273; background: #8fcae7; }

  .questions-card { grid-column: 1; grid-row: 2; padding: 15px 20px 16px; border-top-color: #007bc7; }
  .questions-heading-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .generate-questions-button { flex: none; min-height: 38px; padding: 8px 18px; border: 0; border-radius: 3px 9px 9px 9px; color: white; background: #007bc7; cursor: pointer; font-size: 13px; font-weight: 700; }
  .generate-questions-button:not(:disabled):hover { background: #00639f; }
  .generate-questions-button:focus-visible { outline: 3px solid #8fcae7; outline-offset: 2px; }
  .generate-questions-button:disabled { cursor: not-allowed; opacity: .5; }
  .question-list { display: grid; gap: 8px; margin: 12px 0 0; padding: 0; list-style: none; }
  .question-item { display: grid; grid-template-columns: 8px minmax(130px, 190px) minmax(0, 1fr); align-items: baseline; gap: 12px; font-size: 12px; line-height: 1.45; }
  .question-item::before { content: ""; width: 7px; height: 7px; background: #154273; transform: translateY(-1px); }
  .question-item strong { color: #154273; }
  .question-text { color: #111; }
  .question-text.is-empty { color: #757575; font-style: italic; }
  .question-empty { color: #535353; font-size: 12px; }

  .transcript-panel { display: flex; grid-column: 2; grid-row: 1 / span 2; min-height: 0; flex-direction: column; padding: 15px 20px; contain: size; }
  .role-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; padding-bottom: 12px; border-bottom: 1px solid #e0e0e0; }
  .role-chips .speaker-label, .transcript-turn .speaker-label { padding: 4px 9px; font-size: 11px; }
  .transcript-panel-body { min-height: 0; flex: 1 1 auto; margin-right: -12px; padding-right: 12px; overflow-y: auto; }
  .live-placeholder { margin: 12px 0 0; color: #535353; font-size: 12px; line-height: 1.5; }
  .model-status { margin: 10px 0 0; padding: 8px 10px; border-left: 3px solid #8fcae7; color: #353535; background: #f3f3f3; font-size: 11.5px; line-height: 1.45; font-variant-numeric: tabular-nums; }
  .model-status.is-ready { border-left-color: #007b65; background: #eff8f5; }
  .model-status.is-failed { border-left-color: #e17000; background: #fff4e8; }
  .live-placeholder.is-live::after { content: ""; display: inline-block; width: 7px; height: 14px; margin-left: 4px; vertical-align: -2px; background: #353535; animation: caret-blink 1s steps(1) infinite; }
  @keyframes caret-blink { 50% { opacity: 0; } }
  .transcript-panel .progress-card { margin-top: 12px; padding: 12px; border-top-width: 1px; }
  .transcript-panel .result-card { margin-top: 0; padding: 0; border: 0; }
  .transcript-panel .transcript { gap: 0; margin-top: 0; }
  .transcript-turn { padding: 11px 0; border-bottom: 1px solid #e0e0e0; }
  .transcript-turn-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .transcript-turn .word-time { padding: 0; font-family: inherit; font-size: 11px; }
  .transcript-turn .sentence-edit { min-height: 0; margin: 0 0 0 -7px; width: calc(100% + 7px); padding: 3px 6px; border-color: transparent; color: #111; background: transparent; font-size: 13px; line-height: 1.5; resize: none; field-sizing: content; }
  .transcript-turn .sentence-edit:hover { border-color: #cccccc; }
  .transcript-turn .sentence-edit:focus { border-color: #154273; background: white; }
  .transcript-panel .result-meta { margin-top: 10px; }
  .transcript-panel .result-actions { margin-top: 10px; padding-bottom: 4px; }
  .speaker-turn-1 { border-left-color: #e17000; }
  .speaker-turn-2 { border-left-color: #76d2b6; }

  @media (min-width: 761px) and (max-height: 820px) {
    .session-view { margin-bottom: 10px; }
    .session-grid { gap: 12px 16px; }
    .session-card-heading { padding: 10px 16px; }
    .topic-item { padding: 9px 16px; }
    .questions-card { padding: 10px 16px 12px; }
    .question-list { margin-top: 8px; gap: 5px; }
    .transcript-panel { padding: 10px 16px; }
    .session-button, .generate-questions-button { min-height: 34px; padding: 6px 13px; }
  }

  @media (max-width: 1180px) {
    .session-titlebar { flex-wrap: wrap; }
    .session-controls { justify-content: flex-start; }
  }

  @media (max-width: 900px) {
    .session-view { flex: 0 0 auto; }
    .session-grid { flex: 0 0 auto; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; }
    .checklist-card, .questions-card, .transcript-panel { grid-column: 1; grid-row: auto; }
    .transcript-panel { contain: none; }
    .transcript-panel-body { max-height: 70vh; }
  }

  @media (max-width: 600px) {
    .session-controls { width: 100%; gap: 8px 14px; }
    .session-button { flex: 1 1 140px; }
    .session-card-heading { flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 14px; }
    .topic-item { grid-template-columns: 22px minmax(0, 1fr); gap: 8px 12px; padding: 12px 14px; }
    .topic-badge { grid-column: 2; justify-self: start; }
    .questions-card { padding: 12px 14px; }
    .questions-heading-row { flex-direction: column; }
    .generate-questions-button { width: 100%; }
    .question-item { grid-template-columns: 8px minmax(0, 1fr); gap: 2px 10px; }
    .question-item .question-text { grid-column: 2; }
    .transcript-panel { padding: 12px 14px; }
  }
  `,
  String.raw`
  /* Downloadscherm */
  .download-view { display: flex; min-height: 0; flex: 1 1 auto; flex-direction: column; margin-top: 4px; margin-bottom: 18px; }
  .download-banner { display: flex; align-items: center; gap: 14px; margin: 0 0 16px; padding: 10px 16px; border: 2px solid #154273; border-radius: 3px 12px 12px 12px; color: #111; background: white; font-size: 12.5px; line-height: 1.45; }
  .download-banner strong { color: #154273; }
  .download-banner-icon { display: grid; width: 34px; height: 34px; flex: none; place-items: center; border-radius: 3px 7px 7px 7px; color: white; background: #154273; }
  .download-banner-icon svg { width: 19px; height: 19px; }
  .download-grid { display: grid; min-height: 0; flex: 1 1 auto; grid-template-columns: minmax(0, 1.85fr) minmax(300px, 1fr); grid-template-rows: minmax(0, 1fr) auto; gap: 16px 20px; }
  .conversations-card { display: flex; grid-column: 1; grid-row: 1; min-height: 0; flex-direction: column; }
  .conversations-card .session-card-heading { align-items: flex-start; }
  .conversations-card h2:focus { outline: none; }
  .select-all { display: inline-flex; flex: none; align-items: center; gap: 9px; color: #111; cursor: pointer; font-size: 13px; font-weight: 700; }
  .select-all input, .conversation-checkbox, .usecase-checkbox { width: 20px; height: 20px; margin: 0; accent-color: #154273; cursor: pointer; }
  .select-all input:disabled { cursor: not-allowed; }
  .conversations-card .progress-card { margin: 14px 20px; padding: 12px; border-top-width: 1px; }
  .conversations-card .result-card { min-height: 0; flex: 1 1 auto; margin: 0; padding: 0; overflow-y: auto; border: 0; }
  @media (min-width: 901px) {
    .conversations-card { min-height: 260px; contain: size; }
  }
  .conversations-card .result-meta { margin: 0; padding: 10px 20px 14px; }
  .conversation-list { margin: 0; padding: 0; list-style: none; }
  .conversation-item { display: grid; grid-template-columns: 20px 32px minmax(0, 1fr) auto; align-items: start; gap: 16px; padding: 14px 20px; border-bottom: 1px solid #e0e0e0; }
  .conversation-checkbox { margin-top: 6px; }
  .conversation-number { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 3px 8px 8px 8px; color: white; background: #154273; font-size: 13px; font-weight: 700; }
  .conversation-body { min-width: 0; }
  .conversation-heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
  .conversation-title { margin: 0; color: #154273; font-size: 14.5px; }
  .conversation-time { color: #535353; font-size: 11.5px; font-variant-numeric: tabular-nums; }
  .conversation-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
  .conversation-chips .speaker-label { padding: 3px 8px; font-size: 10.5px; }
  .conversation-description { margin: 7px 0 0; color: #111; font-size: 12px; line-height: 1.45; }
  .conversation-transcript { margin-top: 8px; padding: 2px 12px; border-left: 3px solid #8fcae7; background: #f7fbfd; }
  .conversation-transcript .transcript-turn:last-child { border-bottom: 0; }
  .conversation-empty { margin: 8px 0; color: #535353; font-size: 12px; }
  .view-link { padding: 4px 2px; border: 0; color: #154273; background: transparent; cursor: pointer; font-size: 12.5px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
  .view-link:hover { color: #007bc7; }
  .view-link:focus-visible { outline: 3px solid #8fcae7; outline-offset: 2px; }

  .usecase-card { grid-column: 1; grid-row: 2; padding: 14px 20px; }
  .usecase-row { display: grid; grid-template-columns: 20px 26px minmax(0, 1fr) auto; align-items: center; gap: 16px; }
  .usecase-icon { width: 26px; height: 26px; color: #154273; }
  .usecase-copy { min-width: 0; }
  .usecase-copy .section-description { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .usecase-preview { max-height: 260px; margin: 12px 0 0; padding: 10px 12px; overflow: auto; border: 1px solid #cccccc; border-radius: 3px 8px 8px 8px; color: #111; background: #f7f7f7; font: 11px/1.6 Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }

  .download-card { display: flex; grid-column: 2; grid-row: 1 / span 2; min-height: 0; flex-direction: column; padding: 15px 20px 14px; }
  .download-options { display: grid; gap: 9px; margin: 14px 0 0; padding: 0; border: 0; }
  .download-options legend { margin-bottom: 8px; padding: 0; color: #111; font-size: 13px; font-weight: 700; }
  .download-option { display: flex; align-items: flex-start; gap: 12px; padding: 11px 14px; border: 1px solid #999999; border-radius: 3px 9px 9px 9px; background: white; cursor: pointer; }
  .download-option:has(input:checked) { border: 2px solid #154273; padding: 10px 13px; background: #f3f3f3; }
  .download-option:has(input:disabled) { cursor: not-allowed; opacity: .5; }
  .download-option:has(input:focus-visible) { outline: 3px solid #8fcae7; outline-offset: 2px; }
  .download-option input { width: 18px; height: 18px; flex: none; margin: 1px 0 0; accent-color: #154273; }
  .download-option span { display: grid; gap: 3px; }
  .download-option strong { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: #154273; font-size: 14px; }
  .download-option small { color: #111; font-size: 11.5px; line-height: 1.4; }
  .option-tag { padding: 2px 7px; border-radius: 3px 6px 6px 6px; color: #154273; background: #8fcae7; font-size: 10.5px; font-style: normal; }
  .download-summary { display: grid; gap: 4px; margin-top: 14px; padding: 11px 14px; border-radius: 3px 9px 9px 9px; color: #111; background: #f3f3f3; font-size: 12px; overflow-wrap: anywhere; }
  .download-summary strong { color: #154273; }
  .download-button { display: flex; min-height: 48px; justify-content: center; align-items: center; gap: 12px; margin-top: auto; padding: 10px 18px; border: 0; border-radius: 3px 10px 10px 10px; color: white; background: #154273; cursor: pointer; font-size: 16px; font-weight: 700; }
  .download-summary { margin-bottom: 16px; }
  .download-button svg { width: 20px; height: 20px; }
  .download-button:not(:disabled):hover { background: #10365f; }
  .download-button:focus-visible { outline: 3px solid #8fcae7; outline-offset: 2px; }
  .download-button:disabled { cursor: not-allowed; opacity: .55; }
  .download-note { justify-content: center; align-items: center; margin-top: 10px; }
  .delete-workshop-button { display: flex; min-height: 40px; justify-content: center; align-items: center; gap: 9px; margin-top: 12px; padding: 8px 16px; border: 2px solid #d52b1e; border-radius: 3px 10px 10px 10px; color: #a3190e; background: white; cursor: pointer; font-size: 14px; font-weight: 700; }
  .delete-workshop-button svg { width: 18px; height: 18px; }
  .delete-workshop-button:not(:disabled):hover { color: white; background: #d52b1e; }
  .delete-workshop-button:focus-visible { outline: 3px solid #f4b7b2; outline-offset: 2px; }
  .delete-workshop-button:disabled { cursor: not-allowed; opacity: .5; }
  @media (min-width: 761px) and (max-height: 820px) {
    .delete-workshop-button { min-height: 34px; margin-top: 8px; padding: 5px 12px; font-size: 13px; }
    .download-options legend { margin-bottom: 5px; }
    .download-option small { font-size: 11px; }
    .download-summary { margin-bottom: 10px; }
    .download-note { margin-top: 6px; }
  }
  @media (min-width: 761px) and (max-height: 680px) {
    .download-banner { padding: 4px 10px; font-size: 11.5px; }
    .download-banner-icon { width: 24px; height: 24px; }
    .download-card h2 { font-size: 14px; }
    .download-options { margin-top: 6px; gap: 4px; }
    .download-option { padding: 5px 10px; }
    .download-option:has(input:checked) { padding: 4px 9px; }
    .download-option strong { font-size: 13px; }
    .download-summary { margin-top: 6px; padding: 6px 10px; }
    .download-button { min-height: 36px; font-size: 14px; }
    .delete-workshop-button { min-height: 30px; margin-top: 4px; }
    .download-note { margin-top: 3px; }
    .download-options legend { margin-bottom: 3px; font-size: 12px; }
  }

  @media (min-width: 761px) and (max-height: 820px) {
    .download-view { margin-bottom: 10px; }
    .download-banner { margin-bottom: 10px; padding: 6px 12px; }
    .download-banner-icon { width: 28px; height: 28px; }
    .download-grid { gap: 12px 16px; }
    .conversation-item { padding: 10px 16px; }
    .usecase-card, .download-card { padding: 10px 16px; }
    .download-options { margin-top: 8px; gap: 6px; }
    .download-option { padding: 7px 12px; }
    .download-option:has(input:checked) { padding: 6px 11px; }
    .download-summary { margin-top: 10px; padding: 8px 12px; }
    .download-button { min-height: 40px; }
  }

  @media (max-width: 900px) {
    .download-view { flex: 0 0 auto; }
    .download-grid { flex: 0 0 auto; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; }
    .conversations-card, .usecase-card, .download-card { grid-column: 1; grid-row: auto; }
    .download-button { margin-top: 16px; }
  }

  @media (max-width: 600px) {
    .session-heading { max-width: 100%; }
    .session-titlebar h1 { white-space: normal; overflow-wrap: anywhere; }
    .download-banner { align-items: flex-start; font-size: 11.5px; }
    .conversations-card .session-card-heading { flex-direction: column; }
    .conversation-item { grid-template-columns: 20px minmax(0, 1fr); gap: 8px 12px; padding: 12px 14px; }
    .conversation-number { display: none; }
    .conversation-item .view-link { grid-column: 2; justify-self: start; }
    .usecase-card, .download-card { padding: 12px 14px; }
    .usecase-row { grid-template-columns: 20px minmax(0, 1fr) auto; gap: 10px; }
    .usecase-icon { display: none; }
  }

  /* Meer ruimte boven de footer (de footer zelf staat met margin-top: auto onderaan).
     Staat bewust als laatste, zodat het de eerdere marges van de schermen overschrijft. */
  .workspace, .session-view, .download-view, .error-message { margin-bottom: 28px; }
  @media (min-width: 761px) and (max-height: 820px) {
    .workspace, .session-view, .download-view, .error-message { margin-bottom: 20px; }
  }
  @media (min-width: 761px) and (max-height: 680px) {
    .workspace, .session-view, .download-view, .error-message { margin-bottom: 14px; }
  }
  `,
  "",
].join("\n");
const browserApp = [
  "const startButton = document.querySelector(\"#start-recording\");\r",
  "const stopButton = document.querySelector(\"#stop-recording\");\r",
  "const recordingStatus = document.querySelector(\"#recording-status\");\r",
  "const recordingHint = document.querySelector(\"#recording-hint\");\r",
  "const includeSystemAudio = document.querySelector(\"#include-system-audio\");\r",
  "const audioInputDevice = document.querySelector(\"#audio-input-device\");\r",
  "const rolesReady = document.querySelector(\"#roles-ready\");\r",
  "const documentReady = document.querySelector(\"#document-ready\");\r",
  "const microphoneReady = document.querySelector(\"#microphone-ready\");\r",
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
  "const speakerInputList = document.querySelector(\"#speaker-input-list\");\r",
  "const addSpeakerButton = document.querySelector(\"#add-speaker\");\r",
  "const contextDocumentInput = document.querySelector(\"#context-document\");\r",
  "const removeContextDocumentButton = document.querySelector(\"#remove-context-document\");\r",
  "const documentStatus = document.querySelector(\"#document-status\");\r",
  "const contextPreview = document.querySelector(\"#context-preview\");\r",
  "const contextFileName = document.querySelector(\"#context-file-name\");\r",
  "const contextMarkdownPreview = document.querySelector(\"#context-markdown-preview\");\r",
  "const documentDropzone = document.querySelector(\"#document-dropzone\");\r",
  "const documentFileRow = document.querySelector(\"#document-file-row\");\r",
  "const documentFileName = document.querySelector(\"#document-file-name\");\r",
  "const documentFileState = document.querySelector(\"#document-file-state\");\r",
  "\r",
  "let completedText = \"\";\r",
  "let contextMarkdown = \"\";\r",
  "let contextDocumentName = \"\";\r",
  "let isConvertingDocument = false;\r",
  "let documentConversionId = 0;\r",
  "let speakerNames = [];\r",
  "let renderedSentences = [];\r",
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
  "let lastAudioLevelUpdate = 0;\r",
  "\r",
  "function showError(message) {\r",
  "  errorMessage.textContent = message;\r",
  "  errorMessage.hidden = false;\r",
  "}\r",
  "\r",
  "function updateReadiness() {\r",
  "  const selectedRoles = [...speakerInputList.querySelectorAll(\".role-checkbox input:checked\")];\r",
  "  rolesReady.textContent = selectedRoles.length\r",
  "    ? `✓ ${selectedRoles.length} ${selectedRoles.length === 1 ? \"rol\" : \"rollen\"} gekozen`\r",
  "    : \"○ Geen rollen gekozen (standaardlabels worden gebruikt)\";\r",
  "  documentReady.textContent = contextMarkdown\r",
  "    ? \"✓ Document toegevoegd en omgezet naar Markdown\"\r",
  "    : isConvertingDocument ? \"○ Document wordt omgezet naar Markdown...\" : \"○ Document niet toegevoegd (optioneel)\";\r",
  "  microphoneReady.textContent = audioInputDevice.value\r",
  "    ? `✓ ${audioInputDevice.selectedOptions[0].textContent} geselecteerd`\r",
  "    : \"✓ Microfoon wordt gecontroleerd bij start\";\r",
  "  updateRoleNameValidation();\r",
  "}\r",
  "\r",
  "function setAudioLevel(level) {\r",
  "  const bars = [...recordingVisual.querySelectorAll(\"span\")];\r",
  "  const activeBars = Math.max(0, Math.min(bars.length, level));\r",
  "  bars.forEach((bar, index) => bar.classList.toggle(\"is-active\", index < activeBars));\r",
  "  recordingVisual.setAttribute(\"aria-valuenow\", String(activeBars));\r",
  "}\r",
  "\r",
  "async function refreshAudioInputs() {\r",
  "  const selectedDeviceId = audioInputDevice.value;\r",
  "  const devices = await navigator.mediaDevices.enumerateDevices();\r",
  "  const microphones = devices.filter((device) => device.kind === \"audioinput\" && device.deviceId);\r",
  "  audioInputDevice.replaceChildren();\r",
  "  const defaultOption = document.createElement(\"option\");\r",
  "  defaultOption.value = \"\";\r",
  "  defaultOption.textContent = \"Standaardmicrofoon\";\r",
  "  audioInputDevice.append(defaultOption);\r",
  "  microphones.forEach((device, index) => {\r",
  "    const option = document.createElement(\"option\");\r",
  "    option.value = device.deviceId;\r",
  "    option.textContent = device.label || `Microfoon ${index + 1}`;\r",
  "    audioInputDevice.append(option);\r",
  "  });\r",
  "  if (microphones.some((device) => device.deviceId === selectedDeviceId)) audioInputDevice.value = selectedDeviceId;\r",
  "  updateReadiness();\r",
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
  "  startButton.disabled = isBusy || isConvertingDocument;\r",
  "  includeSystemAudio.disabled = isBusy;\r",
  "  audioInputDevice.disabled = isBusy;\r",
  "  contextDocumentInput.disabled = isBusy;\r",
  "  removeContextDocumentButton.disabled = isBusy;\r",
  "  addSpeakerButton.disabled = isBusy;\r",
  "  speakerInputList.querySelectorAll(\"input\").forEach((input) => { input.disabled = isBusy; });\r",
  "  speakerInputList.querySelectorAll(\".remove-speaker-button\").forEach((button) => { button.disabled = isBusy; });\r",
  "  updateReadiness();\r",
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
  "  return renderedSentences.map((sentence) => {\r",
  "    const speakerLabel = speakerLabelFor(sentence.speaker);\r",
  "    const sentenceText = sentence.editedText ?? sentence.words.map((word) => word.text).join(\" \");\r",
  "    return `${speakerLabel}: ${sentenceText}`;\r",
  "  }).join(\"\\n\").trim();\r",
  "}\r",
  "\r",
  "function speakerLabelFor(speaker) {\r",
  "  return speaker === null ? \"Onbekende spreker\" : speakerNames[speaker] || `Spreker ${speaker + 1}`;\r",
  "}\r",
  "\r",
  "function updateContextPreview() {\r",
  "  contextPreview.hidden = !contextMarkdown;\r",
  "  contextFileName.textContent = contextDocumentName;\r",
  "  contextMarkdownPreview.textContent = contextMarkdown;\r",
  "}\r",
  "\r",
  "function documentTitle(fileName) {\r",
  "  return fileName.replace(/\\.[^.]+$/, \"\").replace(/[\\r\\n]+/g, \" \").trim() || \"Document\";\r",
  "}\r",
  "\r",
  "async function convertPdfToMarkdown(file) {\r",
  "  const pdfjs = await import(\"pdfjs-dist/legacy/build/pdf.min.mjs\");\r",
  "  pdfjs.GlobalWorkerOptions.workerSrc = new URL(\"./pdf.worker.mjs\", document.baseURI).href;\r",
  "  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;\r",
  "  try {\r",
  "    if (pdf.numPages > 500) throw new Error(\"De PDF bevat meer dan 500 pagina's; splits het bestand en probeer het opnieuw.\");\r",
  "    const pages = [];\r",
  "    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {\r",
  "      const page = await pdf.getPage(pageNumber);\r",
  "      const content = await page.getTextContent();\r",
  "      const items = content.items\r",
  "        .filter((item) => typeof item.str === \"string\" && item.str.trim())\r",
  "        .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))\r",
  "        .sort((a, b) => b.y - a.y || a.x - b.x);\r",
  "      const lines = [];\r",
  "      for (const item of items) {\r",
  "        const previous = lines[lines.length - 1];\r",
  "        if (previous && Math.abs(previous.y - item.y) <= 2) previous.items.push(item);\r",
  "        else lines.push({ y: item.y, items: [item] });\r",
  "      }\r",
  "      const text = lines.map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(\" \")).join(\"\\n\").trim();\r",
  "      if (text) pages.push(`## Pagina ${pageNumber}\\n\\n${text}`);\r",
  "      page.cleanup();\r",
  "    }\r",
  "    if (!pages.length) throw new Error(\"In deze PDF is geen selecteerbare tekst gevonden. Scans en afbeeldingen kunnen niet automatisch worden uitgelezen.\");\r",
  "    return `# ${documentTitle(file.name)}\\n\\n${pages.join(\"\\n\\n\")}`;\r",
  "  } finally {\r",
  "    await pdf.destroy();\r",
  "  }\r",
  "}\r",
  "\r",
  "async function convertDocxToMarkdown(file) {\r",
  "  const [mammoth, { default: TurndownService }] = await Promise.all([\r",
  "    import(\"mammoth\"),\r",
  "    import(\"turndown\"),\r",
  "  ]);\r",
  "  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });\r",
  "  const turndown = new TurndownService({ headingStyle: \"atx\", codeBlockStyle: \"fenced\" });\r",
  "  turndown.addRule(\"images\", {\r",
  "    filter: \"img\",\r",
  "    replacement: (_content, node) => node.getAttribute(\"alt\") ? `[Afbeelding: ${node.getAttribute(\"alt\")}]` : \"[Afbeelding niet opgenomen]\",\r",
  "  });\r",
  "  turndown.addRule(\"tables\", {\r",
  "    filter: \"table\",\r",
  "    replacement: (_content, node) => {\r",
  "      const rows = [...node.querySelectorAll(\"tr\")].map((row) => [...row.cells]\r",
  "        .map((cell) => cell.textContent.trim().replace(/\\|/g, \"\\\\|\").replace(/\\s+/g, \" \")));\r",
  "      if (!rows.length) return \"\";\r",
  "      const columnCount = Math.max(...rows.map((row) => row.length));\r",
  "      const formatRow = (row) => `| ${Array.from({ length: columnCount }, (_, index) => row[index] ?? \"\").join(\" | \")} |`;\r",
  "      const separator = `| ${Array.from({ length: columnCount }, () => \"---\").join(\" | \")} |`;\r",
  "      return `\\n${formatRow(rows[0])}\\n${separator}${rows.slice(1).map((row) => `\\n${formatRow(row)}`).join(\"\")}\\n`;\r",
  "    },\r",
  "  });\r",
  "  const body = turndown.turndown(result.value).trim();\r",
  "  if (!body) throw new Error(\"Er is geen tekst gevonden in dit Word-document.\");\r",
  "  return {\r",
  "    markdown: `# ${documentTitle(file.name)}\\n\\n${body}`,\r",
  "    hasWarnings: result.messages.some((message) => message.type === \"warning\") || /<img\\b/i.test(result.value),\r",
  "  };\r",
  "}\r",
  "\r",
  "async function convertContextDocument(file) {\r",
  "  const conversionId = ++documentConversionId;\r",
  "  contextMarkdown = \"\";\r",
  "  contextDocumentName = file.name;\r",
  "  documentFileRow.hidden = false;\r",
  "  documentFileName.textContent = file.name;\r",
  "  documentFileState.textContent = \"Omzetten...\";\r",
  "  updateReadiness();\r",
  "  contextMarkdownPreview.textContent = \"\";\r",
  "  contextPreview.hidden = true;\r",
  "  errorMessage.hidden = true;\r",
  "  removeContextDocumentButton.hidden = false;\r",
  "  isConvertingDocument = true;\r",
  "  updateReadiness();\r",
  "  startButton.disabled = true;\r",
  "  documentStatus.textContent = \"Document lokaal naar Markdown omzetten...\";\r",
  "  try {\r",
  "    if (file.size > 20 * 1024 * 1024) throw new Error(\"Het document is groter dan de limiet van 20 MB.\");\r",
  "    const extension = file.name.split(\".\").pop().toLowerCase();\r",
  "    let markdown;\r",
  "    let hasWarnings = false;\r",
  "    if (extension === \"txt\") {\r",
  "      const text = (await file.text()).replace(/\\r\\n?/g, \"\\n\").trim();\r",
  "      if (!text) throw new Error(\"Het tekstbestand is leeg.\");\r",
  "      markdown = `# ${documentTitle(file.name)}\\n\\n${text}`;\r",
  "    } else if (extension === \"docx\") {\r",
  "      ({ markdown, hasWarnings } = await convertDocxToMarkdown(file));\r",
  "    } else if (extension === \"pdf\") {\r",
  "      markdown = await convertPdfToMarkdown(file);\r",
  "    } else {\r",
  "      throw new Error(\"Kies een Word-document (.docx), PDF (.pdf) of tekstbestand (.txt).\");\r",
  "    }\r",
  "    if (conversionId !== documentConversionId) return;\r",
  "    contextMarkdown = markdown;\r",
  "    documentFileState.textContent = \"Klaar\";\r",
  "    updateContextPreview();\r",
  "    documentStatus.textContent = hasWarnings\r",
  "      ? `${file.name} omgezet naar Markdown; sommige documentonderdelen konden niet worden meegenomen.`\r",
  "      : `${file.name} omgezet naar Markdown en klaar om met de transcriptie te bundelen.`;\r",
  "  } catch (error) {\r",
  "    if (conversionId !== documentConversionId) return;\r",
  "    contextDocumentInput.value = \"\";\r",
  "    contextDocumentName = \"\";\r",
  "    documentFileRow.hidden = true;\r",
  "    updateReadiness();\r",
  "    removeContextDocumentButton.hidden = true;\r",
  "    const detail = error instanceof Error ? error.message : String(error);\r",
  "    documentStatus.textContent = `Omzetten mislukt: ${detail}`;\r",
  "    showError(`Het document kon niet worden omgezet: ${detail}`);\r",
  "  } finally {\r",
  "    if (conversionId === documentConversionId) {\r",
  "      isConvertingDocument = false;\r",
  "      startButton.disabled = false;\r",
  "      updateReadiness();\r",
  "    }\r",
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
  "  if (isConvertingDocument) {\r",
  "    showError(\"Wacht tot het document klaar is met omzetten.\");\r",
  "    return;\r",
  "  }\r",
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
  "  audioInputDevice.disabled = true;\r",
  "  contextDocumentInput.disabled = true;\r",
  "  removeContextDocumentButton.disabled = true;\r",
  "  addSpeakerButton.disabled = true;\r",
  "  speakerInputList.querySelectorAll(\"input\").forEach((input) => { input.disabled = true; });\r",
  "  speakerInputList.querySelectorAll(\".remove-speaker-button\").forEach((button) => { button.disabled = true; });\r",
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
  "      audio: {\r",
  "        ...(audioInputDevice.value ? { deviceId: { exact: audioInputDevice.value } } : {}),\r",
  "        channelCount: 1,\r",
  "        echoCancellation: !includeSystemAudio.checked,\r",
  "        noiseSuppression: !includeSystemAudio.checked,\r",
  "      },\r",
  "    });\r",
  "    void refreshAudioInputs().catch((error) => showError(`Microfoons konden niet worden bijgewerkt: ${error instanceof Error ? error.message : String(error)}`));\r",
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
  "      if (isPaused) {\r",
  "        event.outputBuffer.getChannelData(0).fill(0);\r",
  "        return;\r",
  "      }\r",
  "      const inputSamples = event.inputBuffer.getChannelData(0);\r",
  "      const outputSamples = new Float32Array(inputSamples.length);\r",
  "      for (let channel = 0; channel < event.inputBuffer.numberOfChannels; channel++) {\r",
  "        const channelSamples = event.inputBuffer.getChannelData(channel);\r",
  "        for (let i = 0; i < channelSamples.length; i++) {\r",
  "          outputSamples[i] += channelSamples[i] / event.inputBuffer.numberOfChannels;\r",
  "        }\r",
  "      }\r",
  "      appendSamples(outputSamples, audioContext.sampleRate);\r",
  "      const now = Date.now();\r",
  "      if (now - lastAudioLevelUpdate >= 100) {\r",
  "        let energy = 0;\r",
  "        for (const sample of outputSamples) energy += sample * sample;\r",
  "        setAudioLevel(Math.floor(Math.sqrt(energy / outputSamples.length) * 80));\r",
  "        lastAudioLevelUpdate = now;\r",
  "      }\r",
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
  "      recordingTime.textContent = formatTime(recordingElapsedSeconds());\r",
  "      updateSessionClock();\r",
  "    }, 250);\r",
  "    enterSessionView();\r",
  "  } catch (error) {\r",
  "    await stopTracks();\r",
  "    startButton.disabled = false;\r",
  "    includeSystemAudio.disabled = false;\r",
  "    audioInputDevice.disabled = false;\r",
  "    contextDocumentInput.disabled = false;\r",
  "    removeContextDocumentButton.disabled = false;\r",
  "    addSpeakerButton.disabled = false;\r",
  "    speakerInputList.querySelectorAll(\"input\").forEach((input) => { input.disabled = false; });\r",
  "    speakerInputList.querySelectorAll(\".remove-speaker-button\").forEach((button) => { button.disabled = false; });\r",
  "    setAudioLevel(0);\r",
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
  "  onSessionRecordingStopped();\r",
  "  stopButton.disabled = true;\r",
  "  stopButton.querySelector(\"span\").textContent = \"Opname afronden...\";\r",
  "  recordingVisual.classList.remove(\"is-recording\");\r",
  "  setAudioLevel(0);\r",
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
  "    recordingTime.textContent = formatTime(recordingElapsedSeconds());\r",
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
  "    onSessionProcessingDone();\r",
  "  }\r",
  "}\r",
  "\r",
  "startButton.addEventListener(\"click\", () => {\r",
  "  if (!updateRoleNameValidation()) {\r",
  "    focusFirstMissingRoleName();\r",
  "    return;\r",
  "  }\r",
  "  speakerNames =[...speakerInputList.querySelectorAll(\".speaker-input-row\")]\r",
  "    .filter((row) => row.querySelector(\".role-checkbox input\").checked)\r",
  "    .map((row, index) => row.querySelector(\".speaker-input\").value.trim() || `Spreker ${index + 1}`);\r",
  "  void startRecording();\r",
  "});\r",
  "stopButton.addEventListener(\"click\", () => { void stopRecording(); });\r",
  "function addSpeakerInput(number, roleName = \"\") {\r",
  "  const row = document.createElement(\"div\");\r",
  "  row.className = \"speaker-input-row\";\r",
  "  const checkboxLabel = document.createElement(\"label\");\r",
  "  checkboxLabel.className = \"role-checkbox\";\r",
  "  checkboxLabel.htmlFor = `role-enabled-${number}`;\r",
  "  const checkbox = document.createElement(\"input\");\r",
  "  checkbox.id = `role-enabled-${number}`;\r",
  "  checkbox.type = \"checkbox\";\r",
  "  checkbox.checked = true;\r",
  "  checkbox.setAttribute(\"aria-label\", `Rol ${number} meenemen`);\r",
  "  checkboxLabel.append(checkbox);\r",
  "  const label = document.createElement(\"span\");\r",
  "  label.className = \"speaker-number\";\r",
  "  label.textContent = `${number}.`;\r",
  "  const input = document.createElement(\"input\");\r",
  "  input.className = \"speaker-input\";\r",
  "  input.type = \"text\";\r",
  "  input.maxLength = 100;\r",
  "  input.placeholder = `Naam van rol ${number}`;\r",
  "  input.value = roleName;\r",
  "  input.setAttribute(\"aria-label\", `Naam van rol ${number}`);\r",
  "  input.id = `speaker-name-${number}`;\r",
  "  const removeButton = document.createElement(\"button\");\r",
  "  removeButton.className = \"remove-speaker-button\";\r",
  "  removeButton.type = \"button\";\r",
  "  removeButton.textContent = \"×\";\r",
  "  removeButton.setAttribute(\"aria-label\", `Rol ${number} verwijderen`);\r",
  "  removeButton.title = `Rol ${number} verwijderen`;\r",
  "  removeButton.addEventListener(\"click\", () => {\r",
  "    row.remove();\r",
  "    renumberSpeakerInputs();\r",
  "    updateReadiness();\r",
  "  });\r",
  "  row.append(checkboxLabel, label, input, removeButton);\r",
  "  speakerInputList.append(row);\r",
  "  updateReadiness();\r",
  "}\r",
  "\r",
  "function renumberSpeakerInputs() {\r",
  "  speakerInputList.querySelectorAll(\".speaker-input-row\").forEach((row, index) => {\r",
  "    const number = index + 1;\r",
  "    const checkboxLabel = row.querySelector(\".role-checkbox\");\r",
  "    const checkbox = checkboxLabel.querySelector(\"input\");\r",
  "    const numberLabel = row.querySelector(\".speaker-number\");\r",
  "    const input = row.querySelector(\".speaker-input\");\r",
  "    const removeButton = row.querySelector(\".remove-speaker-button\");\r",
  "    checkbox.id = `role-enabled-${number}`;\r",
  "    checkboxLabel.htmlFor = checkbox.id;\r",
  "    checkbox.setAttribute(\"aria-label\", `Rol ${number} meenemen`);\r",
  "    numberLabel.textContent = `${number}.`;\r",
  "    input.id = `speaker-name-${number}`;\r",
  "    input.placeholder = `Naam van rol ${number}`;\r",
  "    input.setAttribute(\"aria-label\", `Naam van rol ${number}`);\r",
  "    removeButton.setAttribute(\"aria-label\", `Rol ${number} verwijderen`);\r",
  "    removeButton.title = `Rol ${number} verwijderen`;\r",
  "  });\r",
  "}\r",
  "addSpeakerInput(1, \"Privacy officer\");\r",
  "addSpeakerInput(2, \"Burger\");\r",
  "addSpeakerInput(3, \"Use case houder\");\r",
  "addSpeakerInput(4, \"Innovation scout\");\r",
  "addSpeakerButton.addEventListener(\"click\", () => {\r",
  "  addSpeakerInput(speakerInputList.querySelectorAll(\".speaker-input-row\").length + 1);\r",
  "});\r",
  "speakerInputList.addEventListener(\"change\", updateReadiness);\r",
  "speakerInputList.addEventListener(\"input\", updateReadiness);\r",
  "audioInputDevice.addEventListener(\"change\", updateReadiness);\r",
  "void refreshAudioInputs().catch((error) => showError(`Microfoons konden niet worden geladen: ${error instanceof Error ? error.message : String(error)}`));\r",
  "navigator.mediaDevices?.addEventListener(\"devicechange\", () => {\r",
  "  void refreshAudioInputs().catch((error) => showError(`Microfoons konden niet worden bijgewerkt: ${error instanceof Error ? error.message : String(error)}`));\r",
  "});\r",
  "contextDocumentInput.addEventListener(\"change\", () => {\r",
  "  const file = contextDocumentInput.files[0];\r",
  "  if (file) void convertContextDocument(file);\r",
  "});\r",
  "for (const eventName of [\"dragenter\", \"dragover\"]) {\r",
  "  documentDropzone.addEventListener(eventName, (event) => {\r",
  "    event.preventDefault();\r",
  "    if (!contextDocumentInput.disabled) documentDropzone.classList.add(\"is-dragging\");\r",
  "  });\r",
  "}\r",
  "for (const eventName of [\"dragleave\", \"drop\"]) {\r",
  "  documentDropzone.addEventListener(eventName, (event) => {\r",
  "    event.preventDefault();\r",
  "    documentDropzone.classList.remove(\"is-dragging\");\r",
  "  });\r",
  "}\r",
  "documentDropzone.addEventListener(\"drop\", (event) => {\r",
  "  if (contextDocumentInput.disabled) {\r",
  "    showError(\"Een document kan niet worden gewijzigd tijdens een opname of transcriptie.\");\r",
  "    return;\r",
  "  }\r",
  "  const file = event.dataTransfer?.files[0];\r",
  "  if (!file) return;\r",
  "  void convertContextDocument(file);\r",
  "});\r",
  "removeContextDocumentButton.addEventListener(\"click\", () => {\r",
  "  documentConversionId++;\r",
  "  contextDocumentInput.value = \"\";\r",
  "  contextMarkdown = \"\";\r",
  "  contextDocumentName = \"\";\r",
  "  documentFileRow.hidden = true;\r",
  "  documentFileName.textContent = \"\";\r",
  "  documentFileState.textContent = \"\";\r",
  "  isConvertingDocument = false;\r",
  "  startButton.disabled = false;\r",
  "  removeContextDocumentButton.hidden = true;\r",
  "  documentStatus.textContent = \"\";\r",
  "  updateReadiness();\r",
  "  updateContextPreview();\r",
  "});\r",
  // Workshopscherm (na "Workshop opnemen"). Geen template literals in dit blok: het staat in String.raw.
  String.raw`
const setupTitlebar = document.querySelector("#setup-titlebar");
const sessionTitlebar = document.querySelector("#session-titlebar");
const privacyBanner = document.querySelector("#privacy-banner");
const setupView = document.querySelector("#setup-view");
const sessionView = document.querySelector("#session-view");
const sessionDate = document.querySelector("#session-date");
const sessionTitle = document.querySelector("#session-title");
const sessionRecordingState = document.querySelector("#session-recording-state");
const sessionRecordingLabel = document.querySelector("#session-recording-label");
const pauseButton = document.querySelector("#pause-recording");
const finishButton = document.querySelector("#finish-session");
const backToSetupButton = document.querySelector("#back-to-setup");
const topicList = document.querySelector("#topic-list");
const topicProgressText = document.querySelector("#topic-progress-text");
const topicProgressTrack = document.querySelector("#topic-progress-track");
const topicProgressFill = document.querySelector("#topic-progress-fill");
const generateQuestionsButton = document.querySelector("#generate-questions");
const questionList = document.querySelector("#question-list");
const sessionRoleChips = document.querySelector("#session-role-chips");
const livePlaceholder = document.querySelector("#live-placeholder");

const sessionTopics = [
  {
    title: "Persoonsgegevens",
    description: "Welke persoonsgegevens worden verwerkt en zijn er bijzondere persoonsgegevens bij?",
    question: "Welke categorieën persoonsgegevens worden verwerkt, en zitten daar bijzondere persoonsgegevens tussen?",
  },
  {
    title: "Gegevensverwerking",
    description: "Hoe worden gegevens verzameld, opgeslagen, gedeeld en bewaard?",
    question: "Hoe lang worden de gegevens bewaard en wat gebeurt ermee na afloop van die termijn?",
  },
  {
    title: "Verwerkingsdoeleinden",
    description: "Waarvoor worden de gegevens gebruikt en op welke grondslag?",
    question: "Voor welk concreet doel worden de gegevens verwerkt, en op welke wettelijke grondslag rust dat?",
  },
  {
    title: "Betrokken partijen",
    description: "Wie is verwerkingsverantwoordelijke, wie is verwerker en wie ontvangt gegevens?",
    question: "Welke externe partijen krijgen toegang tot de gegevens, en is er met hen een verwerkersovereenkomst?",
  },
  {
    title: "Verwerkingslocaties",
    description: "Waar worden gegevens opgeslagen en verwerkt, binnen of buiten de EU?",
    question: "Worden gegevens buiten de EU opgeslagen of verwerkt, bijvoorbeeld door een cloudleverancier?",
  },
];

let sessionStarted = false;
let sessionFinished = false;
let topicDiscussedAt = sessionTopics.map(() => null);
let questionsGenerated = false;
let isPaused = false;
let pauseStartedAt = 0;
let pausedTotal = 0;
let recordingEndedAt = 0;

function recordingElapsedSeconds() {
  if (!recordingStartedAt) return 0;
  const end = recordingEndedAt || (isPaused ? pauseStartedAt : Date.now());
  return Math.max(0, (end - recordingStartedAt - pausedTotal) / 1000);
}

function formatClock(seconds) {
  const total = Math.floor(seconds);
  const pad = (value) => String(value).padStart(2, "0");
  return pad(Math.floor(total / 3600)) + ":" + pad(Math.floor((total % 3600) / 60)) + ":" + pad(total % 60);
}

function updateSessionClock() {
  const time = formatClock(recordingElapsedSeconds());
  let label;
  if (isRecording) label = (isPaused ? "Opname gepauzeerd · " : "Opname loopt · ") + time;
  else if (sessionFinished) label = "Opname afgerond · " + time;
  else label = "Opname afronden · " + time;
  sessionRecordingLabel.textContent = label;
  sessionRecordingState.classList.toggle("is-paused", isRecording && isPaused);
  sessionRecordingState.classList.toggle("is-stopped", !isRecording);
}

function renderRoleChips() {
  sessionRoleChips.replaceChildren();
  speakerNames.forEach((name, index) => {
    const chip = document.createElement("span");
    chip.className = "speaker-label speaker-" + (index % 4);
    chip.textContent = name;
    sessionRoleChips.append(chip);
  });
  sessionRoleChips.hidden = speakerNames.length === 0;
}

function renderTopics() {
  topicList.replaceChildren();
  sessionTopics.forEach((topic, index) => {
    const discussedAt = topicDiscussedAt[index];
    const isDiscussed = discussedAt !== null;
    const item = document.createElement("li");
    item.className = isDiscussed ? "topic-item is-discussed" : "topic-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "topic-checkbox";
    checkbox.id = "topic-" + index;
    checkbox.checked = isDiscussed;
    const descriptionId = "topic-description-" + index;
    checkbox.setAttribute("aria-describedby", descriptionId);
    checkbox.addEventListener("change", () => {
      topicDiscussedAt[index] = checkbox.checked ? recordingElapsedSeconds() : null;
      renderTopics();
      document.getElementById("topic-" + index)?.focus();
    });
    const copy = document.createElement("div");
    copy.className = "topic-copy";
    const title = document.createElement("label");
    title.className = "topic-title";
    title.htmlFor = checkbox.id;
    title.textContent = topic.title;
    const description = document.createElement("p");
    description.className = "topic-description";
    description.id = descriptionId;
    description.textContent = topic.description;
    copy.append(title, description);
    const badge = document.createElement("span");
    badge.className = isDiscussed ? "topic-badge is-discussed" : "topic-badge";
    badge.textContent = isDiscussed ? "✓ Besproken · " + formatTime(discussedAt) : "Nog te bespreken";
    item.append(checkbox, copy, badge);
    topicList.append(item);
  });
  const discussedCount = topicDiscussedAt.filter((value) => value !== null).length;
  topicProgressText.textContent = discussedCount + " van " + sessionTopics.length + " besproken";
  topicProgressTrack.setAttribute("aria-valuemax", String(sessionTopics.length));
  topicProgressTrack.setAttribute("aria-valuenow", String(discussedCount));
  topicProgressFill.style.width = (discussedCount / sessionTopics.length) * 100 + "%";
  renderQuestions();
}

function renderQuestions() {
  questionList.replaceChildren();
  const openTopics = sessionTopics.filter((_topic, index) => topicDiscussedAt[index] === null);
  generateQuestionsButton.disabled = openTopics.length === 0;
  if (!openTopics.length) {
    const done = document.createElement("li");
    done.className = "question-empty";
    done.textContent = "Alle onderwerpen zijn besproken.";
    questionList.append(done);
    return;
  }
  openTopics.forEach((topic) => {
    const item = document.createElement("li");
    item.className = "question-item";
    const title = document.createElement("strong");
    title.textContent = topic.title;
    const question = document.createElement("span");
    question.className = questionsGenerated ? "question-text" : "question-text is-empty";
    question.textContent = questionsGenerated ? topic.question : "Nog geen vraag gegenereerd";
    item.append(title, question);
    questionList.append(item);
  });
}

// --- Downloadscherm (na "Gesprek afronden") ---
const downloadView = document.querySelector("#download-view");
const conversationsSummary = document.querySelector("#conversations-summary");
const conversationsHeading = document.querySelector("#conversations-heading");
const selectAllConversations = document.querySelector("#select-all-conversations");
const includeUsecase = document.querySelector("#include-usecase");
const toggleUsecasePreview = document.querySelector("#toggle-usecase-preview");
const usecasePreview = document.querySelector("#usecase-preview");
const downloadSelection = document.querySelector("#download-selection");
const downloadSummaryFiles = document.querySelector("#download-summary-files");
const downloadFilesButton = document.querySelector("#download-files");
const downloadButtonLabel = document.querySelector("#download-button-label");
const separateOption = document.querySelector('input[name="download-split"][value="separate"]');

const modelStatus = document.querySelector("#model-status");

// --- Rollen moeten een naam hebben ---
// Let op: wordt al aangeroepen voordat dit blok is uitgevoerd (bij het aanmaken van de standaardrollen),
// dus hier geen const's van bovenaan dit blok gebruiken.
function missingRoleNameInputs() {
  return [...speakerInputList.querySelectorAll(".speaker-input")].filter((input) => !input.value.trim());
}

// Geeft true terug als alle rollen een naam hebben.
function updateRoleNameValidation() {
  const roleNamesReady = document.querySelector("#role-names-ready");
  const readyChecklist = document.querySelector(".ready-checklist");
  const inputs =[...speakerInputList.querySelectorAll(".speaker-input")];
  const missing = missingRoleNameInputs();
  inputs.forEach((input) => {
    const isMissing = missing.includes(input);
    input.classList.toggle("is-invalid", isMissing);
    if (isMissing) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "role-names-ready");
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  });
  const numbers = missing.map((input) => String(inputs.indexOf(input) + 1));
  // Een workshop heeft minstens twee deelnemers nodig, dus minstens twee aangevinkte rollen.
  const MIN_ROLES = 2;
  const rolesReady = document.querySelector("#roles-ready");
  const checkedCount =speakerInputList.querySelectorAll(".role-checkbox input:checked").length;
  const noRoles = checkedCount < MIN_ROLES;
  rolesReady.classList.toggle("ready-error", noRoles);
  if (noRoles) {
    const need = "Een workshop heeft minstens " + MIN_ROLES + " rollen nodig: ";
    if (!inputs.length) rolesReady.textContent = "✗ Geen rollen toegevoegd. " + need + "voeg rollen toe.";
    else if (inputs.length < MIN_ROLES) rolesReady.textContent = "✗ Maar " + inputs.length + " rol toegevoegd. " + need + "voeg nog een rol toe.";
    else if (checkedCount === 0) rolesReady.textContent = "✗ Geen rollen aangevinkt. " + need + "vink minstens " + MIN_ROLES + " rollen aan.";
    else rolesReady.textContent = "✗ Maar " + checkedCount + " rol aangevinkt. " + need + "vink nog een rol aan of voeg er een toe.";
  }
  roleNamesReady.hidden = missing.length === 0;
  const isValid = missing.length === 0 && !noRoles;
  readyChecklist.classList.toggle("has-error", !isValid);
  if (missing.length) {
    roleNamesReady.textContent = "✗ " + (missing.length === 1
      ? "Rol " + numbers[0] + " heeft nog geen naam."
      : "Rol " + joinTitles(numbers) + " hebben nog geen naam.") + " Vul een naam in of verwijder de rol.";
  }
  if (!isValid) {
    startButton.disabled = true;
    startButton.dataset.blockedByRoles = "true";
  } else if (startButton.dataset.blockedByRoles) {
    delete startButton.dataset.blockedByRoles;
    startButton.disabled = isConvertingDocument;
  }
  return isValid;
}

function focusFirstMissingRoleName() {
  const firstMissing = missingRoleNameInputs()[0];
  if (firstMissing) firstMissing.focus();
  else (speakerInputList.querySelector(".role-checkbox input:not(:checked)") ?? addSpeakerButton).focus();
}

// Nieuwe rol: direct in het naamveld zetten (en in beeld scrollen als de lijst scrolt).
addSpeakerButton.addEventListener("click", () => {
  const inputs = speakerInputList.querySelectorAll(".speaker-input");
  inputs[inputs.length - 1]?.focus();
});

// --- Modellen en transcriptie draaien in een web worker (transcriber-worker.js) ---
// Zo blijft de pagina bruikbaar tijdens het rekenen, en kan een lopende transcriptie worden afgebroken.
let transcriberWorker = null;
let activeModelWait = null;
let modelsPreloaded = false;
let transcriptionJobId = 0;
let pendingJob = null;
const TRANSCRIPTION_CANCELLED = new Error("Transcriptie afgebroken");

function litertWasmDir() {
  return new URL("./litert-wasm/", document.baseURI).href;
}

function showModelProgress(name, progress) {
  if (modelsPreloaded) return;
  modelStatus.textContent = progress < 1
    ? name + " wordt alvast gedownload: " + Math.round(progress * 100) + "%"
    : name + " wordt klaargezet...";
}

function setModelsReady() {
  modelsPreloaded = true;
  modelStatus.classList.remove("is-failed");
  modelStatus.classList.add("is-ready");
  modelStatus.textContent = "✓ Spraakmodellen staan klaar. De transcriptie start direct na het afronden.";
}

function handleWorkerMessage(event) {
  const message = event.data;
  if (message.type === "model-progress") {
    const isVoz = message.model === "voz";
    showModelProgress(isVoz ? "Spraakmodel" : "Sprekermodel", message.progress);
    if (pendingJob && activeModelWait === message.model) {
      setProgress({
        stage: isVoz ? "loading_model" : "loading_speakers",
        progress: message.progress,
        message: isVoz
          ? (message.progress < 1 ? "Voz-model downloaden..." : "Voz-model initialiseren...")
          : (message.progress < 1 ? "Sprekermodel downloaden..." : "Sprekermodel initialiseren..."),
      });
    }
    return;
  }
  if (message.type === "preloaded") {
    setModelsReady();
    return;
  }
  if (message.type === "preload-error") {
    if (modelsPreloaded) return;
    modelStatus.classList.add("is-failed");
    modelStatus.textContent = "De spraakmodellen konden niet vooraf worden geladen. Dit wordt opnieuw geprobeerd na het afronden.";
    return;
  }
  if (!pendingJob || message.id !== pendingJob.id) return;
  if (message.type === "stage") {
    activeModelWait = message.stage === "loading_model" ? "voz" : message.stage === "loading_speakers" ? "who" : null;
    const messages = {
      loading_model: "Voz-model klaarmaken...",
      transcribing: "Audio wordt lokaal getranscribeerd...",
      loading_speakers: "Who-model klaarmaken...",
      diarizing: "Sprekers in de opname herkennen...",
    };
    setProgress({ stage: message.stage, progress: message.stage === "transcribing" ? 0 : undefined, message: messages[message.stage] });
  } else if (message.type === "transcribe-progress") {
    setProgress({ stage: "transcribing", progress: message.progress, message: "Audio wordt lokaal getranscribeerd..." });
  } else if (message.type === "result") {
    const job = pendingJob;
    pendingJob = null;
    activeModelWait = null;
    setModelsReady();
    job.resolve(message);
  } else if (message.type === "error") {
    const job = pendingJob;
    pendingJob = null;
    activeModelWait = null;
    job.reject(new Error(message.message));
  }
}

function getTranscriberWorker() {
  if (!transcriberWorker) {
    transcriberWorker = new Worker(new URL("./transcriber-worker.js", document.baseURI), { type: "module" });
    transcriberWorker.addEventListener("message", handleWorkerMessage);
    transcriberWorker.addEventListener("error", (event) => {
      event.preventDefault();
      const detail = event.message || "De achtergrondverwerking is gestopt.";
      resetTranscriberWorker();
      if (pendingJob) {
        const job = pendingJob;
        pendingJob = null;
        job.reject(new Error(detail));
      }
    });
  }
  return transcriberWorker;
}

function resetTranscriberWorker() {
  if (transcriberWorker) transcriberWorker.terminate();
  transcriberWorker = null;
  modelsPreloaded = false;
  activeModelWait = null;
}

// Modellen alvast laden tijdens de opname (in de worker, dus zonder de opname te storen).
function preloadModels() {
  modelStatus.hidden = false;
  modelStatus.classList.remove("is-ready", "is-failed");
  if (modelsPreloaded && transcriberWorker) {
    setModelsReady();
    return;
  }
  modelsPreloaded = false;
  modelStatus.textContent = "Spraakmodellen worden alvast geladen...";
  getTranscriberWorker().postMessage({ type: "preload", litertWasmDir: litertWasmDir() });
}

function runTranscriptionJob(audio) {
  return new Promise((resolve, reject) => {
    const id = ++transcriptionJobId;
    pendingJob = { id, resolve, reject };
    getTranscriberWorker().postMessage({ type: "transcribe", id, audio, litertWasmDir: litertWasmDir() });
  });
}

// Breekt een lopende transcriptie echt af door de worker te stoppen.
// De modellen worden bij een volgende workshop opnieuw geladen (uit de browsercache).
function cancelTranscription() {
  if (!pendingJob) return false;
  const job = pendingJob;
  pendingJob = null;
  resetTranscriberWorker();
  job.reject(TRANSCRIPTION_CANCELLED);
  return true;
}

async function submitRecording(audio) {
  setBusy(true);
  errorMessage.hidden = true;
  resultCard.hidden = true;
  progressCard.hidden = false;
  startButton.disabled = true;
  progressIcon.innerHTML = '<span class="spinner"></span>';
  progressIcon.classList.remove("complete-icon");
  setProgress({ stage: "loading_model", message: "Voz-model klaarmaken..." });
  try {
    const message = await runTranscriptionJob(audio);
    const result = message.result;
    if (message.diarizeError) {
      showError("Transcriptie is klaar, maar sprekerherkenning is mislukt: " + message.diarizeError);
      setProgress({ stage: "complete", progress: 1, message: "Transcriptie klaar; sprekerherkenning is mislukt." });
    } else {
      setProgress({ stage: "complete", progress: 1, message: result.speakerCount + " " + (result.speakerCount === 1 ? "spreker" : "sprekers") + " herkend." });
    }
    renderResult(result);
  } catch (error) {
    if (error !== TRANSCRIPTION_CANCELLED) {
      const detail = error instanceof Error ? error.message : String(error);
      setProgress({ stage: "error", message: "Lokale transcriptie is niet gelukt." });
      showError("Transcriptie is niet gelukt: " + detail);
    }
  } finally {
    setBusy(false);
    onSessionProcessingDone();
  }
}

let conversations = [];
let selectedConversations = new Set();
let transcriptReady = false;
let isDownloading = false;
let workshopDate = new Date();
let workshopTitle = "Workshop";

function formatDuration(seconds) {
  if (seconds < 60) return Math.max(0, Math.round(seconds)) + " sec";
  return Math.round(seconds / 60) + " min";
}

function joinTitles(titles) {
  if (titles.length <= 1) return titles[0] ?? "";
  return titles.slice(0, -1).join(", ") + " en " + titles[titles.length - 1];
}

function sentenceText(sentence) {
  return sentence.editedText ?? sentence.words.map((word) => word.text).join(" ");
}

function speakerChip(speaker) {
  const chip = document.createElement("span");
  chip.className = speaker === null ? "speaker-label speaker-unknown" : "speaker-label speaker-" + (speaker % 4);
  chip.textContent = speakerLabelFor(speaker);
  return chip;
}

function speakersIn(sentences) {
  return [...new Set(sentences.map((sentence) => sentence.speaker))];
}

// Elk afgevinkt onderwerp sluit een gesprek af: van het vorige vinkje tot dit vinkje.
// Onderwerpen die binnen 2 seconden na elkaar zijn afgevinkt, worden samengevoegd.
function buildConversations() {
  const totalSeconds = recordingElapsedSeconds();
  const checked = sessionTopics
    .map((topic, index) => ({ topic, at: topicDiscussedAt[index] }))
    .filter((entry) => entry.at !== null)
    .sort((a, b) => a.at - b.at);
  const groups = [];
  for (const entry of checked) {
    const last = groups[groups.length - 1];
    if (last && entry.at - last.end < 2) {
      last.topics.push(entry.topic);
      last.end = entry.at;
    } else {
      groups.push({ topics: [entry.topic], start: last ? last.end : 0, end: entry.at });
    }
  }
  const result = groups.map((group) => ({
    title: joinTitles(group.topics.map((topic) => topic.title)),
    description: group.topics.map((topic) => topic.description).join(" "),
    start: group.start,
    end: group.end,
    sentences: [],
  }));
  const lastEnd = groups.length ? groups[groups.length - 1].end : 0;
  const rest = {
    title: groups.length ? "Overige onderwerpen" : "Volledige workshop",
    description: groups.length
      ? "Wat er na het laatst afgevinkte onderwerp is besproken."
      : "Er zijn geen onderwerpen afgevinkt; dit is het hele gesprek.",
    start: lastEnd,
    end: Math.max(totalSeconds, lastEnd),
    sentences: [],
  };
  for (const sentence of renderedSentences) {
    const time = sentence.words[0].start;
    const target = result.find((conversation) => time >= conversation.start && time < conversation.end) ?? rest;
    target.sentences.push(sentence);
  }
  if (rest.sentences.length || !result.length) result.push(rest);
  return result;
}

function renderSentencesInto(container, sentences) {
  container.replaceChildren();
  if (!sentences.length) {
    const empty = document.createElement("p");
    empty.className = "conversation-empty";
    empty.textContent = "In dit deel is geen tekst herkend.";
    container.append(empty);
    return;
  }
  let currentTurn;
  let currentSpeaker;
  sentences.forEach((sentence) => {
    if (!currentTurn || sentence.speaker !== currentSpeaker) {
      currentSpeaker = sentence.speaker;
      currentTurn = document.createElement("div");
      currentTurn.className = "transcript-turn";
      const heading = document.createElement("div");
      heading.className = "transcript-turn-heading";
      const time = document.createElement("span");
      time.className = "word-time";
      time.textContent = formatTime(sentence.words[0].start);
      heading.append(speakerChip(sentence.speaker), time);
      currentTurn.append(heading);
      container.append(currentTurn);
    }
    const sentenceEdit = document.createElement("textarea");
    sentenceEdit.className = "sentence-edit";
    sentenceEdit.rows = 1;
    sentenceEdit.maxLength = 5000;
    sentenceEdit.setAttribute("aria-label", "Zin " + (renderedSentences.indexOf(sentence) + 1) + " van " + speakerLabelFor(sentence.speaker) + " bewerken");
    sentenceEdit.value = sentenceText(sentence);
    sentenceEdit.addEventListener("input", () => {
      sentence.editedText = sentenceEdit.value;
      completedText = transcriptText();
    });
    currentTurn.append(sentenceEdit);
  });
}

function renderConversations() {
  transcript.replaceChildren();
  conversations.forEach((conversation, index) => {
    const item = document.createElement("li");
    item.className = "conversation-item";
    const titleId = "conversation-title-" + index;
    const panelId = "conversation-panel-" + index;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "conversation-checkbox";
    checkbox.checked = selectedConversations.has(index);
    checkbox.setAttribute("aria-labelledby", titleId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedConversations.add(index);
      else selectedConversations.delete(index);
      updateDownloadPanel();
    });

    const number = document.createElement("span");
    number.className = "conversation-number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(index + 1);

    const body = document.createElement("div");
    body.className = "conversation-body";
    const headingRow = document.createElement("div");
    headingRow.className = "conversation-heading";
    const title = document.createElement("h3");
    title.className = "conversation-title";
    title.id = titleId;
    title.textContent = conversation.title;
    const time = document.createElement("span");
    time.className = "conversation-time";
    time.textContent = formatTime(conversation.start) + " – " + formatTime(conversation.end) + " · " + formatDuration(conversation.end - conversation.start);
    headingRow.append(title, time);
    const chips = document.createElement("div");
    chips.className = "conversation-chips";
    speakersIn(conversation.sentences).forEach((speaker) => chips.append(speakerChip(speaker)));
    const description = document.createElement("p");
    description.className = "conversation-description";
    description.textContent = conversation.description;
    const panel = document.createElement("div");
    panel.className = "conversation-transcript";
    panel.id = panelId;
    panel.hidden = true;
    renderSentencesInto(panel, conversation.sentences);
    body.append(headingRow);
    if (chips.childElementCount) body.append(chips);
    body.append(description, panel);

    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.className = "view-link";
    viewButton.textContent = "Bekijk";
    viewButton.setAttribute("aria-expanded", "false");
    viewButton.setAttribute("aria-controls", panelId);
    viewButton.setAttribute("aria-describedby", titleId);
    viewButton.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      viewButton.textContent = panel.hidden ? "Bekijk" : "Verberg";
      viewButton.setAttribute("aria-expanded", String(!panel.hidden));
    });

    item.append(checkbox, number, body, viewButton);
    transcript.append(item);
  });
  conversationsSummary.textContent = conversations.length + (conversations.length === 1 ? " gesprek" : " gesprekken")
    + " · totaal " + formatClock(recordingElapsedSeconds()) + " · selecteer welke u wilt meenemen";
  updateDownloadPanel();
}

function renderResult(result) {
  if (discardedWhileProcessing) return;
  renderedSentences =makeSentences(result.words);
  completedText = transcriptText();
  conversations = buildConversations();
  selectedConversations = new Set(conversations.map((_conversation, index) => index));
  renderConversations();
  resultMeta.textContent = result.speakerCount + " " + (result.speakerCount === 1 ? "spreker" : "sprekers") + " herkend · "
    + result.words.length + " woorden · " + result.duration.toFixed(1) + " seconden audio · verwerkt in " + result.processingTime.toFixed(1) + " seconden";
  resultCard.hidden = false;
}

function selectedConversationList() {
  return conversations.filter((_conversation, index) => selectedConversations.has(index));
}

function usecaseSelected() {
  return Boolean(contextMarkdown) && includeUsecase.checked;
}

function downloadFormat() {
  return document.querySelector('input[name="download-format"]:checked').value;
}

function downloadSplit() {
  return document.querySelector('input[name="download-split"]:checked').value;
}

function fileBaseName() {
  const date = workshopDate.getFullYear() + "-" + String(workshopDate.getMonth() + 1).padStart(2, "0") + "-" + String(workshopDate.getDate()).padStart(2, "0");
  return (workshopTitle + " " + date).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-");
}

function plannedFiles() {
  const extension = downloadFormat() === "pdf" ? ".pdf" : ".md";
  const hasConversations = selectedConversationList().length > 0;
  const hasUsecase = usecaseSelected();
  const baseName = fileBaseName();
  if (!hasConversations && !hasUsecase) return [];
  if (hasConversations && hasUsecase && downloadSplit() === "separate") {
    return [
      { name: baseName + "-gesprekken" + extension, conversations: true, usecase: false },
      { name: baseName + "-use-case" + extension, conversations: false, usecase: true },
    ];
  }
  return [{ name: baseName + extension, conversations: hasConversations, usecase: hasUsecase }];
}

function updateDownloadPanel() {
  const count = selectedConversationList().length;
  const hasUsecase = usecaseSelected();
  const parts = [];
  if (count) parts.push(count + (count === 1 ? " gesprek" : " gesprekken"));
  if (hasUsecase) parts.push("1 use case-document");
  downloadSelection.textContent = "Geselecteerd: " + (parts.length ? parts.join(" en ") : "niets");
  selectAllConversations.disabled = conversations.length === 0;
  selectAllConversations.checked = conversations.length > 0 && count === conversations.length;
  selectAllConversations.indeterminate = count > 0 && count < conversations.length;
  separateOption.disabled = !(count && hasUsecase);
  const files = plannedFiles();
  downloadSummaryFiles.textContent = files.length
    ? files.map((file) => file.name).join(", ") + " · " + files.length + (files.length === 1 ? " bestand" : " bestanden")
    : "Selecteer minstens één onderdeel.";
  downloadFilesButton.disabled = !transcriptReady || isDownloading || files.length === 0;
  if (!isDownloading) downloadButtonLabel.textContent = transcriptReady ? "Downloaden" : "Transcriptie wordt gemaakt...";
}

function headerBlocks(subtitle) {
  const details = ["Datum: " + workshopDate.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" })];
  details.push("Duur opname: " + formatClock(recordingElapsedSeconds()));
  if (speakerNames.length) details.push("Rollen: " + speakerNames.join(", "));
  return [{ type: "h1", text: workshopTitle + subtitle }, { type: "meta", text: details.join(" · ") }];
}

function conversationBlocks(list) {
  const blocks = [{ type: "h2", text: "Gesprekken" }];
  list.forEach((conversation, index) => {
    blocks.push({ type: "h3", text: (index + 1) + ". " + conversation.title });
    const speakers = speakersIn(conversation.sentences).map(speakerLabelFor);
    blocks.push({
      type: "meta",
      text: formatTime(conversation.start) + " – " + formatTime(conversation.end) + " · " + formatDuration(conversation.end - conversation.start)
        + (speakers.length ? " · Sprekers: " + speakers.join(", ") : ""),
    });
    blocks.push({ type: "p", text: "Onderwerp: " + conversation.description });
    if (!conversation.sentences.length) {
      blocks.push({ type: "p", text: "In dit deel is geen tekst herkend." });
      return;
    }
    let turn;
    for (const sentence of conversation.sentences) {
      if (turn && turn.speakerIndex === sentence.speaker) {
        turn.text += " " + sentenceText(sentence);
      } else {
        turn = { type: "turn", speakerIndex: sentence.speaker, speaker: speakerLabelFor(sentence.speaker), time: formatTime(sentence.words[0].start), text: sentenceText(sentence) };
        blocks.push(turn);
      }
    }
  });
  return blocks;
}

function usecaseBlocks() {
  return [{ type: "h2", text: "Use case: " + documentTitle(contextDocumentName) }, { type: "markdown", text: contextMarkdown }];
}

function blocksToMarkdown(blocks) {
  return blocks.map((block) => {
    if (block.type === "h1") return "# " + block.text;
    if (block.type === "h2") return "## " + block.text;
    if (block.type === "h3") return "### " + block.text;
    if (block.type === "turn") return "**" + block.speaker + "** (" + block.time + "): " + block.text;
    if (block.type === "markdown") return block.text.replace(/^(#{1,4}) /gm, "##$1 ");
    return block.text;
  }).join("\n\n").trim() + "\n";
}

// De standaardlettertypen van jsPDF kennen alleen Latin-1; vervang de rest.
function pdfSafe(text) {
  return String(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•✓]/g, "-")
    .replace(/[^\u0000-ÿ]/g, "?");
}

async function blocksToPdf(blocks) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const width = pageWidth - margin * 2;
  const blue = [21, 66, 115];
  let y = margin;
  const write = (text, options = {}) => {
    const size = options.size ?? 10.5;
    const lineHeight = size * 1.4;
    const indent = options.indent ?? 0;
    pdf.setFont("helvetica", options.style ?? "normal");
    pdf.setFontSize(size);
    const color = options.color ?? [17, 17, 17];
    pdf.setTextColor(color[0], color[1], color[2]);
    y += options.before ?? 0;
    for (const line of pdf.splitTextToSize(pdfSafe(text), width - indent)) {
      if (y + lineHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin + indent, y + size);
      y += lineHeight;
    }
    y += options.after ?? 4;
  };
  for (const block of blocks) {
    if (block.type === "h1") write(block.text, { size: 20, style: "bold", color: blue, after: 6 });
    else if (block.type === "h2") write(block.text, { size: 15, style: "bold", color: blue, before: 14, after: 6 });
    else if (block.type === "h3") write(block.text, { size: 12.5, style: "bold", color: blue, before: 10, after: 2 });
    else if (block.type === "meta") write(block.text, { size: 9.5, color: [83, 83, 83], after: 6 });
    else if (block.type === "turn") {
      write(block.speaker + "   " + block.time, { size: 9.5, style: "bold", color: blue, before: 4, after: 1 });
      write(block.text, { after: 4 });
    } else if (block.type === "markdown") {
      for (const rawLine of block.text.split("\n")) {
        const line = rawLine.replace(/\*\*|__|\x60/g, "").trimEnd();
        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (!line.trim()) y += 4;
        else if (heading) write(heading[2], { size: heading[1].length <= 1 ? 13 : 11.5, style: "bold", color: blue, before: 8, after: 2 });
        else if (/^\s*[-*+]\s+/.test(line)) write("- " + line.replace(/^\s*[-*+]\s+/, ""), { indent: 10, after: 2 });
        else if (/^\s*\|/.test(line)) {
          if (!/^\s*\|[\s|:-]+\|\s*$/.test(line)) write(line.replace(/^\s*\|\s*|\s*\|\s*$/g, "").replace(/\s*\|\s*/g, "  |  "), { size: 9, after: 2 });
        } else write(line, { after: 3 });
      }
    } else write(block.text, { after: 5 });
  }
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(83, 83, 83);
    pdf.text(pdfSafe(workshopTitle + " · lokaal gemaakt"), margin, pageHeight - 28);
    pdf.text("Pagina " + page + " van " + pageCount, pageWidth - margin, pageHeight - 28, { align: "right" });
  }
  return pdf.output("blob");
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadFiles() {
  const files = plannedFiles();
  if (!files.length) return;
  isDownloading = true;
  downloadButtonLabel.textContent = "Bestanden maken...";
  updateDownloadPanel();
  try {
    for (const [index, file] of files.entries()) {
      const subtitle = file.conversations ? (file.usecase ? "" : " – gesprekken") : " – use case";
      const blocks = headerBlocks(subtitle);
      if (file.conversations) blocks.push(...conversationBlocks(selectedConversationList()));
      if (file.usecase) blocks.push(...usecaseBlocks());
      const blob = downloadFormat() === "pdf"
        ? await blocksToPdf(blocks)
        : new Blob([blocksToMarkdown(blocks)], { type: "text/markdown;charset=utf-8" });
      saveBlob(blob, file.name);
      if (index < files.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
  } catch (error) {
    showError("Downloaden is niet gelukt: " + (error instanceof Error ? error.message : String(error)));
  } finally {
    isDownloading = false;
    updateDownloadPanel();
  }
}

function enterSessionView() {
  sessionStarted = true;
  sessionFinished = false;
  transcriptReady = false;
  isPaused = false;
  pausedTotal = 0;
  recordingEndedAt = 0;
  topicDiscussedAt = sessionTopics.map(() => null);
  questionsGenerated = false;
  conversations = [];
  selectedConversations = new Set();
  workshopDate = new Date();
  workshopTitle = contextDocumentName ? documentTitle(contextDocumentName) : "Workshop";
  sessionDate.textContent = workshopDate.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
  sessionTitle.textContent = workshopTitle;
  renderRoleChips();
  renderTopics();
  sessionRecordingState.hidden = false;
  pauseButton.hidden = false;
  pauseButton.disabled = false;
  pauseButton.textContent = "Pauzeer opname";
  pauseButton.setAttribute("aria-pressed", "false");
  finishButton.hidden = false;
  finishButton.disabled = false;
  backToSetupButton.hidden = true;
  livePlaceholder.classList.add("is-live");
  livePlaceholder.textContent = "Opname loopt. De transcriptie wordt gemaakt zodra u het gesprek afrondt.";
  updateSessionClock();
  preloadModels();
  setupTitlebar.hidden = true;
  privacyBanner.hidden = true;
  setupView.hidden = true;
  downloadView.hidden = true;
  sessionTitlebar.hidden = false;
  sessionView.hidden = false;
  document.title = "Workshop · Voz Transcriber";
  window.scrollTo(0, 0);
  pauseButton.focus();
}

function showDownloadView() {
  sessionTitle.textContent = "Workshop afgerond: downloaden";
  sessionRecordingState.hidden = true;
  pauseButton.hidden = true;
  finishButton.hidden = true;
  backToSetupButton.hidden = false;
  backToSetupButton.disabled = true;
  document.querySelector("#delete-workshop").disabled = false;
  conversationsSummary.textContent = "De transcriptie wordt lokaal gemaakt...";
  transcript.replaceChildren();
  includeUsecase.checked = true;
  usecasePreview.hidden = true;
  toggleUsecasePreview.textContent = "Bekijk";
  toggleUsecasePreview.setAttribute("aria-expanded", "false");
  updateDownloadPanel();
  sessionView.hidden = true;
  downloadView.hidden = false;
  document.title = "Workshop downloaden · Voz Transcriber";
  window.scrollTo(0, 0);
  conversationsHeading.tabIndex = -1;
  conversationsHeading.focus();
}

function showSetupView() {
  sessionView.hidden = true;
  downloadView.hidden = true;
  sessionTitlebar.hidden = true;
  setupTitlebar.hidden = false;
  privacyBanner.hidden = false;
  setupView.hidden = false;
  errorMessage.hidden = true;
  recordingTime.textContent = "00:00";
  document.title = "Workshop voorbereiden · Voz Transcriber";
  window.scrollTo(0, 0);
  startButton.focus();
}

function togglePause() {
  if (!isRecording) return;
  if (isPaused) {
    pausedTotal += Date.now() - pauseStartedAt;
    isPaused = false;
  } else {
    pauseStartedAt = Date.now();
    isPaused = true;
  }
  pauseButton.textContent = isPaused ? "Hervat opname" : "Pauzeer opname";
  pauseButton.setAttribute("aria-pressed", String(isPaused));
  livePlaceholder.classList.toggle("is-live", !isPaused);
  livePlaceholder.textContent = isPaused
    ? "Opname gepauzeerd. Er wordt nu niets opgenomen."
    : "Opname loopt. De transcriptie wordt gemaakt zodra u het gesprek afrondt.";
  setAudioLevel(0);
  updateSessionClock();
}

function onSessionRecordingStopped() {
  if (isPaused) {
    pausedTotal += Date.now() - pauseStartedAt;
    isPaused = false;
  }
  recordingEndedAt = Date.now();
  updateSessionClock();
  showDownloadView();
}

function onSessionProcessingDone() {
  if (discardedWhileProcessing) {
    // Workshop is tijdens de verwerking verwijderd: uitkomst en eventuele foutmelding weggooien.
    discardedWhileProcessing = false;
    discardWorkshop();
    errorMessage.hidden = true;
    return;
  }
  if (!sessionStarted) return;
  sessionFinished = true;
  transcriptReady = true;
  backToSetupButton.disabled = false;
  document.querySelector("#delete-workshop").disabled = false;
  if (!resultCard.hidden) progressCard.hidden = true;
  if (resultCard.hidden) {
    conversations = [];
    selectedConversations = new Set();
    conversationsSummary.textContent = contextMarkdown
      ? "Er is geen transcriptie beschikbaar. U kunt alleen het use case-document downloaden."
      : "Er is geen transcriptie beschikbaar.";
  }
  updateDownloadPanel();
}

pauseButton.addEventListener("click", togglePause);
finishButton.addEventListener("click", () => { void stopRecording(); });
backToSetupButton.addEventListener("click", showSetupView);
generateQuestionsButton.addEventListener("click", () => {
  questionsGenerated = true;
  renderQuestions();
});
selectAllConversations.addEventListener("change", () => {
  selectedConversations = selectAllConversations.checked
    ? new Set(conversations.map((_conversation, index) => index))
    : new Set();
  transcript.querySelectorAll(".conversation-checkbox").forEach((checkbox) => {
    checkbox.checked = selectAllConversations.checked;
  });
  updateDownloadPanel();
});
includeUsecase.addEventListener("change", updateDownloadPanel);
document.querySelectorAll('input[name="download-format"], input[name="download-split"]').forEach((radio) => {
  radio.addEventListener("change", updateDownloadPanel);
});
toggleUsecasePreview.addEventListener("click", () => {
  usecasePreview.hidden = !usecasePreview.hidden;
  toggleUsecasePreview.textContent = usecasePreview.hidden ? "Bekijk" : "Verberg";
  toggleUsecasePreview.setAttribute("aria-expanded", String(!usecasePreview.hidden));
});
downloadFilesButton.addEventListener("click", () => { void downloadFiles(); });

// --- Workshop verwijderen: alles uit het geheugen wissen en terug naar de start ---
const deleteWorkshopButton = document.querySelector("#delete-workshop");

function discardWorkshop() {
  renderedSentences = [];
  completedText = "";
  conversations = [];
  selectedConversations = new Set();
  topicDiscussedAt = sessionTopics.map(() => null);
  questionsGenerated = false;
  sessionStarted = false;
  sessionFinished = false;
  transcriptReady = false;
  transcript.replaceChildren();
  resultMeta.textContent = "";
  resultCard.hidden = true;
  progressCard.hidden = true;
}

// Verwijderen tijdens de verwerking: de worker wordt gestopt, zodat de transcriptie echt afbreekt.
// onSessionProcessingDone ruimt daarna de rest op.
let discardedWhileProcessing = false;

deleteWorkshopButton.addEventListener("click", () => {
  const confirmed = window.confirm("Weet u zeker dat u deze workshop wilt verwijderen?\n\nDe opname, transcriptie en checklist worden gewist en kunnen niet worden teruggehaald.");
  if (!confirmed) return;
  const stillProcessing = !transcriptReady;
  discardWorkshop();
  discardedWhileProcessing = stillProcessing;
  if (stillProcessing) cancelTranscription();
  window.alert("Workshop verwijderd en niet opgeslagen.");
  showSetupView();
});
`,
  "",
].join("\n");
// Web worker voor transcriptie en sprekerherkenning. Dit draait buiten de hoofdthread,
// zodat de pagina bruikbaar blijft (knoppen, voortgang) en de verwerking kan worden afgebroken.
// Staat in String.raw: geen backticks of dollar-accolade gebruiken.
const transcriberWorker = String.raw`
// De LiteRT-loader van Who laadt zijn WASM-lijmcode met importScripts(). Dat bestaat niet in
// module-workers, dus hier een vervanging: het script synchroon ophalen en in de globale scope uitvoeren.
self.importScripts = (...urls) => {
  for (const url of urls) {
    const request = new XMLHttpRequest();
    request.open("GET", url, false);
    request.send();
    if (request.status < 200 || request.status >= 300) throw new Error("Kon " + url + " niet laden (" + request.status + ")");
    (0, eval)(request.responseText + "\n//# sourceURL=" + url);
  }
};

let vozPromise;
let whoPromise;

function post(type, data) {
  self.postMessage(Object.assign({ type }, data));
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function ensureVoz() {
  if (!vozPromise) {
    let lastProgress = -1;
    vozPromise = Promise.all([
      import("@desert-ant-labs/voz"),
      import("onnxruntime-web/wasm"),
    ]).then(([{ Voz }, ort]) => Voz.load({
      ort,
      ep: "wasm",
      webnn: false,
      onProgress: (progress) => {
        const percent = Math.round(progress * 100);
        if (percent === lastProgress) return;
        lastProgress = percent;
        post("model-progress", { model: "voz", progress });
      },
    }));
    vozPromise.catch(() => { vozPromise = undefined; });
  }
  return vozPromise;
}

function ensureWho(litertWasmDir) {
  if (!whoPromise) {
    let lastProgress = -1;
    whoPromise = import("@desert-ant-labs/who").then(({ Who }) => Who.load({
      accelerator: "wasm",
      litertWasmDir,
      onProgress: (progress) => {
        const percent = Math.round(progress * 100);
        if (percent === lastProgress) return;
        lastProgress = percent;
        post("model-progress", { model: "who", progress });
      },
    }));
    whoPromise.catch(() => { whoPromise = undefined; });
  }
  return whoPromise;
}

async function wavToSamples(blob) {
  const view = new DataView(await blob.arrayBuffer());
  const dataBytes = Math.min(view.getUint32(40, true), view.byteLength - 44);
  const samples = new Float32Array(Math.floor(dataBytes / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(44 + i * 2, true) / 32768;
  return samples;
}

function plainResult(result, words, speakerCount) {
  return { words, speakerCount, duration: result.duration, processingTime: result.processingTime };
}

async function transcribe(id, audio, litertWasmDir) {
  try {
    post("stage", { id, stage: "loading_model" });
    const voz = await ensureVoz();
    post("stage", { id, stage: "transcribing" });
    const result = await voz.transcribe(audio, {
      onProgress: (progress) => post("transcribe-progress", { id, progress }),
    });
    const baseWords = result.words.map((word) => ({ text: word.text, start: word.start, end: word.end }));
    try {
      post("stage", { id, stage: "loading_speakers" });
      const who = await ensureWho(litertWasmDir);
      post("stage", { id, stage: "diarizing" });
      // In een worker bestaat geen (Offline)AudioContext om audio te decoderen. Onze opname is een
      // 16 kHz mono 16-bit WAV (zie encodeWav), dus de samples kunnen we hier zelf uitlezen.
      const diarization = await who.diarize(await wavToSamples(audio), { sampleRate: 16000 });
      const words = baseWords.map((word) => {
        const overlaps = new Map();
        for (const turn of diarization.turns) {
          const overlap = Math.max(0, Math.min(word.end, turn.end) - Math.max(word.start, turn.start));
          if (overlap > 0) overlaps.set(turn.speaker, (overlaps.get(turn.speaker) ?? 0) + overlap);
        }
        let speaker = null;
        let longestOverlap = 0;
        for (const [candidate, overlap] of overlaps) {
          if (overlap > longestOverlap) {
            speaker = candidate;
            longestOverlap = overlap;
          }
        }
        return Object.assign({}, word, { speaker });
      });
      post("result", { id, result: plainResult(result, words, diarization.speakerCount) });
    } catch (error) {
      const words = baseWords.map((word) => Object.assign({}, word, { speaker: null }));
      post("result", { id, result: plainResult(result, words, 0), diarizeError: errorText(error) });
    }
  } catch (error) {
    post("error", { id, message: errorText(error) });
  }
}

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "preload") {
    ensureVoz()
      .then(() => ensureWho(message.litertWasmDir))
      .then(() => post("preloaded", {}))
      .catch((error) => post("preload-error", { message: errorText(error) }));
  } else if (message.type === "transcribe") {
    void transcribe(message.id, message.audio, message.litertWasmDir);
  }
});
`;

const jobs = new Map<string, Job>();
let activeJobId: string | undefined;
let vozPromise: Promise<Voz> | undefined;
let appBundle = "";
let workerBundle = "";

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

  if (request.method === "GET" && url.pathname === "/transcriber-worker.js") {
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(workerBundle);
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

  if (request.method === "GET" && url.pathname === "/RVB-logo.png") {
    const logo = await readFile(organizationLogoPath);
    response.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(logo);
    return;
  }

  if (request.method === "GET" && url.pathname === "/pdf.worker.mjs") {
    const worker = await readFile(pdfWorkerPath);
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(worker);
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

  if (request.method === "GET" && url.pathname.endsWith("/VozWeb.wasm")) {
    const wasm = await readFile(vozWasmPath);
    response.writeHead(200, {
      "Content-Type": "application/wasm",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(wasm);
    return;
  }

  const onnxRuntimeFileMatch = request.method === "GET"
    && url.pathname.match(/^\/(ort-wasm-[a-z0-9.-]+\.(?:mjs|wasm))$/i);
  if (onnxRuntimeFileMatch) {
    const fileName = onnxRuntimeFileMatch[1];
    let content: Buffer;
    try {
      content = await readFile(join(onnxRuntimeDirectory, fileName));
    } catch {
      sendJson(response, 404, { error: "Bestand niet gevonden." });
      return;
    }
    response.writeHead(200, {
      "Content-Type": fileName.endsWith(".wasm") ? "application/wasm" : "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
    return;
  }

  const litertFileMatch = request.method === "GET"
    // Ook vanaf de hoofdmap: in de transcriptie-worker zoekt de LiteRT-lijmcode zijn .wasm naast de worker.
    && url.pathname.match(/^\/(?:litert-wasm\/)?(litert_wasm_(?:compat_|threaded_|jspi_)?internal\.(?:js|wasm))$/);
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

async function buildBrowserBundle(contents: string = browserApp, sourcefile = "app.js"): Promise<string> {
  const result = await build({
    ...browserBundleOptions,
    stdin: {
      contents,
      resolveDir: process.cwd(),
      sourcefile,
      loader: "js",
    },
  });
  return result.outputFiles[0].text;
}

const browserBundleOptions = {
  bundle: true,
  format: "esm" as const,
  external: ["canvg", "dompurify", "html2canvas"],
  platform: "browser" as const,
  target: "es2022",
  write: false as const,
};

// De worker is een module-worker (Who gebruikt top-level await). importScripts() wordt in de
// worker zelf opgevangen; zie het begin van transcriberWorker.
async function buildWorkerBundle(): Promise<string> {
  const result = await build({
    ...browserBundleOptions,
    stdin: {
      contents: transcriberWorker,
      resolveDir: process.cwd(),
      sourcefile: "transcriber-worker.js",
      loader: "js",
    },
  });
  return result.outputFiles[0].text;
}

async function buildPages(): Promise<void> {
  const outputDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "pages");
  await mkdir(outputDirectory, { recursive: true });
  const assetVersion = process.env.GITHUB_SHA ?? String(Date.now());
  const versionedPageHtml = pageHtml
    .replace("./app.js", `./app.js?v=${assetVersion}`)
    .replace("./styles.css", `./styles.css?v=${assetVersion}`)
    .replace("./RVB-logo.png", `./RVB-logo.png?v=${assetVersion}`);
  await writeFile(join(outputDirectory, "index.html"), versionedPageHtml);
  await writeFile(join(outputDirectory, "styles.css"), styles);
  await writeFile(join(outputDirectory, "app.js"), await buildBrowserBundle());
  await writeFile(join(outputDirectory, "transcriber-worker.js"), await buildWorkerBundle());
  await copyFile(organizationLogoPath, join(outputDirectory, "RVB-logo.png"));

  const litertOutputDirectory = join(outputDirectory, "litert-wasm");
  await mkdir(litertOutputDirectory, { recursive: true });
  const litertFiles = await readdir(litertWasmDirectory);
  for (const fileName of litertFiles) {
    if (/^litert_wasm_(?:compat_|internal\.)/.test(fileName)) {
      await copyFile(join(litertWasmDirectory, fileName), join(litertOutputDirectory, fileName));
      // De worker zoekt de .wasm-bestanden naast zichzelf (in de hoofdmap).
      if (fileName.endsWith(".wasm")) await copyFile(join(litertWasmDirectory, fileName), join(outputDirectory, fileName));
    }
  }

  await copyFile(whoWasmPath, join(outputDirectory, "WhoWeb.wasm"));
  await copyFile(vozWasmPath, join(outputDirectory, "VozWeb.wasm"));
  await copyFile(pdfWorkerPath, join(outputDirectory, "pdf.worker.mjs"));


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
  workerBundle = await buildWorkerBundle();
  server.listen(port, host, () => {
    console.log(`Voz Transcriber staat klaar op http://${host}:${port}`);
  });
}

void main().catch((error: unknown) => {
  console.error("De app kon niet worden gestart:", error);
  process.exitCode = 1;
});
