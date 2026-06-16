# Codexa Project Phases

## Status Legend

- `[ ]` Not started.
- `[~]` In progress.
- `[x]` Completed.
- `[!]` Blocked or requires a decision.

## Reference Sources

Production code must follow these references:

- PulseHQ `docs/styling/examples/imports.md`.
- PulseHQ `docs/styling/examples/functions.md`.
- PulseHQ `docs/styling/examples/hooks.md` when React hooks are introduced.
- PulseHQ `docs/styling/examples/views.md` when the webview is introduced.
- Manually approved patterns from the PulseHQ widget module.

Unformatted PulseHQ modules must not be treated as examples.

The private Ayodeji profile and its source fixtures must not be included in the public Codexa extension.

## Claude Design Handoff

The design reference is currently located at:

```text
/Users/spinkodes/Downloads/codexa/project/Codexa.dc.html
```

The handoff defines these production states:

- Backend scan.
- Module selection and configuration.
- Source-transmission confirmation.
- Formatting and validation progress.
- Review summary.
- Partial failure.
- Cancelled run with recoverable previews.
- Provider settings.
- No backend found.
- Provider offline.

The HTML and generated `support.js` are prototype references only. Production code must recreate the design using Codexa's application architecture and VS Code APIs.

## Phase 0: Product Foundation

Status: `[x]`

- [x] Create isolated `codexa/` npm project.
- [x] Create Codexa-local package manifest and lockfile.
- [x] Create internal npm workspace boundaries.
- [x] Capture the product and architecture plan.
- [x] Capture the Claude Design handoff requirements.
- [x] Define shared core domain contracts.
- [x] Define and version the style-profile schema.
- [x] Create a neutral public starter profile.
- [x] Create a headless profile-validation command.
- [ ] Add sanitized private fixtures outside the public distribution path.
- [x] Document behavior-preservation guarantees.

Exit condition:

> Profiles and fixtures can be validated without VS Code.

## Phase 1: TypeScript and JavaScript Discovery

Status: `[x]`

- [x] Detect backend roots from manifests and configuration.
- [x] Respect Git ignore rules and `.codexaignore`.
- [x] Parse TypeScript and JavaScript.
- [x] Detect NestJS modules.
- [x] Detect generic Node.js modules.
- [x] Calculate module confidence scores.
- [x] Expose discovered modules through the CLI.
- [x] Add incremental scan caching.

Exit condition:

> Fixture repositories are grouped into accurate, selectable modules.

## Phase 2: Deterministic Formatter

Status: `[x]`

- [x] Implement npm and custom import grouping.
- [x] Implement full-import-line length ordering.
- [x] Implement named-import ordering.
- [x] Implement block-comment templates.
- [x] Implement blank-line boundary detection.
- [x] Implement DTO and entity property comments.
- [x] Implement safe object-property ordering.
- [x] Protect side-effect and order-sensitive imports.
- [x] Add import idempotency and golden-output tests.

Exit condition:

> Deterministic formatting is stable, behavior-preserving, and idempotent.

## Phase 3: AI Provider Layer

Status: `[x]`

- [x] Define provider capabilities and request contracts.
- [x] Implement OpenAI.
- [x] Implement Anthropic.
- [x] Implement OpenAI-compatible endpoints.
- [x] Implement Ollama or equivalent local provider.
- [x] Add structured semantic-patch responses.
- [x] Add provider connection testing.
- [x] Add usage and cost estimation.
- [x] Add secure VS Code SecretStorage integration.

The contract foundation lives in the isolated `@codexa/provider` package: provider capabilities, the semantic-formatting request/response contracts, a Zod-validated structured semantic-patch schema with a bounded apply helper, model pricing and cost estimation, a connection-testing contract, and a reusable `runProviderContract` suite.

Four providers pass that one suite: a deterministic offline reference provider, the Anthropic provider (official SDK behind an injectable client), and the OpenAI-compatible provider, which serves OpenAI, any OpenAI-compatible endpoint, and local Ollama through one `fetch`-based chat-completions transport. Shared response handling — system prompt, structured-output parsing, symbol-preservation guard, and whole-file patch mapping — lives in a single `semantic-format` module. Every network transport is injected so the contract suite runs offline.

