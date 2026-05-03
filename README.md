<p><a target="_blank" href="https://app.eraser.io/workspace/jDEB8mJTOSwayWxoo33g" id="edit-in-eraser-github-link"><img alt="Edit in Eraser" src="https://firebasestorage.googleapis.com/v0/b/second-petal-295822.appspot.com/o/images%2Fgithub%2FOpen%20in%20Eraser.svg?alt=media&amp;token=968381c8-a7e7-472a-8ed6-4a6626da5501"></a></p>

# Ramble On
>  _"Your voice is not just sound. It's structure. It's memory. It's intent."_ 

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
- Transcription powered by Google Gemini
### 🧠 Three Output Modes
Record once. Route to wherever it needs to go:

| Mode | What it does |
| ----- | ----- |
| **Polished Note** | Cleans up the ramble into a readable, well-structured note |
| **ATP** | Formats as an Artemis Transmission Protocol prompt — structured for downstream agents |
| **Medium Post** | Restructures as a publication-ready Medium article, with SEO title, subtitle, tags, and KB-linked sections |
### 📚 Knowledge Base
The core of what makes this _yours_:

- File/folder tree structure, managed inside the app
- Files stored on disk (`kb/` ) and mirrored to SQLite
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
| AI | Google Gemini (`@google/genai`) |
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

## Getting Started
### Prerequisites
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
2. Add content to files (edit in-app or externally in `kb/` )
3. When you record a note, the full KB tree + file contents are serialized and passed into the AI prompt as context
4. The model uses that context to identify connections, maintain voice consistency, suggest related KB entries, and route content to the right place
In ATP mode, it will also suggest which KB files to update based on what you said.

---

## Backend Status
The Electron IPC + SQLite backend is functional. The following is built and stable:

- [x] Recording persistence (`recordings` , `raw_entries` , `polished_entries`  tables)
- [x] KB file sync (disk ↔ SQLite via chokidar watcher)
- [x] KB CRUD (create/rename/delete folders and files)
- [x] IPC handlers for all DB and KB operations
- [x] Preload bridge exposing `window.rambleOnDB` 
### In Progress / Remaining Backend Work
- [ ] Multi-user / shared KB support (currently single-user, local only)
- [ ] API key management UI (currently requires manual `.env.local` )
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
Commit messages: imperative, concise. (`Add Medium post export`, `Fix KB watcher on rename`)

---

## License
## Copyright © 2026 Ramble On / Prinston (Apollo) Palmer. All rights reserved.
Ramble On is built on the same infrastructure powering [﻿Artemis City](%5Bhttps://artemiscity.com%5D(https://github.com/AgenticGovernace/AgenticGovernance-ArtemisCity), a multi-agent governance platform. Learn more about kernel-driven AI at artemiscity.com._

---

_Built in 2026. For those who think in signal._


<!-- eraser-additional-content -->
## Diagrams
<!-- eraser-additional-files -->
<a href="/README-Ramble On - Voice Notes Architecture- Voice Notes Architecture-1.eraserdiagram" data-element-id="pJupsijLCSjraxyFLxrCn"><img src="/.eraser/jDEB8mJTOSwayWxoo33g___JbelnRLHqINDuNCF51xhpyclDXW2___---diagram----c678e0d009f9ae91dcd27ce39dcf5098-Ramble-On---Voice-Notes-Architecture--Voice-Notes-Architecture.png" alt="" data-element-id="pJupsijLCSjraxyFLxrCn" /></a>
<!-- end-eraser-additional-files -->
<!-- end-eraser-additional-content -->
<!--- Eraser file: https://app.eraser.io/workspace/jDEB8mJTOSwayWxoo33g --->