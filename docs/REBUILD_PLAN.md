# Codexa Rebuild Plan

> Living document. Status is updated as each item is completed.
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done

## Decisions
- **Formatting is 100% AI.** No deterministic formatting pass. The model formats from the *original* source.
- **Output must conform to [examples/](examples/)** (functions, hooks, imports, views) — used as both prompt few-shot ground truth and the test oracle.
- **Multi-provider** retained: Anthropic + OpenAI + OpenAI-compatible + local (Ollama).
- **Web app** (not a VS Code extension).
  - Backend: NestJS + Postgres/Prisma + BullMQ/Redis + SSE.
  - Frontend: Next.js + TanStack Query + Tailwind + Framer Motion + Zustand, built to the Downloads design.
- **Backend code now; frontend-code support later** — engine stays target-agnostic.

---

## Milestones

### M1 — AI-only engine + style conformance  `[x]` (B4 complete — see CONFORMANCE.md)
The core fix for "it made the code worse." Verifiable headlessly before any UI.

- [x] **A1** Stripped the deterministic pass from `@codexa/orchestrator` — `unit.ts` now feeds the original source straight to the provider; removed `formatDeterministic`/`DeterministicFormat` from `types.ts`, `run.ts`, `index.ts`, and tests.
- [x] **A2** Demoted `@codexa/language-typescript` to analysis-only — deleted `import-formatter.ts`/`object-formatter.ts` (+ tests) and `DeterministicFormatResult` from `@codexa/core`; kept analyzer, semantic-risk, comment-boundaries, block-comment utils.
- [x] **A3** Rewrote `semantic-format.ts` `buildSemanticSystemPrompt` to delegate to the new house-style prompt builder.
- [x] **B1** Authored `packages/provider/src/style-pack.ts` (hard constraints, block-comment templates, section vocabulary, per-category rules) + `scripts/build-style-examples.mjs` which generates `style-examples.generated.ts` from `docs/examples/*.md` (51 example pairs; docs stay the single source of truth). Wired into `npm run build:examples`/`build`.
- [x] **B2** Prompt assembly selects file-relevant few-shot examples via `detectCategories` (function/import/hook/view) with a per-category cap.
- [x] **B3** `packages/provider/src/style-conformance.test.ts` — deterministic checks (parsing, category detection, prompt assembly, bounded selection) always run; live model conformance over all 51 goldens runs when `CODEXA_LIVE_GOLDENS=1` + `ANTHROPIC_API_KEY` are set.
- [x] **B4** Ran the goldens live against `claude-opus-4-8` (clean, rate-limit-aware harness `scripts/run-goldens.mjs`). Result: **25/51 exact match — imports 8/8, functions 7/14, hooks 6/15, views 4/14.** Tuned the prompt for the genuine defects found (try/catch comment placement, `.map`→"Process items", JSX→"Render content", nested-object/leading-space bars). Full analysis in [CONFORMANCE.md](CONFORMANCE.md): the ~50% ceiling is set by **subjective title wording (varies run-to-run) and self-contradictions in the example docs** (comment-bar indentation, prop-ordering, a type-adding example), not by mis-formatting. Imports — the well-specified category — are 100%.
- [x] **F1** Kept the dropped-symbol guard (provider) **and** added a token-signature behavior check `compareTypeScriptStructure` (`language-typescript/behavior-check.ts`): rejects identifier/literal changes while tolerating reordering + arrow→block expansion. Wired as an injectable `verifyBehavior` on the orchestrator; a diverging preview is discarded with a warning.
- [x] **F2** Verified: discovery ignore-file exclusion intact (untouched, tests green); the only network egress in the engine is `@codexa/provider`. **Secret-file redaction + server-side key vaulting move to the M2 intake/server layer** (the old extension `secrets.ts` was deleted with the extension).

**M1 status:** all packages typecheck; full test suite 65 passing / 1 skipped (the live golden). Also pulled forward from M5: deleted `apps/extension`, the deterministic CLI preview commands, and the VSIX scripts to keep the build green.

