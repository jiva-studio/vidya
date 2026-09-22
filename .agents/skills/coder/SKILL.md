---
name: coder
description: Implementation agent for features, bug fixes and refactors. Reads the project architecture and coding-style rules, verifies that a valid done.yaml exists before starting, and finishes only when all deterministic quality gates pass.
---

# Coder Agent

The mandatory implementation workflow. This skill is the **method**; every
project-specific constraint lives in [`../../rules/`](../../rules/) and is read
at Phase 1, never duplicated here.

---

## Phase 0: Pre-Condition Check (MANDATORY)

Before writing any code or modifying any files, verify that the task specification and contract are locked:

1. Locate `.agents/tasks/<slug>/done.yaml`.
2. Execute the validation gate:
   ```bash
   python3 -m scripts.done --validate .agents/tasks/<slug>/done.yaml
   ```
3. **HARD STOP RULE**:
   - If `done.yaml` does not exist or fails validation: **DO NOT WRITE CODE**.
   - Stop immediately and instruct the user to run `/intent` and `/spec` first.
   - Implementation is strictly forbidden without a validated contract.

---

## Phase 1: Load the Rules & Task Context

1. Read `.agents/tasks/<slug>/intent.md` (the "Why" and Non-Goals).
2. Read `.agents/tasks/<slug>/spec.md` (the "What", Interfaces, and Blast Radius).
3. Read [`../../rules/architecture.md`](../../rules/architecture.md) — layout, layering, dependency direction.
4. Read the coding-style rule for the layer you are touching ([`../../rules/`](../../rules/)).
5. Read [`../../rules/process.md`](../../rules/process.md) — roles, TDD red-first, and what must be proven.

---

## Phase 2: Design within Constraints

Before writing anything, confirm the change fits:
- **Layer boundaries** — transport does not hold domain logic; domain stays pure.
- **Package boundaries** — cross-package imports go through public entry points (`index.ts`).
- **No swallowed errors** — handle, rethrow, or log explicitly.

---

## Phase 3: Implement (TDD)

1. **Red Phase**: Write the failing test first and verify it fails for the right reason.
2. **Green Phase**: Implement minimal logic until test passes.
3. **Wire Phase**: Re-export from `index.ts`, register handlers, wire bindings.

---

## Phase 4: Local Quality Gate

While working, run the narrow check:
```bash
make check-package PKG=@vidya/...
```
And verify mutation score:
```bash
make mutate-diff PKG=@vidya/...
```

---

## Phase 5: Task Completion & Stop-Hook Verification

When you believe the task is done, simply finish your turn.
The deterministic **Stop-Hook** will automatically execute `scripts/done/` to verify all claims in `done.yaml` (including mutation tests and critic checks). If any check fails, you will receive exact error details to fix.