Secure SecretStorage integration landed with the Phase 5 extension: provider API keys are read from and written to VS Code SecretStorage through the host facade, never stored in plaintext.

Exit condition:

> Every provider passes the same semantic-formatting contract suite.

## Phase 4: Safe Formatting Orchestrator

Status: `[x]`

- [x] Build semantic formatting units.
- [x] Build dependency-aware job plans.
- [x] Add bounded parallel execution.
- [x] Give each worker exclusive file ownership.
- [x] Add cancellation and pause support.
- [x] Add retry policies.
- [x] Add response caching.
- [x] Add stale-file protection.
- [x] Add recoverable run snapshots.

The orchestration lives in the isolated `@codexa/orchestrator` package. A formatting unit runs the deterministic passes and then the injected provider's semantic pass, returning a bounded whole-file preview. The job plan assigns every file path to exactly one unit, so no two workers ever own the same file. The run engine executes units with bounded concurrency, an abort signal, a pause gate, per-unit retries, a shared response cache with in-flight de-duplication, content-hash stale-file protection, and a recoverable snapshot that lets a cancelled run resume without reformatting completed files. Both the deterministic formatter and the provider are injected, so the engine is exercised entirely offline.

Exit condition:

> Multiple modules can be preview-formatted safely without overlapping writes.

## Phase 5: VS Code Extension MVP

Status: `[x]`

- [x] Register Codexa commands.
- [x] Enforce Workspace Trust.
- [x] Select backend roots.
- [x] Select modules.
- [x] Select providers and profiles.
- [x] Show native progress and cancellation.
- [x] Open native VS Code diffs.
- [x] Apply approved WorkspaceEdits.

The extension lives in `apps/extension`. The MVP follows the host-injection pattern used across the project: all decision logic is in a pure `runFormatWorkflow(host, engine)` that is unit-tested with a fake host, while a thin `vscode-host` adapter and `extension` activation bind the real VS Code API to that facade. The workflow enforces Workspace Trust, scans for backends, selects a root, modules, provider, and profile, resolves the provider API key from SecretStorage, formats under native progress with cancellation, opens a native diff per changed file, and applies approved changes through a single `WorkspaceEdit`. The headless engine composes discovery, the deterministic passes, the chosen provider, and the orchestrator. The `vscode`-importing adapter and activation are typed against `@types/vscode` and exercised inside the editor; everything else runs offline under `node --test`.

Exit condition:

> A developer can complete the full workflow using native VS Code controls.

## Phase 6: Custom Webview

Status: `[~]`

- [x] Implement the Claude Design visual system.
- [x] Implement responsive editor-tab and side-panel layouts.
- [x] Implement module search, filtering, and hierarchy.
- [x] Implement provider configuration.
- [x] Implement source-transmission confirmation.
- [x] Implement truthful weighted progress.
- [x] Implement review, recovery, and edge states.
- [x] Map all colors to VS Code theme variables.
- [x] Verify keyboard, screen-reader, and high-contrast behavior.

The progress view now consumes structured engine snapshots instead of counting generic reporter messages. Weighted phases preserve a planning and finalization margin around actual per-file completion, cancelled runs retain their last truthful percentage, and the webview shows completed files and modules, active and queued work, provider-reported token usage, accumulated estimated cost, and per-module progress.

Interrupted and partial-failure runs now retain their recoverable orchestrator snapshot in the extension host. The review state can retry only failed, stale, or cancelled files while preserving validated previews, and every resumed plan rebuilds source hashes before enabling live stale-file protection.

The review state now derives passed, attention, and incomplete validation summaries from terminal file results. It shows validated, warning, failed, stale, and cancelled counts, identifies warning-bearing files, and exports a source-free JSON run report through VS Code's native save dialog.

The module tree now uses one roving tab stop with Arrow, Home, End, Enter, and Space controls. Screen changes focus their primary heading once, background progress uses concise atomic announcements without replacing the whole application live region, and forced-colors mode maps selection, focus, progress, warning, and border states to system colors.

