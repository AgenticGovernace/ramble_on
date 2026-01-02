
# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1dapkXq47nlX2ZVEsw-2gkFpyJ1nEMniJ

## Run Locally (Web)

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Run Locally (Desktop via Electron)

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local)
3. Start the desktop app (uses Vite dev server):
   `npm run desktop:dev`
4. Desktop builds store data in a local SQLite DB under the Electron user data directory.
5. Knowledge base files live in `kb/` (project root in dev); edits are synced into SQLite.
6. Use the sidebar “Manage Knowledge Base” button to create/rename/delete KB folders and files.

## Build Desktop App

- `npm run desktop:build` builds the Vite renderer and packages the Electron app.
  - macOS output: `dist-electron/*.dmg` (and `*.zip`)
  - Install on macOS: open the `.dmg` and drag **Ramble On** into **Applications**
  - Note: for public distribution (no Gatekeeper warnings), you’ll want Apple code-signing + notarization.
- `npm run desktop:build:mac` builds macOS targets explicitly.
  - These desktop builds use `vite build --base=./` so assets load correctly via `file://` in Electron.
