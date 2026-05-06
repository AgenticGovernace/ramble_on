<p><a target="_blank" href="https://app.eraser.io/workspace/y9OSW2QJXXHLvW5ZGWPg" id="edit-in-eraser-github-link"><img alt="Edit in Eraser" src="https://firebasestorage.googleapis.com/v0/b/second-petal-295822.appspot.com/o/images%2Fgithub%2FOpen%20in%20Eraser.svg?alt=media&amp;token=968381c8-a7e7-472a-8ed6-4a6626da5501"></a></p>

# Ramble On
>   _"Your voice is not just sound. It's structure. It's memory. It's intent."_  

**Ramble On** is a personal signal translation layer — a desktop app that lets you speak the way you think, and handles everything else.

You ramble. It listens. It knows you. It writes like you — but cleaned up, contextualized, and ready for wherever it's going.

---

## What This Is (And Isn't)
This is **not** a transcription tool.

It's not a voice-to-text widget. It's not a note-taking app with an AI button bolted on.

It's closer to what Stephen Hawking's voice synthesizer actually was — not a translator between languages, but a carrier of signal. The machine worked because it knew the man. The context was built in. Every word that came out was still _his_.

Ramble On does the same thing for the rest of us. You load it with your Knowledge Base — your writing, your references, your notes, your rules for the platforms you publish on. Then you talk. It takes what you said, cross-references it against everything you've taught it, and produces something that sounds exactly like you on your best day.

**The real mission:** People who communicate in signal — fast, non-linear, context-heavy, low on pleasantries — shouldn't be sidelined because the world is built for a different style. This app opens a path for them to be understood without having to become someone else.

---

## Current Features
### 🎙 Voice Recording & Transcription
- Record directly in-app via microphone
- Real-time waveform visualization (bars, waveform, spectrogram views)
- Audio playback of your recordings
- Transcription powered by your configured LLM provider
### 🧠 Three Output Modes
Record once. Route to wherever it needs to go:

| Mode | What it does |
| ----- | ----- |
| **Polished Note** | Cleans up the ramble into a readable, well-structured note |
| **ATP** | Formats as an Artemis Transmission Protocol prompt — structured for downstream agents |
| **Medium Post** | Restructures as a publication-ready Medium article, with SEO title, subtitle, tags, and KB-linked sections |
| Mode | What it does |
| ----- | ----- |
| **Polished Note** | Cleans up the ramble into a readable, well-structured note |
| **ATP** | Formats as an Artemis Transmission Protocol prompt — structured for downstream agents |
| **Medium Post** | Restructures as a publication-ready Medium article, with SEO title, subtitle, tags, and KB-linked sections |
### 📚 Knowledge Base
The core of what makes this _yours_:

- File/folder tree structure, managed inside the app
- Files stored on disk (`kb/`  ) and mirrored to SQLite
- KB content is injected into every AI prompt — it's the context the model uses to write like you
- Live file watching via chokidar — edit files externally, app stays in sync
- Supports `.md`  and plain text files
- The KB viewer tab renders markdown in-app
### ✍️ Note Management
- Polished + Raw tabs per note
- Inline editing of both polished and raw content
- Append mode — add to an existing note without overwriting
- Persistent storage in SQLite (all notes survive app restarts)
### 🔊 Read Aloud
- Listen back to your polished note via browser TTS
### 🎬 Video Generation
- Generate a video summary from a note (experimental)
### 🔄 Auto-Update
- Packaged app auto-updates from `AgenticGovernace/ramble_on`  on GitHub
---

## Tech Stack
| Layer | Tech |
| ----- | ----- |
| App framework | Electron 35 |
| Frontend | Vite + TypeScript (single-file SPA) |
| AI | Pluggable LLM provider (`@google/genai`, `openai`, `@anthropic-ai/sdk`) |
| Local DB | SQLite via `better-sqlite3`  |
| File watching | `chokidar`  |
| Markdown rendering | `marked`  |
| Testing | Vitest + jsdom |
| Distribution | `electron-builder` (DMG/NSIS/AppImage) |
---

