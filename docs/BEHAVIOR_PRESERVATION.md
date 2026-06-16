# Codexa Behavior-Preservation Guarantees

Codexa is a formatter. It must not intentionally change the runtime behavior of selected source code.

## Required Guarantees

Every production formatting pipeline must:

- Snapshot source contents and hashes before processing.
- Refuse to overwrite a file that changed after its snapshot.
- Parse every supported file before formatting.
- Apply deterministic transformations through a language adapter.
- Request structured semantic patches from AI providers.
- Avoid asking providers to reproduce complete files.
- Parse every generated result before review or application.
- Preserve imports, exports, declarations, decorators, and symbols.
- Preserve order-sensitive expressions and initialization.
- Show source changes through native VS Code diffs.
- Apply only changes approved by the selected execution mode.
- Retain recoverable previews when a run is cancelled.

## Reordering Restrictions

Codexa must not reorder:

- Side-effect imports.
- Decorators.
- Class fields whose initialization order can affect behavior.
- Object properties whose evaluation order can affect behavior.
- Statements.
- Function parameters.
- Switch cases.
- Validation decorators unless the active language adapter proves ordering is irrelevant.

When safety cannot be proven, Codexa must preserve the original order.

## AI Restrictions

AI providers may:

- Generate detailed semantic comments.
- Replace incomplete comment placeholders.
- Suggest bounded formatting patches allowed by the active profile.

AI providers must not independently:

- Rename symbols.
- Refactor control flow.
- Change API calls.
- Add features.
- Remove behavior.
- Change types.
- Change public contracts.
- Rewrite files outside the selected modules.

## Validation Requirement

A generated change must remain unapplied when any required parser, symbol-preservation, type-check, lint, or test validation fails.

The developer may inspect a failed preview, but Codexa must never describe it as validated.
