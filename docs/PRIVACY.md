# Codexa Privacy

## Product Position

Codexa does not collect or transmit product telemetry.

Codexa does not operate an analytics endpoint and does not send usage events, crash reports, repository metadata, source code, prompts, provider responses, or validation results to Codexa.

There is no telemetry setting because no telemetry is implemented. Any future telemetry proposal must be opt-in, documented before release, disabled by default, and reviewed as a new product decision.

## Workspace Access

Codexa requires a trusted VS Code workspace.

It reads selected backend source files and the project metadata needed to:

- Discover backend roots and modules.
- Build formatting previews.
- Detect stale source files.
- Assess semantic-diff risk.
- Run project-owned validation commands.
- Present diffs and apply approved edits.

Ignored and unselected source files are not included in formatting requests.

## Provider Requests

Local providers:

- Ollama requests stay on the user's machine.
- The reference provider performs no semantic source transformation.

Remote providers:

- Anthropic and OpenAI receive the selected file path.
- They receive the complete selected file contents after deterministic local formatting.
- They receive the file language, exported symbols, and selected style guidance.
- Provider responses return formatted source and warnings to the extension host.

Remote-provider retention, logging, and model-training terms are controlled by the selected provider and account. Users should review those terms before transmitting repository source.

Connection tests authenticate against the selected provider without sending repository source code.

## Credentials

Provider API keys are stored through VS Code SecretStorage.

Keys are not written to:

- `settings.json`.
- Source files.
- Webview state.
- Exported run reports.

Keys are transmitted only to the selected provider as required for authentication.

## Local Validation

Codexa creates a temporary local copy of the owning package when running declared type-check, lint, and test scripts against previews.

The temporary copy:

- Contains the package files required by the checks.
- Overlays Codexa's changed previews.
- Reuses local installed dependencies when available.
- Is removed after validation completes or fails.

## Reports

Exported run reports contain source-free metadata such as:

- File paths.
- Formatting statuses.
- Warning and risk categories.
- Project command names, statuses, and durations.
- Selected provider, model, profile, and module identifiers.

Reports exclude source contents, provider credentials, provider responses, and project-command output.