Exit condition:

> The production webview faithfully implements every approved design state.

## Phase 7: Validation and Marketplace Readiness

Status: `[x]`

- [x] Integrate project type-check commands.
- [x] Integrate lint commands.
- [x] Integrate relevant tests.
- [x] Add semantic-diff risk checks.
- [x] Add privacy disclosures.
- [x] Add opt-in telemetry decision.
- [x] Package and test the VSIX.
- [x] Prepare Marketplace documentation.

Project validation discovers the nearest owning package and runs its declared type-check, lint, and test scripts sequentially against an isolated copy containing Codexa's previews. It stops on the first failure, blocks apply when checks fail or are unavailable, and removes the temporary validation workspace after each run. Both the custom webview and native workflow enforce the same validation requirement, while exported reports retain command metadata without compiler output or source excerpts.

Semantic-diff validation compares parser metadata and significant source tokens before project commands run. Comment and whitespace changes are low risk, token-only reordering is retained for explicit diff review, and changed syntax, imports, exports, declarations, or token inventory blocks validation and apply. The custom webview shows aggregate and per-file risk metadata without exposing source content, and the native workflow enforces the same blocking decision.

Privacy disclosures now document workspace access, exact local and remote provider payloads, credential storage, temporary validation copies, and source-free report boundaries. The webview exposes the same disclosures through a dedicated responsive privacy view and repeats the relevant payload details before every formatting run.

Codexa does not collect or transmit product telemetry. No telemetry setting is exposed because no telemetry implementation exists; any future proposal must be opt-in, disabled by default, documented before release, and reviewed as a new product decision.

The extension package now bundles the extension host and browser client into standalone runtime artifacts, excluding workspace links, source files, tests, declarations, build metadata, and `node_modules` from the VSIX. A deterministic verifier checks the archive boundary and manifest entry point, and the packaged extension has been installed and enumerated through the VS Code CLI using isolated user-data and extension directories.

Marketplace documentation is complete. The extension `README.md` is a self-contained Marketplace listing covering features, requirements, supported providers, getting started, commands, privacy, behavior preservation, and known limitations, with no cross-directory or repository-dependent links. A `CHANGELOG.md` documents the `0.1.0` release, an Apache-2.0 `LICENSE` accompanies the package, and the manifest carries the `Apache-2.0` license, formatter category, discovery keywords, gallery banner, and disabled Q&A. The packaged VSIX now bundles `readme.md`, `changelog.md`, and `LICENSE.txt` alongside the runtime artifacts.

Exit condition:

> Codexa is safe to test in unrelated public backend repositories.

## Phase 8: Additional Languages

Status: `[ ]`

- [ ] Define the next language adapter.
- [ ] Add its parser.
- [ ] Add deterministic rules.
- [ ] Add validation integration.
- [ ] Add fixtures and golden tests.
- [ ] Add framework detectors.

Exit condition:

> A language is advertised only after its complete adapter suite passes.

## Current Slice

Begin Phase 8 additional languages:

1. Define the next language adapter.

## Verification History

### 2026-06-14 - Phase 0 Profile Foundation

- `npm run typecheck` passed.
- `npm run build` passed.
- `npm test` passed with three tests.
- `npm run validate:starter` validated the neutral starter profile.
- Dependencies were installed only in `codexa/node_modules`.

### 2026-06-14 - Phase 1 Discovery Foundation

- Added the isolated `@codexa/discovery` package.
- Added manifest and Nest monorepo source-root detection.
- Added nearest-manifest source ownership for nested packages.
- Added root and directory-scoped `.gitignore` and `.codexaignore` handling.
- Added default dependency, output, fixture, and generated-directory traversal exclusions.
- Added NestJS and generic Node module grouping.
- Added stable root and module identifiers.
- Added source-content hashes and generated-file indicators.
- Added human-readable and JSON CLI discovery output.
- `npm run check` passed with six tests.
- A PulseHQ smoke scan detected only `apps/api/src` with 22 NestJS modules.