### M2 — Backend service (NestJS)  `[x]` (vertical slice complete)
- [x] New `apps/server` NestJS app (ESM + decorators) wrapping the `@codexa/*` engine — boots, all routes mapped, DI verified at runtime.
- [x] `providers` module: `ProviderFactory` builds a `FormatProvider` from per-run config (reference/anthropic/openai/openai-compatible/ollama); `GET /providers`, `POST /providers/test`.
- [x] `intake` module: paste-snippet + zip upload → plan modules (language detection, vendored/built/`.d.ts` exclusion, one module per directory). GitHub/GitLab deferred to M4.
- [x] `runs` module: in-memory `RunStore` + **in-process `JobRunner`** (swappable seam — same contract a BullMQ/Redis adapter will implement). Engine run wires `verifyBehavior = compareTypeScriptStructure` (F1 now live in the composition root). Pause/resume/cancel via the orchestrator pause-gate + `AbortSignal`.
- [x] SSE endpoint `GET /runs/:id/events` maps run lifecycle (`run.created`→`run.started`→`unit.completed`*→`run.completed`/`cancelled`/`failed`) via a per-run `ReplaySubject`.
- [x] End-to-end verified: 4 server tests (create / run-to-completion / SSE lifecycle / provider validation) + live HTTP smoke (`POST /runs` → `GET /runs/:id` completes). Full monorepo suite: 69 passing / 1 skipped.

**Deferred to later milestones (documented, not built):** BullMQ/Redis durable queue (production `JobRunner` adapter), Postgres/Prisma persistence, temp-workspace-on-disk for large zips (currently in-memory via adm-zip), accounts/auth — these are M4 + production hardening. `POST /runs/upload` exists and works for zip intake.

### M3 — Frontend (Next.js)  `[x]` (core flow complete)
- [x] `apps/web` Next.js 15 App Router app — builds clean (4 routes), serves at runtime.
- [x] Tailwind theme driven by the design's dark token set (CSS variables, structured so light/high-contrast drop in later), JetBrains Mono via `next/font`, `Icon` component, Framer Motion keyframes (spin/shimmer/fade).
- [x] Design system: Button, Badge (+ status-tone mappers), Card/SectionLabel, ProgressBar (determinate + indeterminate shimmer), StatCard, CodeBlock (line numbers + copy), Toast (AnimatePresence), AppHeader.
- [x] Lib: typed API client (`/providers`, `/providers/test`, `/runs`, `/runs/upload`, `/runs/:id`, control actions), TanStack Query provider, **SSE hook** (`useRunEvents` reduces `run.*`/`unit.completed` into live state), Zustand UI store (provider config + toasts).
- [x] Screens: **Intake** (paste snippet / upload zip + provider summary) → **Progress** (live SSE: %, streaming per-file rows, pause/resume/cancel) → **Review** (stat cards, per-file expandable previews + warnings), plus **Provider Settings** (catalogue, model/key/baseURL, test connection, save).

**Adapted from the VS Code prototype:** the web flow is **Intake → Progress → Review** (matching what the M2 backend supports) rather than the extension's Scan → Select-tree → Confirm. **Deferred:** module-selection TreeView + Confirm gate (need backend discovery/selection), light/high-contrast themes, and the No-backend/Offline/Cancelled-recovery edge screens.

- [x] **Real diff in Review** (was deferred): added `originalSource` to the engine `UnitResult` (set in `unit.ts` + all run.ts result builders), threaded through the server, and built a LCS line-diff (`lib/diff.ts`) + `CodeDiff` component. Review now shows a unified +/- diff for changed files with a Diff/Output toggle. Backend tests green; web builds clean.

### M4 — Accounts, repo intake, persistence  `[x]` (backend complete)
- [x] **Persistence layer** behind repository interfaces (`USER/CONNECTION/PROFILE/RUN_REPOSITORY`) with in-memory implementations wired by a `@Global` `PersistenceModule` — zero infra, fully testable. Swap the token bindings for Prisma to enable Postgres.
- [x] **Auth**: register/login with scrypt password hashing + HMAC session tokens (`node:crypto`, zero-dep). Global `AuthContextGuard` resolves the bearer token to a userId (optional — falls back to `anonymous`, so existing flows keep working); `@CurrentUser()` decorator. `POST /auth/register|login`, `GET /auth/me`.
- [x] **Runs persisted + user-scoped**: `RunsService` now writes through to `RUN_REPOSITORY` (hot-state map for in-flight + persist on every change); `GET /runs` returns the user's history (summaries), `GET /runs/:id` enforces ownership. Live SSE + pause/cancel preserved.
- [x] **Saved profiles**: `POST/GET/DELETE /profiles` — per-user guidance presets.
- [x] **Repo intake**: `IntakeService.fromDirectory` (recursive walk, skips node_modules/dist/.d.ts) + `fromRepo` (shallow `git clone` to a temp dir, cleaned up after). `POST /runs/repo` clones and formats; resolves a clone token from the body or a stored connection.
- [x] **Connections**: `POST/GET /connections` stores a per-provider personal access token (redacted in responses) to power private-repo cloning.
- [x] **Prisma/Postgres schema** authored at `apps/server/prisma/schema.prisma` (User, Connection, Profile, Run, RunFile; results normalized to RunFile) + README enablement steps.
- [x] **Tests**: 10 server tests (auth tokens/passwords/register-login, snippet run + persistence, user-scoped history, ownership enforcement, SSE lifecycle, snippet + directory intake). Full suite 75 passing / 1 skipped. Runtime-smoked end-to-end (register → scoped history → profiles → connections).

