# Style Conformance Report (B4)

Result of running every `Input → Output` pair in [examples/](examples/) through the live
Anthropic provider (`claude-opus-4-8`, effort `high`) and comparing the formatted output to the
documented output by **exact string match**.

Harness: `scripts/run-goldens.mjs` (concurrency 1, 26s throttle + 429 retry to respect the
org's 5-req/min · 10k-input-token/min limit). Re-run with:

```bash
ANTHROPIC_API_KEY=… node scripts/run-goldens.mjs
```

## Headline

| Category | Exact match |
|----------|-------------|
| import   | **8 / 8 (100%)** |
| function | 7 / 14 |
| hook     | 6 / 15 |
| view     | 4 / 14 |
| **Total**| **25 / 51 (49%)** |

Zero rate-limit failures in the measured run — every example was genuinely evaluated.

## What the misses actually are

Reading the per-example diffs, the failures fall into three buckets. Only the third is a real
formatter defect.

### 1. Subjective section-/function-title wording (largest bucket)
The code structure and comment format are correct; only the *words* in a title differ. These flip
run-to-run for the same input (LLM title choice is not deterministic):

| Input | Documented title | Model produced |
|-------|------------------|----------------|
| `handleUpdateQuantity` | `Update quantity` | `Handle update quantity` |
| `const fn = …` | `Fn` | `Fetch data` |
| if/else chain | `Determine label` / `Returned response` | `Guard clause` / `Return result` |
| `setTimeout` | `Start timer` | `Create timer` |
| `useEffect` readiness | `Determine readiness` | `Determine ready state` |
| object literal | `Prepare config` / `Prepare object` | `Prepare payload` |

These are unguessable: the docs assign different titles to near-identical inputs, and several
titles ("Returned response", "Fn") are idiosyncratic. They cannot be hit by an exact-match rule
without leaking the specific example into the prompt.

### 2. Contradictions inside the example docs (unwinnable by construction)
The target outputs disagree with each other, so no single behavior can satisfy all of them:

- **Comment-bar indentation.** Function/hook bodies use a leading-space bar (`␣|----`), but the
  nested-object example (functions ex. 23) uses a flush bar (`|----`). hook ex. 21 wants
  leading-space; the object example wants flush. Mutually exclusive.
- **Property ordering.** functions ex. 21/22 sort object keys by length; ex. 23 leaves the
  top-level order untouched; ex. 22's documented order isn't monotonic by key length *or* line
  length.
- **Type additions.** hook ex. 19 expects `useRef(false)` → `useRef<boolean>(false)` — i.e. it
  *adds* a type annotation. That is a type change, which contradicts the hard "do not change types"
  constraint and is correctly rejected by the behavior-preservation check.

### 3. Genuine formatter defects — found and fixed
- **try/catch comment placement:** the model was labelling the `try` keyword line; the house style
  comments the statements *inside* the block. Fixed (rule added); structure now matches.
- **Collection returns:** `return users.map(…)` was titled `Return result`; the house style uses
  `Process items`. Fixed; example now passes.
- Also reinforced: JSX returns → `Render content`, nested objects → `Nested <key>`, leading-space
  internal bars.

## Conclusion

The formatter is sound where the target is well-specified: **imports are 100%**, and structural
rules (guard clauses, early returns, switch, try/catch placement, comment format, import grouping
and ordering) are followed. The ~50% exact-match ceiling is set almost entirely by subjective title
wording and by the example docs contradicting themselves — not by the model mis-formatting.

## Recommendations

1. **Reconcile the example docs** so the target is self-consistent: pick one comment-bar convention
   (leading-space vs flush), one property-ordering rule, drop the type-adding example, and
   canonicalise titles for repeated input shapes. This raises the achievable ceiling more than any
   prompt change.
2. **Adopt a structure-aware conformance metric** instead of exact string: compare normalized
   structure + comment *positions*, and score section titles fuzzily (present & reasonable) rather
   than character-exact. This reflects real output quality far better.
3. Keep the behavior-preservation check authoritative — it correctly rejects the doc example that
   would have changed types.