### 2026-06-14 - Phase 1 Source Analysis and Cache

- Added the isolated `@codexa/language-typescript` package.
- Added TypeScript and JavaScript parser diagnostics.
- Added top-level import, export, and symbol metadata.
- Added Git dirty-file detection with non-Git fallback behavior.
- Added content-hash source-analysis caching.
- Added targeted cache invalidation for changed files.
- Added stale cache-entry pruning.
- Added CLI cache statistics and `--no-cache` / `--no-git` options.
- Added malformed-source, Git-state, cache-hit, and cache-invalidation tests.
- `npm test` passed with ten tests.

### 2026-06-14 - Phase 6 Truthful Weighted Progress

- Added structured planning, formatting, finalizing, complete, and cancelled progress phases.
- Added actual file and module completion, active-worker, queued-file, token-usage, and estimated-cost metrics.
- Added per-module progress bars and polite screen-reader progress announcements.
- Preserved the last real completion percentage when cancellation interrupts a run.
- `npm run build --workspace @codexa/extension` passed.
- `npm run test --workspace @codexa/extension` passed with 15 tests.
- `npm run check` passed across all Codexa workspaces.

### 2026-06-14 - Phase 6 Run Recovery

- Retained recoverable orchestrator snapshots inside the privileged extension host.
- Added partial-failure retry and cancelled-run recovery actions to the review state.
- Resumed only failed, stale, or cancelled files while preserving validated previews.
- Seeded resumed progress, token usage, cost, and module completion from recovered results.
- Rebuilt fresh source hashes and enabled live stale-file checks for every run.
- `npm run build --workspace @codexa/extension` passed.
- `npm run test --workspace @codexa/extension` passed with 16 tests.
- `npm run check` passed across all Codexa workspaces.

### 2026-06-14 - Phase 6 Validation Summary and Run Report

- Added passed, attention, and incomplete validation outcomes derived from terminal file results.
- Added validated, changed, unchanged, warning, failed, stale, cancelled, and recovery counts.
- Added warning indicators to affected file rows.
- Added source-free JSON run-report generation with configuration, validation, status, path, and warning metadata.
- Added native VS Code save-dialog export without including source previews or provider secrets.
- `npm run build --workspace @codexa/extension` passed.
- `npm run test --workspace @codexa/extension` passed with 18 tests.
- `npm run check` passed across all Codexa workspaces.

### 2026-06-14 - Phase 6 Accessibility Completion

- Added roving module-tree focus with Arrow Up, Arrow Down, Arrow Left, Arrow Right, Home, and End navigation.
- Added Enter expansion and Space selection behavior with concise selection announcements.
- Replaced whole-application live updates with a dedicated atomic status announcer.
- Added one-time heading focus when screens change without stealing focus during background progress.
- Added semantic labels for module metadata, validation status, result lists, and provider selection.
- Added forced-colors system styling for focus, selection, progress, warnings, and borders.
- `npm run build --workspace @codexa/extension` passed.
- `npm run test --workspace @codexa/extension` passed with 19 tests.
- `npm run check` passed across all Codexa workspaces.

### 2026-06-14 - Phase 2 Import Formatting Foundation

- Added bounded deterministic source-edit contracts.
- Added profile-driven built-in, external, custom, and side-effect import classification.
- Added configurable import sections and project-local module prefixes.
- Added full-line-length, alphabetical, and preserve-order strategies.
- Added named-import ordering while preserving aliases and type-only imports.
- Added syntax validation before returning formatted previews.
- Added explicit protection for side-effect imports and imports separated by executable statements.
- Added golden-output, idempotency, license-comment preservation, and safety tests.
- Added preview-only `format-imports` CLI command that never writes source files.
- `npm run check` passed with fifteen tests.

### 2026-06-14 - Phase 2 Block Comments and Object Ordering