- [x] **Frontend accounts wiring**: bearer-token plumbing (`lib/auth-token` + auth header on every API call), Zustand `auth-store` (bootstrap/login/register/logout), `/login` page (login+register toggle), header auth state (Sign in / Sign out + History link), `/history` page wired to `GET /runs` (auth-gated), and a **Repo** intake mode (URL + optional token → `POST /runs/repo`). Clean `next build` passes — 7 routes type-check and compile.

**Deferred:** full GitHub/GitLab **OAuth redirect** login (token-based connect covers private cloning today); the live **Prisma adapter** classes + migration (schema + swap documented; in-memory is the default).

### M5 — Cleanup & docs  `[ ]`
- [ ] Delete `apps/extension`, webview, VSIX scripts; slim root build/workspaces.
- [ ] Keep `apps/cli` as headless engine test harness.
- [ ] Refresh `README.md` + `docs/` to the new architecture.
- [ ] Then: frontend-code formatting support.

---

### Design-fidelity pass — closing the gaps vs the Downloads design  `[x]`
After a design-vs-build comparison (the build was ~45–55% of the 9-screen prototype), closed all four identified gaps:
- [x] **Light + high-contrast themes** — exact token sets extracted from the design + a header theme switcher (no-flash init script, persisted). `globals.css` now has all three palettes.
- [x] **Richer Progress** — `PhaseStepper` (Queued → Formatting → Review) + a metrics grid (Files, Elapsed live clock, Tokens aggregated from per-unit usage, Model).
- [x] **Edge states + Review actions** — reusable `Callout` + `EmptyState`; Provider Settings is now a split-pane with a provider list (status dots, Local/Remote), connection-disclosure callout, and offline troubleshooting; Review gained a Tokens stat, cancelled-recovery callout, and Export-report download.
- [x] **Select & Configure** — backend preview flow (`POST /intake/preview/upload|repo` → stored plan + per-file token estimates; `POST /runs/from-preview` runs only selected files) + a split-pane screen with a module TreeView, **tri-state checkboxes**, select-all/clear, and a live estimate panel. Zip/repo intake now routes Intake → Select → Progress → Review; single snippets still run directly. Verified live (selecting 1 of 2 files → run with totalUnits 1).

Result: the build now covers the design's full flow (intake/select/progress/review), all three themes, and the core design-system primitives (TreeView, tri-state Checkbox, PhaseStepper, Callout, EmptyState, provider-list). Server suite 10/10; web builds clean (8 routes).

## Change log
- _M1 started._
- _M1 near-complete:_ deterministic pass removed engine-wide; AI-only formatting driven by a docs-derived style pack with file-relevant few-shot; golden conformance harness added; behavior-preservation safety net added; VS Code extension + deterministic CLI removed. Only B4 (live golden tuning) remains, blocked on an API key.
- _M2 vertical slice complete:_ NestJS `apps/server` wraps the engine — providers/intake/runs modules, in-process job runner, SSE streaming, behavior verification wired in. Snippet + zip intake working; run lifecycle streamed and tested end-to-end. BullMQ/Redis + Postgres + accounts deferred to M4/hardening.
- _M3 core flow complete:_ Next.js `apps/web` (TanStack Query + Tailwind + Framer Motion + Zustand) built to the design's dark theme. Intake → Progress (live SSE) → Review flow wired to the M2 API; provider settings with connection test. Builds clean and serves all routes. Module-selection tree, extra themes, and edge screens deferred. (Real diff added afterward.)
- _M4 backend complete:_ repository-based persistence (in-memory default; Prisma/Postgres schema + swap documented), accounts (register/login, scrypt + HMAC tokens, optional-resolve guard), user-scoped run history, saved profiles, git-clone repo intake + token connections. 10 new server tests; full suite 75 pass / 1 skip; runtime-smoked.
- _M4 frontend wiring complete:_ web app now has login/register, token persistence + auth header, sign-in/out header state, an auth-gated run-history page, and a Repo intake mode (clone-by-URL). Clean `next build` passes (7 routes). Deferred: OAuth redirect, live Prisma adapter.
