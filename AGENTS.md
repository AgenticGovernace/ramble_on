# Repository Guidelines

## Project Structure & Module Organization
- `index.html` is the single-page entry point for the Vite app.
- `src/main.tsx` contains the main TypeScript/DOM logic (single-file app).
- `src/index.css` holds global styles.
- `electron/main.cjs` is the Electron main process entry.
- SQLite data is stored under the Electron user data path (created at runtime).
- `tests/` contains Vitest checks.
- Root configs: `package.json`, `vite.config.ts`, `tsconfig.json`, and `metadata.json`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start the Vite dev server for local development.
- `npm run build`: create a production build in `dist/`.
- `npm run preview`: serve the production build locally for verification.
- `npm run desktop:dev`: run Electron against the Vite dev server.
- `npm run desktop:build`: build and package the desktop app.
- `npm run test`: run Vitest in CI mode.
- `npm run test:watch`: run Vitest in watch mode.

## Coding Style & Naming Conventions
- Indentation: 2 spaces in TypeScript/TSX and CSS (match existing files).
- Naming: `PascalCase` for classes/types, `camelCase` for variables/functions, and `kebab-case` for CSS classes.
- Keep DOM selectors and IDs consistent with `index.html` to avoid runtime breakage.
- No formatter/linter configured; if adding one, align with current 2‑space style.

## Testing Guidelines
- Framework: Vitest with `jsdom` for DOM-friendly tests.
- Put new tests in `tests/` and prefer focused, fast checks (e.g., entry points, critical IDs).
- For UI changes, do a manual smoke test:
  - `npm run dev` and verify recording, note editing, and playback flows.
  - `npm run build` to ensure TypeScript compiles and Vite bundles cleanly.

## Commit & Pull Request Guidelines
- No commit history yet, so no established convention. Use concise, imperative subjects (e.g., "Add audio playback controls").
- PRs should include: a short description, what was verified (commands run), and screenshots or screen recordings for UI changes.

## Security & Configuration Tips
- Store API keys in `.env.local` (see `README.md`), e.g. `GEMINI_API_KEY=...`.
- Do not commit secrets or generated media; keep local data out of Git.
