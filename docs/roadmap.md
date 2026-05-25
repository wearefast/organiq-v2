# OrganiQ Product Roadmap

## Backlog

### Workflow: Reject & Revise with Notes Feedback Loop

**Status:** Removed from UI — pending proper implementation  
**Priority:** Medium  

**Context:**  
The Reject and Revise buttons existed in the workflow approval bar but the notes entered by the reviewer were never surfaced to the agent when the step re-ran. The mechanic is partially in place (`step_approvals` table, `revision_requested` status) but the feedback loop from reviewer → agent prompt is missing.

**Required work:**

| Step | File | Change |
|------|------|--------|
| 1 | `server/src/features/workflows/workflow.service.ts` — `handleApproval` | On `revision_requested` decision, call `setContext(runId, `${stepKey}-revision-notes`, notes)` to persist notes in `workflow_context` |
| 2 | `server/src/features/workflows/workflow.processor.ts` — after `loadPrompt` | Read `context[`${stepKey}-revision-notes`]`; if present, append a structured revision block to the user prompt before passing to the managed agent |
| 3 | `frontend/src/features/workflow/components/artifact-panel.tsx` | Re-add Revise and Reject buttons with notes textarea once the backend feedback loop is verified end-to-end |

**Behaviour when complete:**
1. Reviewer clicks Revise, enters notes → step status → `revision_requested`, notes written to `workflow_context`
2. Reviewer clicks Re-run → step resets, re-enqueues
3. Processor picks up the job, loads context (revision notes survive the reset because they're stored under `${stepKey}-revision-notes`, not `${stepKey}`)
4. Processor appends revision block to user prompt:
   ```
   ---
   ## REVISION REQUEST
   A human reviewer has requested changes. Address the following before producing your output:

   {notes}
   ```
5. Agent sees the original instructions + revision request → produces improved output

**Notes:**
- Revision notes key (`${stepKey}-revision-notes`) is intentionally different from the artifact context key (`${stepKey}`) so it survives `rerunStep`'s context wipe
- No `.prompt.md` files need to be modified — injection is done programmatically in the processor
- Reject follows the same pattern but sets status to `rejected` instead of `revision_requested`