- Added the shared `block-comment` template contract used to render and detect the canonical Codexa heading.
- Refactored the import formatter to render headings through the shared block-comment module.
- Added `formatObjectProperties` deterministic object-property ordering by full-line length, shortest to longest, with alphabetical tiebreak.
- Added recursive ordering of nested object literals while preserving each property's exact source text.
- Protected spreads, accessors, methods, computed keys, duplicate keys, comment-bearing objects, and single-line objects from reordering.
- Restricted safe-mode ordering to objects whose property values are proven side-effect free.
- Added syntax revalidation that discards any preview failing to parse.
- Added preview-only `format-objects` CLI command that never writes source files.
- Corrected a stale import golden test whose expected output carried spurious heredoc indentation.
- `npm run check` passed with twenty-four tests.

### 2026-06-14 - Phase 3 Provider Contract Foundation

- Added the isolated `@codexa/provider` package depending only on the core contracts and Zod.
- Added provider capability, request, response, usage, cost, and connection-test contracts.
- Added a Zod-validated structured semantic-patch schema with parse and safe-parse entry points.
- Added a bounded semantic-patch apply helper that rejects overlapping and out-of-range edits.
- Added published model pricing and deterministic cost estimation with a zero-cost fallback.
- Added the offline deterministic reference provider as the contract conformance baseline.
- Added the reusable `runProviderContract` suite covering capabilities, connection testing, cost consistency, schema-valid patches, preview-edit agreement, and idempotency.
- Grounded the contract design in the live Claude API reference: structured outputs, adaptive thinking, and Opus 4.8 pricing.
- Wired the package into the root build, typecheck, clean, and test scripts.
- `npm run check` passed with twenty-nine tests.

### 2026-06-14 - Phase 3 Anthropic Provider

- Added an SDK-free Anthropic provider that satisfies the shared semantic-formatting contract.
- Built adaptive-thinking structured-output requests with the house-style block-comment system prompt.
- Constrained the model response with a JSON-schema structured output and validated it with Zod.
- Mapped a changed response into a bounded whole-file semantic patch and reported token usage.
- Added a symbol-preservation guard that discards any patch dropping a required exported symbol.
- Discarded refusals and truncated responses without changing the source.
- Added a thin official `@anthropic-ai/sdk` adapter behind an injectable messages client so the contract suite stays offline.
- Added an API-key convenience factory that builds the provider over a live SDK client.
- Added contract, change-mapping, symbol-guard, refusal, and request-shape tests using an injected fake client.
- `npm run check` passed with thirty-four tests.

### 2026-06-14 - Phase 3 OpenAI-Compatible Provider

- Extracted shared semantic formatting into a `semantic-format` module: system prompt, structured-output schema, output parsing, symbol-preservation guard, and whole-file patch mapping.
- Refactored the Anthropic provider onto the shared helpers without behavior changes.
- Added an SDK-free OpenAI-compatible provider that satisfies the shared contract for the OpenAI, OpenAI-compatible, and Ollama variants.
- Built chat-completions requests with JSON-schema structured output and a JSON-object fallback for endpoints without schema support.
- Discarded truncated and invalid responses without changing the source.
- Added a `fetch`-based chat-completions transport with bearer authentication and base-URL configuration.
- Added OpenAI, OpenAI-compatible, and Ollama factory functions over the shared transport.
- Added contract, change-mapping, symbol-guard, truncation, and request-shape tests using an injected fake transport.
- `npm run check` passed with forty tests.

### 2026-06-14 - Phase 4 Safe Formatting Orchestrator

- Added the isolated `@codexa/orchestrator` package depending only on the core and provider contracts.
- Added formatting units that run the deterministic passes then the injected provider semantic pass into a bounded whole-file preview.
- Added job-plan construction that gives every file path exclusive ownership and reports dropped duplicates.
- Added bounded parallel execution with a configurable worker count.
- Added abort-signal cancellation and a pause gate checked between units.
- Added per-unit retry policies that preserve the source on exhaustion.
- Added a shared response cache with content-addressed keys and in-flight request de-duplication.
- Added content-hash stale-file protection that skips files changed after the plan was built.
- Added recoverable run snapshots that resume completed units without reformatting them.
- Added plan, parallel-format, caching, stale, cancellation, retry, and snapshot-resume tests using injected fakes.
- `npm run check` passed with forty-seven tests.

