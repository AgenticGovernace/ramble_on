# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the renderer app: [`src/main.tsx`](src/main.tsx) is the main controller, [`src/index.css`](src/index.css) holds global styles, and [`src/types.d.ts`](src/types.d.ts) defines preload types. `electron/` contains the desktop shell: `main.cjs` for window, IPC, SQLite, and KB sync; `preload.cjs` for the renderer bridge; `mcp-server.cjs` for local tool APIs. `tests/` holds Vitest checks. `kb/` is the on-disk knowledge base created at runtime in the user-data directory (packaged) or under the project root (development). `build/`, `dist/`, and `dist-electron/` are build artifacts or resources.

## Build, Test, and Development Commands
Use `npm install` once to install dependencies. `npm run dev` starts the Vite renderer on `127.0.0.1:5173`. `npm run desktop:dev` runs Vite and Electron together for full app testing. `npm run typecheck` runs `tsc --noEmit`. `npm run test` runs Vitest once; `npm run test:watch` keeps tests running locally. `npm run build` creates the web bundle in `dist/`. `npm run desktop:build` packages the Electron app, and `npm run ci` runs typecheck, tests, and build in sequence.

## Coding Style & Naming Conventions
Match the existing 2-space indentation in TS, TSX, CSS, and CommonJS files. Use `PascalCase` for classes and types, `camelCase` for functions and variables, and keep DOM IDs and preload method names descriptive and stable. This codebase is not split into many small components, so prefer targeted helper functions over broad refactors unless the change requires it. No formatter or linter is configured; keep changes consistent with nearby code.

## Testing Guidelines
Tests use Vitest with the `jsdom` environment. Add new specs under `tests/` using the `*.test.ts` pattern. Favor fast smoke tests around entry points, DOM contracts, IPC-facing behavior, and regression-prone flows. There is no enforced coverage gate, so validate meaningful paths manually when changing recording, AI provider, or Electron/KB behavior.

## Commit & Pull Request Guidelines
Recent history uses short imperative subjects such as `Update README.md` and `Create jekyll-gh-pages.yml`. Keep commits focused and similarly concise. Pull requests should include a brief summary, linked issue if applicable, commands run for verification, and screenshots or recordings for visible UI changes.

## Security & Configuration Tips
Keep provider keys and local overrides in a local env file, not in commits. Review changes touching `env.local`, Electron IPC handlers, filesystem access, or the `kb/` tree carefully because they affect secrets, local data, and desktop trust boundaries.
