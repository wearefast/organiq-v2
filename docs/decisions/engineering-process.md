# Engineering Process — Calibrate Commerce (Pulse)

Reference document for engineers. This is the full process behind the rules in `copilot-instructions.md`.

---

## Why These Rules Exist

This codebase was partially built with AI assistance. The result was a pattern of symptom-patching, untouched-file contamination, and stacked fixes that introduced regressions faster than they resolved them. These rules exist to stop that cycle.

The core principle: **every change has side effects. Minimize the surface area.**

---

## Workflow — Step by Step

### Step 1: Understand the Issue

Before writing code:

- Restate the problem in one sentence
- Define expected vs. actual behavior precisely
- Identify where in the app this occurs (UI / state / API / DB)

If any of these are unclear → ask. Do not proceed with assumptions.

### Step 2: Find the Relevant Files

Search the codebase. Identify the 3–5 most relevant files. For each one, explain why it's relevant.

Do not include entire folders. Do not include files you're unsure about.
If you can't confidently identify the relevant files → ask for help scoping.

### Step 3: Trace the Full Flow

Follow the issue through every layer it touches:

1. UI (component)
2. State (hooks / store)
3. API / service layer
4. Backend / DB (if applicable)

List every file involved. Understand what each one does before touching any of them.

### Step 4: Identify Root Cause

Find the exact cause. Do not proceed without high confidence.

If there are multiple possible causes — list them all, then eliminate. Do not guess which one and patch it.

### Step 5: Impact Analysis

Before writing a single line:

- What other features use this code?
- What could break if this changes?
- Are there shared utilities or hooks affected?

Write the risks out explicitly.

### Step 6: Propose the Fix

Explain the fix in plain English. Justify why it's correct. Confirm it doesn't break other flows.

Then ask: "Does this approach make sense before I implement it?"

### Step 7: Implement (Surgical)

- Make the smallest possible change
- Do not refactor unrelated code
- Do not rename, reorganize, or restructure unless asked
- Maximum 3 files — if more seem necessary, re-evaluate the approach

### Step 8: Validate

After changes:

- TypeScript errors: none
- Imports: all valid
- Unused variables: none
- Existing flows: manually verify they still work

---

## Broken State Recovery

When the codebase has known regressions, the normal workflow does not apply. Do this first:

1. `git log --oneline` — find the last commit where core flows worked
2. Check it out and verify manually
3. Write down every broken behavior — one line each
4. Pick the single most critical one
5. Now start the normal workflow from Step 1 for that one issue

Do not attempt to fix multiple regressions in parallel. Do not add new features while regressions exist.

---

## Anti-Spiral Protocol

If a fix introduces a new bug:

- STOP immediately
- Do not attempt another fix on top of it
- Do not guess what the new bug might be
- Re-run the full workflow from Step 1
- The new bug is a separate issue — treat it as one

Stacking fixes is how a two-hour problem becomes a two-day one.

---

## When Context Is Insufficient

If the issue is vague, the expected behavior is unclear, or you can't trace the flow confidently:

Ask. Specifically. State what information you need.

Do not proceed with assumptions. Assumptions generate plausible-looking code that breaks real behavior.

---

## Code Standards

| Concern | Rule |
|---|---|
| Component size | ≤150 lines. Split if exceeded. |
| Reused logic | Extract to `features/<name>/hooks/` |
| API calls | `features/<name>/services/` or `shared/utils/api.ts` |
| Prop drilling | Max 2 levels. Use hook or context beyond that. |
| New abstractions | Only if code is already repeated or explicitly asked |
| Tests | Required for every new feature and every bug fix |
| Docs | Update `docs/` if change affects API, schema, architecture, or integrations |
| New feature | Add `README.md` inside its feature folder |

---

## PR Checklist

Before merging any change:

- [ ] Root cause identified (not symptom patched)
- [ ] Maximum 3 files changed
- [ ] No unrelated files touched
- [ ] TypeScript errors: none
- [ ] Tests written or updated
- [ ] Existing flows manually verified
- [ ] Docs updated if applicable
- [ ] Second engineer has reviewed

---

## Docs Structure

```
docs/
  product/          → overview, features, user-flows
  architecture/     → system-design, frontend, backend, data-models
  features/         → audit, keywords, content, leads, integrations
  debugging/        → known-issues, patterns
  decisions/        → tech-decisions, engineering-process (this file)
```

Read the relevant doc before touching a feature. Update it after.