## Project Structure
```
ramble_on/
├── src/
│   ├── main.tsx          # All frontend logic (single-file app)
│   └── index.css         # Global styles
├── electron/
│   ├── main.cjs          # Electron main process + IPC handlers + SQLite
│   └── preload.cjs       # Context bridge (exposes rambleOnDB to renderer)
├── kb/                   # Knowledge Base files (on-disk, synced to SQLite)
├── tests/                # Vitest tests
├── index.html            # SPA entry point
├── vite.config.ts
├── tsconfig.json
└── package.json
```
---

## Architecture Overview
### 1. Vite Frontend (Host / MCP Client)
The frontend is implemented as a single controller class, `VoiceNotesApp`, in [﻿src/main.tsx](https://src/main.tsx). This class acts as the composition root for the browser-side application and is the **primary host and client** for the MCP server — it initiates all requests for AI transformation, context retrieval, and Knowledge Base interaction through the MCP layer rather than calling LLM provider APIs directly.

Architectural style:

- Monolithic controller pattern in the renderer
- Event-driven UI wiring through DOM listeners
- Local state container held on the class instance
- Browser API composition rather than framework-managed reactivity
- Acts as MCP client: all AI and KB context requests are routed through the local MCP server
Key frontend workflows:

- `toggleRecording()`  , `startRecording()`  , `stopRecording()`  , `processAudio()`  
- `getTranscription()`  , `getPolishedNote()`  
- `formatAsATP()`  , `formatAsMediumPost()`  
- `openKnowledgeBaseFile()`  , `saveKnowledgeBaseFile()`  
- `startVideoGeneration()` 
The renderer is implemented as a single controller class, `VoiceNotesApp`, in [﻿src/main.tsx](src/main.tsx). This class acts as the composition root for the browser-side application.

Architectural style:

- Monolithic controller pattern in the renderer
- Event-driven UI wiring through DOM listeners
- Local state container held on the class instance
- Browser API composition rather than framework-managed reactivity
Key renderer workflows:

- `toggleRecording()` , `startRecording()` , `stopRecording()` , `processAudio()` 
- `getTranscription()` , `getPolishedNote()` 
- `formatAsATP()` , `formatAsMediumPost()` 
- `openKnowledgeBaseFile()` , `saveKnowledgeBaseFile()` 
- `startVideoGeneration()` 
### 2. Electron Main Process
The Electron main process in [﻿electron/main.cjs](https://electron/main.cjs) is the desktop orchestration layer. It is **not** responsible for AI calls or LLM interactions — those are handled by the MCP server layer.

Its responsibilities are:

- Creating the application window
- Initializing SQLite via `better-sqlite3` 
- Registering IPC handlers for note and Knowledge Base persistence
- Managing the Knowledge Base root directory
- Watching the Knowledge Base on disk via `chokidar` 
- Mirroring Knowledge Base files into SQLite for queryability
- Starting and stopping the local MCP server
Important helpers:

- `initDatabase()`  : Creates tables and prepared statements
- `resolveKbPath()`  : Prevents path traversal and absolute-path escapes
- `readKbTree()`  : Builds the renderer-facing file tree
- `startKbWatcher()`  : Keeps the renderer and SQLite synchronized with disk
- `registerIpcHandlers()`  : Defines the renderer-facing persistence interface
Persistence model:

- Notes themselves are stored in renderer `localStorage` 
- Recording metadata, raw entries, polished entries, and Knowledge Base snapshots live in SQLite under the Electron user-data directory
- Knowledge Base files are stored as regular files under `kb/`  in development or under the packaged app user-data directory in production
The Electron main process in [﻿electron/main.cjs](electron/main.cjs) is the desktop orchestration layer.

Its responsibilities are:

- Creating the application window
- Initializing SQLite via `better-sqlite3` 
- Registering IPC handlers for note and Knowledge Base persistence
- Managing the Knowledge Base root directory
- Watching the Knowledge Base on disk via `chokidar` 
- Mirroring Knowledge Base files into SQLite for queryability
- Starting and stopping the local MCP server
Important helpers:

- `initDatabase()` : Creates tables and prepared statements
- `resolveKbPath()` : Prevents path traversal and absolute-path escapes
- `readKbTree()` : Builds the renderer-facing file tree
- `startKbWatcher()` : Keeps the renderer and SQLite synchronized with disk
- `registerIpcHandlers()` : Defines the renderer-facing persistence interface
Persistence model:

- Notes themselves are stored in renderer `localStorage` 
- Recording metadata, raw entries, polished entries, and Knowledge Base snapshots live in SQLite under the Electron user-data directory
- Knowledge Base files are stored as regular files under `kb/`  in development or under the packaged app user-data directory in production
### 3. Preload Bridge
[﻿electron/preload.cjs](electron/preload.cjs) uses `contextBridge.exposeInMainWorld()` to publish a constrained `window.rambleOnDB` API. This is the app's main boundary between untrusted renderer code and privileged Electron capabilities.

Exposed operations:

- `saveRecording` 
- `saveRawEntry` 
- `savePolishedEntry` 
- `getKnowledgeBase` 
- `writeKnowledgeBaseFile` 
- `createKnowledgeBaseFolder` 
- `createKnowledgeBaseFile` 
- `deleteKnowledgeBasePath` 
- `renameKnowledgeBasePath` 
- `onKnowledgeBaseUpdated` 
This is the repository's clearest service-boundary pattern. It is not dependency injection in a formal container sense, but it is a service interface exposed across a trust boundary.

### 4. MCP Server Layer
[﻿electron/mcp-server.cjs](https://electron/mcp-server.cjs) exposes a local HTTP JSON-RPC server. The **Vite frontend acts as its host and client** — all AI transformation and context retrieval requests originate from the frontend and are routed through this server. This keeps LLM provider logic centralized and out of the renderer process.

Responsibilities:

- Serving `tools/list`  , `tools/call`  , and `initialize`  JSON-RPC methods
- Wrapping LLM provider text transformation workflows (provider is configurable at runtime)
- Wrapping Notion Knowledge Base search and write operations
- Providing the frontend with a single, stable interface for all AI and context operations
- Enabling codebase and context retrieval for downstream agents or collaborators
Tool handlers:

- `translate()`  : Raw text to polished note
- `toAtp()`  : Raw text to ATP payload
- `toPlatformPost()`  : Raw text to platform-specific post
- `kbSearch()`  : Notion search
- `kbWrite()`  : Notion page append/create
- `getVoiceModel()`  : Voice model discovery in Notion
External interfaces:

- HTTP on `127.0.0.1:${RAMBLE_MCP_PORT:-3748}` 
- JSON-RPC 2.0 requests
- Notion REST API
- Configured LLM provider (Gemini, OpenAI, or Anthropic) via `@google/genai`  / `openai`  / `@anthropic-ai/sdk` 
[﻿electron/mcp-server.cjs](electron/mcp-server.cjs) exposes a local HTTP JSON-RPC server intended to be consumed as an MCP tool provider.

Responsibilities:

- Serving `tools/list` , `tools/call` , and `initialize`  JSON-RPC methods
- Wrapping Gemini text transformation workflows
- Wrapping Notion Knowledge Base search and write operations
- Providing a machine-callable local interface for translation-related features
Tool handlers:

- `translate()` : Raw text to polished note
- `toAtp()` : Raw text to ATP payload
- `toPlatformPost()` : Raw text to platform-specific post
- `kbSearch()` : Notion search
- `kbWrite()` : Notion page append/create
- `getVoiceModel()` : Voice model discovery in Notion
External interfaces:

- HTTP on `127.0.0.1:${RAMBLE_MCP_PORT:-3748}` 
- JSON-RPC 2.0 requests
- Notion REST API
- Gemini API through `@google/genai` 
## Component Interactions
The primary request and data flow is:

1. `index.html`  loads `src/main.tsx` .
2. `DOMContentLoaded`  creates `VoiceNotesApp` .
3. `VoiceNotesApp`  binds DOM events, restores local state, and requests Knowledge Base data from `window.rambleOnDB` .
4. `window.rambleOnDB`  forwards those calls through the preload bridge to Electron IPC.
5. `electron/main.cjs`  executes IPC handlers against SQLite and the filesystem.
6. Knowledge Base changes are pushed back to the renderer through the `kb:updated`  IPC event.
7. **All AI formatting flows** (transcription, polishing, ATP formatting, Medium formatting, video generation) are sent from the Vite frontend **to the local MCP server** as JSON-RPC requests. The MCP server selects the configured LLM provider and executes the transformation.
8. The Electron main process starts the local MCP server on app launch; the MCP server also handles Notion-backed KB operations for external tool-driven workflows.
Communication methods:

- Renderer to main process: Electron IPC with `ipcRenderer.invoke()`  and `ipcMain.handle()` 
- Main process to renderer: one-way IPC event `kb:updated` 
- **Vite frontend to MCP server: local HTTP JSON-RPC (frontend is the MCP client)**
- MCP server to LLM provider: direct provider SDK calls (Gemini, OpenAI, or Anthropic — selected at runtime)
- MCP server to Notion: HTTPS REST calls
Dependency/service patterns:

- Preload bridge acts as a service façade for privileged desktop operations
- SQLite access is centralized in the Electron main process through prepared statements
- Knowledge Base path resolution is centralized to prevent repeated path-safety logic
- **LLM provider logic is centralized in the MCP server; the frontend does not call provider SDKs directly**
- Renderer logic is tightly coupled inside one large controller class rather than split into injectable services
The primary request and data flow is:

1. `index.html`  loads `src/main.tsx` .
2. `DOMContentLoaded`  creates `VoiceNotesApp` .
3. `VoiceNotesApp`  binds DOM events, restores local state, and requests Knowledge Base data from `window.rambleOnDB` .
4. `window.rambleOnDB`  forwards those calls through the preload bridge to Electron IPC.
5. `electron/main.cjs`  executes IPC handlers against SQLite and the filesystem.
6. Knowledge Base changes are pushed back to the renderer through the `kb:updated`  IPC event.
7. AI formatting flows call Gemini directly from the renderer for transcription, polishing, ATP formatting, Medium formatting, and video generation.
8. The Electron main process separately starts the local MCP server, which also calls Gemini and Notion for external tool-driven workflows.
Communication methods:

- Renderer to main process: Electron IPC with `ipcRenderer.invoke()`  and `ipcMain.handle()` 
- Main process to renderer: one-way IPC event `kb:updated` 
- **Vite frontend to MCP server: local HTTP JSON-RPC — the frontend is the MCP host/client**
- MCP server to LLM provider: provider SDK calls (runtime-selectable: Gemini, OpenAI, or Anthropic)
- MCP server to Notion: HTTPS REST calls
Dependency/service patterns:

- Preload bridge acts as a service façade for privileged desktop operations
- SQLite access is centralized in the Electron main process through prepared statements
- Knowledge Base path resolution is centralized to prevent repeated path-safety logic
- Renderer logic is tightly coupled inside one large controller class rather than split into injectable services
## Deployment And Build Architecture
### Local Development
Web-only development:

## Getting Started
### Prerequisites
- Node.js (v18+)
- An API key for your chosen LLM provider (Gemini, OpenAI, or Anthropic)
- Node.js (v18+)
- A [﻿Google Gemini API key](https://ai.google.dev/) 
### Web (Dev)
```bash
npm install
# Create .env.local and add your key:
echo "GEMINI_API_KEY=your_key_here" > .env.local
npm run dev
```
### Desktop (Dev)
```bash
npm install
echo "GEMINI_API_KEY=your_key_here" > .env.local
npm run desktop:dev
```
Electron will open against the Vite dev server. Knowledge Base files live in `kb/` at the project root in dev mode.

### Desktop (Build)
```bash
npm run desktop:build
# macOS: dist-electron/*.dmg
# Windows: dist-electron/*.exe (NSIS)
# Linux: dist-electron/*.AppImage
```
Drag the `.dmg` to Applications. For public distribution, Apple code-signing and notarization are required to avoid Gatekeeper warnings.

---

## Knowledge Base
The KB is the memory that makes this app _personal_. Think of it as the "known context" half of the Hawking analogy.

**What to put in it:**

- Your writing samples (so the model learns your voice)
- Style guides and rules for each platform you publish on (Medium, Substack, your blog, etc.)
- Personal reference notes — recurring topics, your frameworks, your terminology
- Project docs, research notes, anything you want the model to be able to reference
**How it works in the app:**
1. Sidebar → **Manage Knowledge Base** → create folders and files
2. Add content to files (edit in-app or externally in `kb/`  )
3. When you record a note, the full KB tree + file contents are serialized and passed into the AI prompt as context
4. The model uses that context to identify connections, maintain voice consistency, suggest related KB entries, and route content to the right place
In ATP mode, it will also suggest which KB files to update based on what you said.
---

## Backend Status
The Electron IPC + SQLite backend is functional. The following is built and stable:

- [x] Recording persistence (`recordings`  , `raw_entries`  , `polished_entries`  tables)
- [x] KB file sync (disk ↔ SQLite via chokidar watcher)
- [x] KB CRUD (create/rename/delete folders and files)
- [x] IPC handlers for all DB and KB operations
- [x] Preload bridge exposing `window.rambleOnDB` 
### In Progress / Remaining Backend Work
- [ ] Multi-user / shared KB support (currently single-user, local only)
- [ ] API key management UI (currently requires manual `.env.local`  )
- [ ] Platform connector layer — structured KB sections per publishing target (Medium, Substack, Ghost, etc.)
- [ ] Export pipeline — direct post drafting to platform APIs
- [ ] Sync layer — optional cloud backup of KB + notes
- [ ] Auth (for future multi-device or shared team use)
---

## ATP Mode — What It Is
ATP stands for **Artemis Transmission Protocol**. It's a structured prompt format for agent-to-agent communication.

When you record in ATP mode, the app doesn't just clean up your note — it generates a fully structured dispatch:

```markdown
[[Mode]]: Build
[[Context]]: Scaffolding the new backend sync layer
[[Priority]]: High
[[ActionType]]: Scaffold
[[TargetZone]]: /Projects/RambleOn/Backend
[[SpecialNotes]]: Reference existing IPC patterns in electron/main.cjs
[[Suggested KB Actions]]:
- Create file '/Projects/RambleOn/Backend/sync-spec.md'
- Append to '/Research/Architecture/patterns.md'
[[MetaLink]]: #backend - /Projects/RambleOn - Mirrors the KB sync pattern you designed for the watcher
```
This is designed to be picked up by another agent, a human collaborator, or dropped directly into a build session.

---

## The Mission
This started as a personal tool. It's meant to be shared.

A lot of people think and communicate in ways that don't fit the expected format — fast, associative, signal-dense, low on social filler. They're not being unclear. They're being efficient in a dialect most systems aren't built to decode.

This app is a translation layer for that dialect. It doesn't change what you're saying. It makes what you're saying land.

If you've ever been told you're "hard to follow," this is for you.
If you've got ideas that move faster than your ability to write them down cleanly, this is for you.
If you've spent energy performing clarity instead of producing it, this is for you.

**Ramble On. Signal intact.**

---

## Contributing
This is in active development. If you want to contribute:

1. Fork `AgenticGovernace/ramble_on`  
2. Branch off `main`  
3. PRs should include: what changed, what you tested, and a screen recording for UI changes
Commit messages: imperative, concise. (`Add Medium post export` , `Fix KB watcher on rename` )
---

## License
## Copyright © 2026 Ramble On / Prinston (Apollo) Palmer. All rights reserved.
Ramble On is built on the same infrastructure powering [﻿Artemis City](%5Bhttps://artemiscity.com%5D(https://github.com/AgenticGovernace/AgenticGovernance-ArtemisCity), a multi-agent governance platform. Learn more about kernel-driven AI at artemiscity.com._

---

_Built in 2026. For those who think in signal._

- `AI_PROVIDER`  : Default text provider (`gemini`  , `openai`  , or `anthropic`  )
- `GEMINI_API_KEY`  : Gemini API key
- `API_KEY`  : Alternate Gemini API key fallback
- `GEMINI_TEXT_MODEL`  : Optional Gemini text model override
- `GEMINI_TRANSCRIPTION_MODEL`  : Optional Gemini speech model override
- `GEMINI_VIDEO_MODEL`  : Optional Gemini video model override
- `OPENAI_API_KEY`  : OpenAI API key for text and transcription
- `OPENAI_TEXT_MODEL`  : Optional OpenAI text model override
- `OPENAI_TRANSCRIPTION_MODEL`  : Optional OpenAI transcription model override
- `ANTHROPIC_API_KEY`  : Anthropic API key for text generation
- `ANTHROPIC_TEXT_MODEL`  : Optional Anthropic text model override
- `NOTION_API_KEY`  : Required for MCP Notion access
- `RAMBLE_NOTION_ROOT`  : Optional Notion root page ID override
- `RAMBLE_MCP_PORT`  : Optional MCP server port override (default: `3748` )
- `VITE_DEV_SERVER_URL`  : Electron development URL for the renderer
### Runtime Environments
Current code supports these practical modes:

- Browser/Vite development: renderer features work, desktop persistence bridge does not
- Electron development: full desktop flow, local SQLite, Knowledge Base disk access, local MCP server
- Electron packaged production: full desktop flow using packaged assets and a user-data Knowledge Base root
There is no separate server-side dev/staging/prod deployment model in the repository. The release architecture is a packaged desktop application, not a multi-environment web service.

## Runtime Behavior
### Application Initialization
Startup sequence:

1. Electron `app.whenReady()`  initializes SQLite, IPC handlers, the MCP server, the main window, and the Knowledge Base watcher.
2. The renderer bootstraps on `DOMContentLoaded` .
3. `VoiceNotesApp`  captures all DOM references, binds listeners, restores theme and append mode, loads notes from `localStorage` , loads Knowledge Base data through the preload bridge, and registers a watcher callback.
### Note Capture And Processing
When the user records:

1. `startRecording()`  requests microphone access.
2. `MediaRecorder`  captures audio chunks.
3. `processAudio()`  converts the result to base64 and prepares playback.
4. The frontend sends the audio to the **MCP server** via JSON-RPC; the MCP server calls the configured LLM provider for transcription.
5. If the recording is a normal note, the raw transcript is inserted into the current note and persisted.
6. The frontend sends the transcript to the **MCP server** for polishing; the MCP server returns markdown-formatted output.
7. The polished markdown is rendered with `marked` .
8. Raw and polished content are persisted through `window.rambleOnDB`  when available.
### Knowledge Base Workflow
When the renderer needs Knowledge Base data:

1. It calls `window.rambleOnDB.getKnowledgeBase()` .
2. Electron reads the `kb/`  directory tree from disk.
3. The tree is returned to the renderer.
4. The renderer rebuilds path metadata and re-renders the tree.
When the user edits the Knowledge Base:

1. The renderer calls an IPC-backed preload method.
2. The main process validates and resolves the path.
3. The main process applies the filesystem change.
4. The SQLite mirror is updated.
5. `kb:updated`  is emitted back to the renderer.
6. The renderer reloads the Knowledge Base tree.
### ATP / Medium / Video Workflows
- ATP and Medium flows send the current polished note and optional spoken instructions to the **MCP server** via JSON-RPC. The MCP server uses the configured LLM provider to transform the content into a structured output.
- Video generation submits the polished note text to the MCP server, which routes it to the appropriate LLM provider and polls until the operation completes.
- The result is surfaced through a modal with loading, success, and error states.
### Error Handling
The codebase relies mainly on:

- `try/catch`  blocks around browser, filesystem, IPC, and AI operations
- Status-text updates in the UI
- `console.error()`  and `console.warn()`  logging
- Guard clauses when required state or APIs are unavailable
- `alert()`  dialogs for user-visible failure cases in some workflows
There is no centralized error boundary or structured telemetry layer. Error handling is local and imperative.

### Background Activity
Long-lived background work is limited to:

- Electron file watching via `chokidar` 
- The local MCP HTTP server
- MediaRecorder and Web Audio analyzer loops during active recording
- Speech synthesis while reading aloud
- Polling for long-running video generation operations
## Setup Guide For A New Developer
Prerequisites:

- Node.js 20 recommended
- npm
- macOS, Windows, or Linux for Electron packaging
Install:

```bash
npm install
```
Useful commands:

```bash
npm run dev
npm run desktop:dev
npm run typecheck
npm run test
npm run build
npm run desktop:build
```
If you need Gemini or Notion-backed features, set the relevant environment variables before launching the app.

Provider selection:

- The app header includes an `AI`  selector for runtime text-provider selection.
- `Gemini`  : text, transcription, and video are supported.
- `OpenAI`  : text and transcription are supported.
- `Anthropic`  : text is supported. Transcription falls back to OpenAI when configured, otherwise Gemini.
- Video generation is currently only supported when the Gemini provider is selected.
- **All provider calls are executed inside the MCP server, not the renderer process.**
## Testing
Current test coverage is minimal and focuses on static entry points and basic DOM access:

- [﻿tests/app.test.ts](tests/app.test.ts) 
- [﻿tests/sample.test.ts](tests/sample.test.ts) 
The tests do not currently exercise:

- Electron IPC flows
- SQLite persistence
- Notion integration
- MCP request handling
- MediaRecorder and microphone behavior
- Gemini calls
## Coding Standards Applied To This TypeScript Codebase
The repository is not C++, so the Joint Strike Fighter guidance cannot be applied literally. The practical translation for this codebase is:

- Prefer small, single-purpose methods over large multi-stage routines.
- Keep control flow explicit and shallow; avoid clever expressions with hidden side effects.
- Validate inputs at trust boundaries, especially filesystem paths and IPC payloads.
- Isolate privileged operations behind narrow interfaces such as the preload bridge.
- Favor predictable local state and clear ownership over implicit global coupling.
- Document externally visible behavior and public interfaces with JSDoc.
- Treat warnings seriously and keep `typecheck` , `test` , and `build`  green.
- Avoid unnecessary runtime dynamism that makes desktop behavior harder to reason about.
The current codebase partially aligns with those goals, especially in Electron path validation and the preload service boundary, but the renderer remains highly centralized and would benefit from further decomposition if maintainability becomes a priority.

## Known Architectural Characteristics
- Strong desktop-first design
- Thin security boundary via preload bridge
- Local-first persistence with SQLite plus filesystem-backed KB
- Heavy renderer-side orchestration in one large controller class
- **LLM provider logic centralized in the MCP server; Vite frontend acts as MCP host/client**
- No formal DI container or plugin architecture inside the app itself
## Repository Gaps Worth Knowing
- The renderer is implemented as a large controller class, which increases coupling and makes isolated testing harder.
- Note persistence is split between `localStorage`  and SQLite, so the data model is not fully unified.
- The MCP server is the single point of LLM provider interaction; any duplication of transformation logic between the renderer and MCP server should be eliminated by routing all AI calls through the MCP layer.
- Automated tests are light relative to the amount of runtime logic in the app.



<!-- eraser-additional-content -->
## Diagrams
<!-- eraser-additional-files -->
<a href="/README-Ramble On Build - Main Features-1.eraserdiagram" data-element-id="A0gt2s5nvplgF8mTCG9gX"><img src="/.eraser/y9OSW2QJXXHLvW5ZGWPg___JbelnRLHqINDuNCF51xhpyclDXW2___---diagram----0d81af4b9bc97d0ef921260e1338d63f-Ramble-On-Build---Main-Features.png" alt="" data-element-id="A0gt2s5nvplgF8mTCG9gX" /></a>
<a href="/README-Ramble On - Voice Notes Architecture- Voice Notes Architecture-2.eraserdiagram" data-element-id="pJupsijLCSjraxyFLxrCn"><img src="/.eraser/y9OSW2QJXXHLvW5ZGWPg___JbelnRLHqINDuNCF51xhpyclDXW2___---diagram----794d4390a88321595dcade9498ebc4f0-Ramble-On---Voice-Notes-Architecture--Voice-Notes-Architecture.png" alt="" data-element-id="pJupsijLCSjraxyFLxrCn" /></a>
<!-- end-eraser-additional-files -->
<!-- end-eraser-additional-content -->
<!--- Eraser file: https://app.eraser.io/workspace/y9OSW2QJXXHLvW5ZGWPg --->