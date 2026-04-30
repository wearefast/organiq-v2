# Debugging Patterns

Recurring patterns and lessons learned while debugging this codebase.

## General Rules

- **NEVER fix blindly** — Understand the root cause before changing code.
- **NEVER change multiple things at once** — One change at a time, verify each.
- **NEVER assume behavior** — Trace the actual data flow.

## If Stuck

1. Add logs at system boundaries
2. Inspect data flow (DB → service → controller → frontend)
3. Narrow scope until the exact failure point is found

## Pattern: Trace Data Lifecycle

For any data-dependent bug, trace: **CREATE → UPDATE → READ** across all surfaces. The bug is usually at a boundary between two of these.

## Pattern: Query DB Before and After

Don't trust assumptions about data shape. A quick DB query reveals stale data that would otherwise take 3 rounds of user reports to discover.

## Pattern: Diff Shared Logic

If the same logic exists on two pages/surfaces, the conditions MUST be identical. After editing one, immediately grep for the same pattern on the other and verify they match.
