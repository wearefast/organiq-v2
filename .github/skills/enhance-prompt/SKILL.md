---
name: enhance-prompt
description: 'Enhance a rough or vague prompt into a precise, world-class engineering instruction. Use when: you have a half-formed idea you want to articulate clearly, want to improve a prompt before acting on it, need to translate fuzzy intent into a concrete task with file references and scope constraints, or want Copilot to fully understand your project context before doing anything. Produces a rewritten prompt that embeds PerformR project conventions, the correct docs references, true intent, and explicit success criteria.'
argument-hint: 'Your rough prompt, idea, or intent to enhance'
---

# Enhance Prompt

## Purpose

Transform a rough, vague, or abbreviated prompt into a precise, complete engineering instruction that reflects:
- The Pulse project conventions
- The correct documentation references for the domain being touched
- The user's true intent (not just what they said)
- Explicit scope, file references, and success criteria

## When to Use

- You know what you want but can't fully articulate it
- Your prompt is too short and risks being misunderstood
- You want to embed context (docs, files, schema, flows) before Copilot acts
- You want to enforce the mandatory workflow in the prompt itself
- You're about to ask something complex (multi-file change, schema migration, new feature) and want the output to be right on the first attempt

## Procedure

### Step 1 — Parse Intent

Read the rough prompt carefully. Extract:

- **Domain**: Is this a bug fix, feature addition, refactor, question, schema change, or UI change?
- **Affected surface**: Frontend (app/, components/), backend (app/api/, lib/services/), schema (lib/schema.ts), docs, tests, or multiple?
- **Core action**: What must actually change?
- **Implicit constraints**: What must NOT change? What must remain backward-compatible?

If the intent is ambiguous, note the two most likely interpretations and flag them for clarification in the enhanced prompt.

### Step 2 — Load Project Context

Based on the domain from Step 1, identify which docs sections are relevant:

| Domain | Docs to reference |
|--------|-------------------|
| Bug fix | `docs/debugging/README.md`, the affected feature doc in `docs/features/` |
| New feature | `docs/features/README.md`, `docs/product/README.md` for domain concepts |
| Schema change | `docs/architecture/README.md`, `docs/reference/README.md` |
| UI change | `docs/design/README.md` |
| API change | `docs/architecture/README.md`, `docs/reference/README.md` |
| Auth / security | `.github/copilot-instructions.md` constraints section |

Do NOT load all docs — load only the narrow section relevant to the task.

### Step 3 — Apply Pulse Writing Conventions

The user writes prompts that are:
- **Concise and direct** — no preamble, no filler
- **Action-first** — starts with a verb or a precise noun phrase
- **File-specific** — references actual paths
- **Intent over implementation** — states what should happen, not necessarily how
- **Minimal scope** — never asks for more than 3 files to change; never asks for refactors alongside bug fixes

When enhancing, preserve this style. Do not pad with unnecessary context. Do not add explanations that Copilot can infer from the code.

### Step 4 — Reconstruct the Prompt

Write the enhanced prompt using this structure:

```
**Issue / Goal**
[One precise sentence: what needs to happen and why]

**Context**
- Affected files: [list actual paths]
- Related docs: [specific doc paths, not the whole docs/]
- Schema / API: [specific tables, routes, or fields involved]
- Constraint: [what must not break; max 3 files]

**Expected behavior**
[What the system should do after the change]

**Current behavior** (for bug fixes only)
[What it actually does now, with evidence if known]

**Scope**
- Change: [files to modify]
- Do NOT touch: [adjacent things that must be left alone]

**Success criteria**
- [ ] [specific, verifiable outcome 1]
- [ ] [specific, verifiable outcome 2]
- [ ] tsc --noEmit passes
```

Omit sections that are not relevant (e.g., "Current behavior" for a new feature). Keep the total prompt under 250 words.

### Step 5 — Sanity Check

Before presenting the enhanced prompt, verify:

- [ ] The enhanced prompt does not violate the 3-file rule
- [ ] It does not ask for refactors or "improvements" alongside the core ask
- [ ] It references real file paths (not made-up paths)
- [ ] Success criteria are verifiable, not vague ("works correctly" is NOT verifiable)
- [ ] If a schema change is implied, the prompt includes `lib/schema.ts` + `npm run db:push` + docs update

### Step 6 — Present

Output:
1. A brief one-line summary of what you interpreted the intent to be
2. The enhanced prompt in a fenced code block (so the user can copy it)
3. A "Flags" section noting any ambiguities, risks, or assumptions you made

Example format:

---
**Interpreted intent**: Fix the portal rate-submit 409 when a creator's second invitation hasn't been marked interested yet.

```
[enhanced prompt here]
```

**Flags**
- Assumed the fix is in `app/api/portal/[token]/route.ts` — confirm if the issue originates in the client instead.
- Marking interested automatically may change negotiation flow; flagged in success criteria.
---

## PerformR-Specific Vocabulary

When enhancing prompts, use these exact terms (not synonyms):

| Concept | Correct term |
|---------|-------------|
| Campaign invite to creator | `invitation` |
| Creator's submitted content | `submission` |
| Payment milestones | `milestones` (not "payments" or "payment steps") |
| Approval workflow | `creator approval session` |
| Creator's portal page | `portal` |
| Influencer | `creator` |
| Brand/advertiser | `brand` |
| Campaign status states | `draft → active → paused → complete` |
| Invitation status states | `sent → opened → interested → accepted → declined` |
| Submission stage states | `pending → approved → rejected` |

## PerformR 7-Step Workflow Hooks

If the enhanced prompt is for a code change, append this reminder at the end of the success criteria:

```
- [ ] Follow the mandatory 7-step workflow (copilot-instructions.md): understand → read → trace → root cause → impact → implement → verify
```

This ensures Copilot will not skip to implementation without reading the affected files first.
