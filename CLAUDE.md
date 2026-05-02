# Ramble On – CLAUDE.md

Desktop-first voice-notes app built with **Vite + TypeScript + Electron**.
Records audio, transcribes with Gemini, polishes into markdown notes, and supports ATP / Medium / video export workflows.

## Key Commands

```bash
npm install              # install dependencies
npm run dev              # Vite dev server only (port 5173)
npm run desktop:dev      # Vite + Electron together (full desktop flow)
npm run typecheck        # tsc --noEmit
npm run test             # Vitest run (jsdom environment)
npm run ci               # typecheck + test + build
npm run build            # Vite web bundle → dist/
npm run desktop:build    # Electron Builder package → dist-electron/
```

## Architecture

| Layer | File | Role |
|---|---|---|
| Renderer | `src/main.tsx` | Single `VoiceNotesApp` controller class; owns UI, recording, AI calls, KB rendering |
| Styles | `src/index.css` | Full renderer styling |
| Types | `src/types.d.ts` | Preload bridge typings (`window.rambleOnDB`) |
| Main process | `electron/main.cjs` | Window creation, SQLite init, IPC handlers, KB filesystem watch |
| Preload bridge | `electron/preload.cjs` | `contextBridge` boundary; exposes `window.rambleOnDB` to renderer |
| MCP server | `electron/mcp-server.cjs` | Local HTTP JSON-RPC on `127.0.0.1:3748`; Gemini + Notion tools |
| Shell | `index.html` | Static DOM contract that `VoiceNotesApp` binds to |
| Tests | `tests/` | Vitest smoke tests (jsdom) |

### Communication paths

- Renderer → main process: `ipcRenderer.invoke()` / `ipcMain.handle()`
- Main → renderer: one-way `kb:updated` IPC event
- Renderer → AI: direct provider calls (Gemini / OpenAI / Anthropic)
- MCP server → tools: local HTTP JSON-RPC

### Persistence model

- Notes: renderer `localStorage`
- Recording metadata + KB snapshots: SQLite in Electron user-data dir (`better-sqlite3`)
- Knowledge Base files: `kb/` directory (dev) or user-data dir (packaged); mirrored into SQLite

## Environment Variables

Create `.env.local` (or `env.local`) in the project root with the required variables before running.

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | Default text provider: `gemini`, `openai`, or `anthropic` |
| `GEMINI_API_KEY` | Primary Gemini key (also accepted as `API_KEY`) |
| `OPENAI_API_KEY` | OpenAI key (text + transcription) |
| `ANTHROPIC_API_KEY` | Anthropic key (text only; transcription falls back to OpenAI then Gemini) |
| `NOTION_API_KEY` | Required for MCP Notion tools |
| `RAMBLE_MCP_PORT` | MCP server port override (default `3748`) |
| `VITE_DEV_SERVER_URL` | Set automatically by `desktop:dev`; do not set manually |
| `GEMINI_TEXT_MODEL` / `OPENAI_TEXT_MODEL` / `ANTHROPIC_TEXT_MODEL` | Model overrides |
| `GEMINI_TRANSCRIPTION_MODEL` / `OPENAI_TRANSCRIPTION_MODEL` | Transcription model overrides |
| `GEMINI_VIDEO_MODEL` | Video generation model override |

## Coding Standards

- Prefer small, single-purpose methods. Keep control flow explicit and shallow.
- Validate inputs at trust boundaries: filesystem paths (`resolveKbPath`) and IPC payloads.
- Isolate privileged operations behind narrow interfaces (preload bridge pattern).
- Favor predictable local state and clear ownership over implicit global coupling.
- Keep `typecheck`, `test`, and `build` green before committing.
- Do not add error handling, fallbacks, or abstractions for scenarios that cannot happen.
- Do not over-engineer: minimum complexity for the current task.

## Known Characteristics

- Renderer is one large controller class (`VoiceNotesApp`) – avoid deepening that coupling.
- Note persistence is split between `localStorage` and SQLite – be explicit about which store you touch.
- Video generation is intentionally Gemini-only; text/transcription are provider-agnostic.
- Automated tests are light – add coverage when touching logic that is hard to inspect manually.