### 2026-06-14 - Phase 2 Comment Boundary Detection

- Added a deterministic comment-boundary detector to `@codexa/language-typescript`.
- Detected function declarations, class methods, and function-valued variable declarations as function candidates.
- Detected class properties and interface members as DTO and entity property candidates.
- Detected blank-line section boundaries inside function bodies without double-counting nested declarations.
- Flagged whether any comment or a Codexa block comment already precedes each candidate so meaningful comments are preserved.
- Reported candidate offset, line, and indentation for downstream heading insertion.
- Added detection tests for properties, functions, sections, and comment preservation.
- Fixed a pause-gate regression that cleared waiting workers before releasing them, and added a pause-and-resume test.
- Completed Phase 2; comment-title generation remains the Phase 3 provider responsibility.
- `npm run check` passed with fifty-three tests.

### 2026-06-14 - Phase 5 VS Code Extension MVP

- Added the `apps/extension` package with the `codexa.formatModules` command and Workspace Trust disabled for untrusted folders.
- Added a host facade so all workflow logic stays pure and unit-testable without the VS Code runtime.
- Added `runFormatWorkflow` covering trust, backend selection, module selection, provider and profile selection, formatting, diff review, and apply.
- Added SecretStorage-backed provider API-key resolution with a prompt-and-store fallback, satisfying the deferred Phase 3 item.
- Added a headless engine composing discovery, the deterministic passes, the selected provider, and the orchestrator into formatted-file previews.
- Added an orchestrator `onResult` callback so the run reports truthful per-file progress.
- Added the real `vscode` host adapter for quick picks, native progress with cancellation, virtual-document diffs, and a single bounded workspace edit, plus the activation entry point.
- Bundled a validated starter profile and wired Anthropic, OpenAI, Ollama, and reference providers.
- Added workflow and secret tests with fake hosts and engines; the `vscode`-importing adapter is typed against `@types/vscode` and runs only inside the editor.
- `npm run check` passed with sixty-four tests.

### 2026-06-14 - Phase 6 Custom Webview Foundation

- Recreated the approved Claude Design visual language as a production VS Code webview rather than embedding the prototype.
- Added a strict content-security policy with nonce-protected local scripts and no remote assets.
- Added a source-free typed message boundary between the browser surface and privileged extension host.
- Added backend scanning, searchable module hierarchy, framework/language/warning/changed filters, bulk selection, and root switching.
- Added real source-derived file and token estimates, provider/model/profile selection, and configurable parallel workers.
- Added local-versus-remote source-transmission confirmation before formatting begins.
- Added truthful completed-file progress and cancellation over the existing orchestrator abort signal.
- Added source-free review summaries while retaining full previews only in the extension host for native VS Code diffs.
- Added apply-all, review-all, single-file review, discard, no-backend, and recoverable error states.
- Mapped the complete visual system to VS Code theme variables with narrow-layout, forced-color, reduced-motion, and focus-visible rules.
- Kept the Phase 5 native-controls workflow available as `Codexa: Format Backend Modules (Native Controls)`.
- `npm run check` passed with sixty-six tests.

### 2026-06-14 - Phase 6 Provider Management

- Added explicit browser, Node.js, and VS Code type contexts to prevent editor language-service diagnostics in the webview client and controller.
- Replaced malformed JSX-style markers inside HTML templates with valid HTML comments.
- Added provider settings for the curated Anthropic, OpenAI, Ollama, and reference providers.
- Added masked API-key replacement, secure save, and removal through VS Code SecretStorage.
- Added provider model selection and minimal connection testing through the shared provider contract.
- Kept connection tests source-free: no repository file or excerpt is sent.
- Added configured/not-configured status without exposing stored credentials to the webview.
- Added responsive provider-management layouts using VS Code theme variables.
- Added provider test delegation coverage with selected API key and model.
- `npm run check` passed with sixty-seven tests.

### 2026-06-14 - Phase 7 Project Command Validation

