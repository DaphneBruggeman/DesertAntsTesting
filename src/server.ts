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
  .speaker-1 { color: #111; background: #76d2b6; }
  .speaker-2 { color: #111; background: #e17000; }
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

  .shell { width: min(100% - 48px, 1440px); }
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
  .workspace { padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .setup-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 16px; }
  .setup-column { display: grid; grid-template-rows: auto auto; align-content: start; gap: 14px; }
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
  .recorder { display: flex; min-height: 0; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 17px 19px; background: white; }
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
  footer { justify-content: center; margin-top: 20px; padding: 14px 0 20px; border-top: 2px solid #154273; color: #154273; font-size: 13px; }
  footer strong { margin-left: 4px; color: #007bc7; }

  @media (max-width: 900px) {
    .setup-grid { grid-template-columns: minmax(0, 1fr); }
    .setup-column { grid-template-rows: auto auto; }
    .privacy-banner { grid-template-columns: 40px minmax(0, 1fr); }
    .privacy-facts { grid-column: 2; grid-template-columns: repeat(2, max-content); }
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
  "const copyButton = document.querySelector(\"#copy-button\");\r",
  "const downloadButton = document.querySelector(\"#download-button\");\r",
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
  "function markdownExport() {\r",
  "  if (!contextMarkdown) return completedText;\r",
  "  return `${completedText}\\n\\n---\\n\\n## Documentcontext: ${documentTitle(contextDocumentName)}\\n\\n${contextMarkdown}`.trim();\r",
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
  "function renderTranscript() {\r",
  "  transcript.replaceChildren();\r",
  "  renderedSentences.forEach((sentence, sentenceIndex) => {\r",
  "    const speakerLabel = speakerLabelFor(sentence.speaker);\r",
  "    const sentenceRow = document.createElement(\"div\");\r",
  "    sentenceRow.className = \"sentence-row\";\r",
  "    const sentenceTime = document.createElement(\"span\");\r",
  "    sentenceTime.className = \"word-time\";\r",
  "    sentenceTime.textContent = `${sentence.words[0].start.toFixed(2)} – ${sentence.words[sentence.words.length - 1].end.toFixed(2)} s`;\r",
  "    const text = document.createElement(\"div\");\r",
  "    text.className = \"word-text\";\r",
  "    const speaker = document.createElement(\"span\");\r",
  "    speaker.className = sentence.speaker === null\r",
  "      ? \"speaker-label speaker-unknown\"\r",
  "      : `speaker-label speaker-${sentence.speaker % 4}`;\r",
  "    speaker.textContent = speakerLabel;\r",
  "    const sentenceEdit = document.createElement(\"textarea\");\r",
  "    sentenceEdit.className = \"sentence-edit\";\r",
  "    sentenceEdit.rows = 2;\r",
  "    sentenceEdit.maxLength = 5000;\r",
  "    sentenceEdit.setAttribute(\"aria-label\", `Zin ${sentenceIndex + 1} bewerken`);\r",
  "    sentenceEdit.value = sentence.editedText ?? sentence.words.map((word) => word.text).join(\" \");\r",
  "    sentenceEdit.addEventListener(\"input\", () => {\r",
  "      sentence.editedText = sentenceEdit.value;\r",
  "      completedText = transcriptText();\r",
  "    });\r",
  "    text.append(speaker, sentenceEdit);\r",
  "    sentenceRow.append(sentenceTime, text);\r",
  "    transcript.append(sentenceRow);\r",
  "  });\r",
  "  completedText = transcriptText();\r",
  "}\r",
  "\r",
  "function renderResult(result) {\r",
  "  renderedSentences = makeSentences(result.words);\r",
  "  renderTranscript();\r",
  "\r",
  "  if (result.words.length === 0) {\r",
  "    const empty = document.createElement(\"p\");\r",
  "    empty.className = \"word-text\";\r",
  "    empty.textContent = \"Er zijn geen woorden herkend.\";\r",
  "    transcript.append(empty);\r",
  "  }\r",
  "\r",
  "  resultMeta.textContent = `${result.speakerCount} ${result.speakerCount === 1 ? \"spreker\" : \"sprekers\"} herkend · ${result.words.length} woorden · ${result.duration.toFixed(1)} seconden audio · verwerkt in ${result.processingTime.toFixed(1)} seconden`;\r",
  "  updateContextPreview();\r",
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
  "      vozPromise = Promise.all([\r",
  "        import(\"@desert-ant-labs/voz\"),\r",
  "        import(\"onnxruntime-web/wasm\"),\r",
  "      ]).then(([{ Voz }, ort]) => Voz.load({\r",
  "        ort,\r",
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
  "      recordingTime.textContent = formatTime((Date.now() - recordingStartedAt) / 1000);\r",
  "    }, 250);\r",
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
  "startButton.addEventListener(\"click\", () => {\r",
  "  speakerNames = [...speakerInputList.querySelectorAll(\".speaker-input-row\")]\r",
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
  "  label.textContent = String(number).padStart(2, \"0\");\r",
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
  "    numberLabel.textContent = String(number).padStart(2, \"0\");\r",
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
  "addSpeakerButton.addEventListener(\"click\", () => {\r",
  "  addSpeakerInput(speakerInputList.querySelectorAll(\".speaker-input-row\").length + 1);\r",
  "});\r",
  "speakerInputList.addEventListener(\"change\", updateReadiness);\r",
  "audioInputDevice.addEventListener(\"change\", updateReadiness);\r",
  "void refreshAudioInputs().catch((error) => showError(`Microfoons konden niet worden geladen: ${error instanceof Error ? error.message : String(error)}`));\r",
  "navigator.mediaDevices?.addEventListener(\"devicechange\", () => {\r",
  "  void refreshAudioInputs().catch((error) => showError(`Microfoons konden niet worden bijgewerkt: ${error instanceof Error ? error.message : String(error)}`));\r",
  "});\r",
  "copyButton.addEventListener(\"click\", async () => {\r",
  "  try {\r",
  "    await navigator.clipboard.writeText(markdownExport());\r",
  "    copyButton.textContent = \"Gekopieerd!\";\r",
  "    window.setTimeout(() => { copyButton.textContent = \"Kopieer Markdown\"; }, 1600);\r",
  "  } catch {\r",
  "    showError(\"Kopiëren is niet gelukt. Selecteer de tekst en kopieer deze handmatig.\");\r",
  "  }\r",
  "});\r",
  "downloadButton.addEventListener(\"click\", () => {\r",
  "  const markdown = markdownExport();\r",
  "  const baseName = (contextDocumentName || \"Transcriptie\").replace(/\\.[^.]+$/, \"\").replace(/[<>:\"/\\\\|?*\\u0000-\\u001f]/g, \"-\").trim() || \"Transcriptie\";\r",
  "  const url = URL.createObjectURL(new Blob([markdown], { type: \"text/markdown;charset=utf-8\" }));\r",
  "  const link = document.createElement(\"a\");\r",
  "  link.href = url;\r",
  "  link.download = `${baseName}.md`;\r",
  "  link.click();\r",
  "  window.setTimeout(() => URL.revokeObjectURL(url), 1000);\r",
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
  const assetVersion = process.env.GITHUB_SHA ?? String(Date.now());
  const versionedPageHtml = pageHtml
    .replace("./app.js", `./app.js?v=${assetVersion}`)
    .replace("./styles.css", `./styles.css?v=${assetVersion}`)
    .replace("./RVB-logo.png", `./RVB-logo.png?v=${assetVersion}`);
  await writeFile(join(outputDirectory, "index.html"), versionedPageHtml);
  await writeFile(join(outputDirectory, "styles.css"), styles);
  await writeFile(join(outputDirectory, "app.js"), await buildBrowserBundle());
  await copyFile(organizationLogoPath, join(outputDirectory, "RVB-logo.png"));

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
  await copyFile(pdfWorkerPath, join(outputDirectory, "pdf.worker.mjs"));

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
