<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

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

## Build Desktop App

- `npm run desktop:build` builds the Vite renderer and packages the Electron app.