- Added nearest-package discovery for declared type-check, lint, and test scripts.
- Added isolated validation workspaces that overlay Codexa previews without modifying source files.
- Ran project checks sequentially and stopped after the first failure.
- Blocked apply when validation fails, remains unavailable, or has not run.
- Enforced the same validation requirement in the custom webview and native workflow.
- Added project-check status, command results, durations, and bounded failure output to the review interface.
- Kept exported reports source-free by excluding project-check output.
- Added script discovery, preview isolation, failure handling, workflow blocking, and report privacy tests.
- `npm run check` passed across all Codexa workspaces with 23 extension tests.

### 2026-06-14 - Phase 7 Semantic-Diff Risk Checks

- Added a shared TypeScript and JavaScript semantic-risk analyzer.
- Classified comment and whitespace changes as low risk.
- Classified token-only reordering as review-level risk.
- Blocked changed syntax, imports, exports, declarations, and token inventory.
- Added aggregate and per-file risk metadata to the custom review interface.
- Prevented high-risk previews from reaching project commands or apply in both workflows.
- Added source-free semantic-risk metadata to exported run reports.
- Added analyzer, aggregation, workflow-blocking, report, and responsive-interface tests.
- `npm run check` passed across all Codexa workspaces with 23 language tests and 26 extension tests.

### 2026-06-14 - Phase 7 Privacy and Telemetry

- Added a dedicated responsive privacy view using the established webview formatting and interaction patterns.
- Disclosed exact remote-provider payloads: selected file paths, deterministically formatted contents, language metadata, exported symbols, and style guidance.
- Documented local-provider behavior, SecretStorage credential handling, temporary validation copies, and source-free report boundaries.
- Corrected the source-transmission confirmation to describe complete selected file contents rather than excerpts.
- Added a visible no-telemetry statement to provider settings and run confirmation.
- Recorded the decision that Codexa collects no telemetry and that any future telemetry must be opt-in and disabled by default.
- Added `docs/PRIVACY.md` and privacy-boundary, telemetry, responsive-interface, and accessibility tests.
- `npm run check` passed across all Codexa workspaces with 28 extension tests.

### 2026-06-14 - Phase 7 VSIX Packaging

- Added `esbuild` bundles for the CommonJS extension host and ESM webview client.
- Externalized the VS Code runtime API while bundling workspace packages and production dependencies.
- Added a release manifest with the `codexa.codexa` extension identifier.
- Added a `.vscodeignore` boundary that excludes source, tests, declarations, build metadata, and `node_modules`.
- Added reproducible root commands to prepare, package, and verify the VSIX.
- Added archive verification for required runtime files and forbidden development files.
- Packaged `artifacts/codexa-0.1.0.vsix` with six archive entries at 1,858,618 bytes.
- Installed the VSIX into isolated VS Code user-data and extension directories.
- Confirmed VS Code enumerated the installed extension as `codexa.codexa@0.1.0`.
- `npm run check` passed across all Codexa workspaces with 28 extension tests.
- `npm run verify:vsix` passed.

### 2026-06-14 - Phase 7 Marketplace Documentation

- Rewrote the extension `README.md` as a self-contained Marketplace listing with features, requirements, supported providers, getting started, commands, privacy, behavior preservation, and known limitations.
- Removed cross-directory and repository-dependent links so `vsce` packages the README without a repository URL.
- Added `CHANGELOG.md` documenting the `0.1.0` release in Keep a Changelog format.
- Added an Apache-2.0 `LICENSE` and set the manifest `license` to `Apache-2.0`.
- Added formatter-oriented keywords, a gallery banner, and disabled Marketplace Q&A in the manifest.
- Completed Phase 7; the packaged VSIX bundles `readme.md`, `changelog.md`, and `LICENSE.txt` alongside the runtime artifacts.
- `npm run check` passed across all Codexa workspaces with 28 extension tests.
- `npm run package:vsix` produced `artifacts/codexa-0.1.0.vsix` with eight archive entries at 1,864,032 bytes.
- `npm run verify:vsix` passed.
