# Ramble On — Active Workstreams

This document tracks the open issues carried forward from the original PR #7
review and lays out the phased plan for closing them. The original `feat/skill-integration`
work has landed on `main`; this branch is the new home for the follow-up
remediation.

---

## Branch promotion model

```
Development/feat/skill-md   ← active dev (this branch)
UAT/feat/skill-md           ← promoted from Development
Prod/feat/skill-md          ← promoted from UAT
main                        ← promoted from Prod
```

PRs flow Development → UAT → Prod → main. Rollback = revert PR at any stage.
The full branching contract lives in `BRANCHING.md` (TODO: author to add).

---

## Issue inventory (carried over from PR #7 review)

Severity legend: **P0** = blocker / security · **P1** = correctness · **P2** = polish.

### Security (P0)

| ID | File:Line | Status | Summary |
|---|---|---|---|
| **S1** | `electron/main.cjs` (legacy `app:get-api-keys`) | ✅ **landed on this branch** | Renderer was receiving raw provider keys via IPC. A.1 moved every AI call behind a privileged main-process proxy; the renderer no longer holds keys. |
| **S2** | `electron/mcp/server.cjs:155-168` | open | Localhost MCP endpoint has no auth/token. Any local process — or any web page via `fetch('http://127.0.0.1:3748/mcp', …)` — can drive Notion read/write tools and burn provider quota. **Phase A.2 (mTLS).** |
| S3 | `scripts/update.mjs:78` | open | CodeQL: potential file-system race condition (TOCTOU). |
| S4 | `scripts/update.mjs:112` | open | CodeQL: potential file-system race condition (TOCTOU). |
| S5 | `scripts/lib/checks.mjs:190` | open | CodeQL: file data flows into outbound network request. |
| S6 | `scripts/lib/checks.mjs:194` | open | CodeQL: file data flows into outbound network request. |

### Correctness (P1)

| ID | File:Line | Status | Summary |
|---|---|---|---|
| **C1** | `src/main.tsx::initProviderSelection` | ✅ **landed on this branch** | Provider selector was seeded from build-time `DEFAULT_PROVIDER` before async key fetch resolved → packaged builds ignored `AI_PROVIDER` from `.env.local`. Now async-init from a main-process preferences file with localStorage migration. |
| C2 | `src/main.tsx` | ✅ implicit fix | Renderer no longer needs keys at all, so the OpenAI/Anthropic browser-build fallback is no longer relevant. |
| C3 | `src/main.tsx::formatAsATP` / `formatAsMediumPost` | open | Structured-output JSON config is honored only on the Gemini branch. OpenAI / Anthropic outputs may break `JSON.parse` on prose preamble or fenced code. |
| C4 | `electron/mcp/clients/notion-client.cjs:170` | open | `kbWrite` append path puts entire payload into one `rich_text` entry. Notion caps text objects at 2000 chars → realistic long-form content fails validation. |
| C5 | `electron/mcp/clients/notion-client.cjs:190` | open | Same 2000-char overflow on the create path. |
| C6 | `electron/mcp/clients/notion-client.cjs:90` | open | `kbSearch` queries the entire Notion workspace, ignoring `RAMBLE_NOTION_ROOT`. |
| C7 | `electron/mcp/env.cjs::CONFIG.notion.rootPage` | open | Hard-coded fallback Notion page ID makes `RAMBLE_NOTION_ROOT` effectively required. |

### Polish (P2)

| ID | File:Line | Status | Summary |
|---|---|---|---|
| P1 | `src/index.css::providerSelect` | open | Native focus ring removed without replacement. Keyboard a11y regression. |

---

## Workstream sequencing

1. **A.1 — IPC proxy for AI calls** ✅ landed on this branch (commits `1a8574f`, `b55eeff`).
2. **A.2 — mTLS for MCP server** (closes S2). Requires the open questions in
   the implementation plan to be answered (cert storage location, bootstrap
   UX, token second factor). Separate PR off Development.
3. **C — Notion tool correctness** (C4 → C5 → C6 → C7). Independent of A.2;
   can land in parallel.
4. **C3 — Structured-output parity** for OpenAI/Anthropic (`formatAsATP`,
   `formatAsMediumPost`). Either constrained-output config or robust JSON
   extraction.
5. **D — CodeQL alerts** (S3 → S6). Low-touch.
6. **E — A11y polish** (P1). Last.

---

## Verification baseline (all green on this branch)

- `npm run typecheck` — passes
- `npm run test` — 9/9 pass
- `npm run build` — succeeds; built renderer bundle has zero references to
  provider keys or external provider URLs (S1 regression guard).

---

## Open questions for A.2 (mTLS)

These need answers before A.2 is implementable:

1. **Cert storage location.** OS keychain (Keychain on macOS, DPAPI/Credential
   Manager on Windows, libsecret on Linux) vs. fixed `~/.ramble-on/ca/` with
   file-mode 0600.
2. **Bootstrap UX.** Auto-generate certs on first run inside Electron's
   `app.whenReady()`, or ship a separate `npm run bootstrap-mtls` script?
3. **Renderer ↔ MCP transport.** Default proposal: renderer keeps using the
   preload bridge (in-process), and mTLS is reserved for external agents
   (Codex, Artemis, Obsidian bridge). Confirm or override.
4. **Token second factor.** Adopt a short-lived token alongside the client
   cert now (cheap to wire), or defer until first incident?
