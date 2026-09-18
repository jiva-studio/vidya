---
name: coder
description: Implementation agent for features, bug fixes and refactors. Reads the project's architecture and coding-style rules, respects the spec if one exists, and finishes only when the quality gate passes.
---

# Coder Agent

The mandatory implementation workflow. This skill is the **method**; every
project-specific constraint lives in [`../../rules/`](../../rules/) and is read
at Phase 1, never duplicated here.

## Phase 1: Load the rules

1. Read [`../../rules/architecture.md`](../../rules/architecture.md) — layout,
   layering, dependency direction, structural limits.
2. Read the coding-style rule for the layer you are touching, from
   [`../../rules/`](../../rules/).
3. Read [`../../rules/comments.md`](../../rules/comments.md) — what a comment
   may say and how long it may be.
4. Read [`../../rules/process.md`](../../rules/process.md) — who owns which
   files when more than one agent is on the band, and what you must prove
   before handing over.
5. If a spec exists for the current branch at `.agents/specs/<branch-slug>.md`,
   read it. It is the contract: its acceptance criteria define done, and its
   non-goals define where to stop.

Never infer a convention from surrounding code when a rule states it. Code drifts;
the rules are what the review enforces.

## Phase 2: Design within the constraints

Before writing anything, confirm the change fits:

- **Size and complexity limits** — if the target file is already near its
  ceiling, decompose first, then implement. Retrofitting a split afterwards is
  the expensive order.
- **Layer boundaries** — transport does not hold domain logic; domain code does
  not know about transport; pure layers stay pure.
- **Package boundaries** — cross-package imports go through the package's public
  entry point, never a relative path that climbs out of it.
- **Determinism** — in pure layers, ambient clocks, timers and randomness are
  injected as ports, not called directly.
- **No swallowed errors** — handle, rethrow, log, or write the comment that
  explains why ignoring is safe.

If the change cannot fit the constraints, say so and propose the refactor. Do not
quietly exceed a limit.

## Phase 3: Implement

Prefer decomposing early over refactoring at the ceiling: a second focused file
is always cheaper than one that has to be split later.

Leave nothing unwired. A new module that nothing imports, a handler nothing
routes to, a component nothing renders — these read as complete and are not.
Stage 0 of [`../review/SKILL.md`](../review/SKILL.md) rejects exactly this.

### Comments you write in this phase

The full rule is [`../../rules/comments.md`](../../rules/comments.md). The four
things it forbids, because they are the four that keep happening:

1. **No identifiers from documents that are not in the repository.** `(D-14)`,
   `(I-2, AC-22f)`, `(T-S-35)` — the plan and the spec are not committed, so for
   the next reader these point nowhere. This includes test names: a test says
   what breaks, not which row of which table asked for it.
2. **No defect history.** What was broken and how it was found belongs in the
   commit message. The docblock describes the code as it stands.
3. **Size matches the subject.** One field gets one line. A non-trivial
   algorithm gets a paragraph. Anything longer is documentation and belongs in
   `docs/`, linked by path.
4. **Say why, not what.** What the code does is the code's job — if a comment is
   needed to explain that, the name is wrong. A comment exists for the constraint,
   the invariant, or the trade-off that the reader cannot see.

## Phase 4: Gatekeeper (strict)

Before reporting the task complete, run the project gate from the repository root:

```bash
make check
```

The [`../makefile/SKILL.md`](../makefile/SKILL.md) skill documents what this
project's gate chains and which targets exist for a faster inner loop.

**A partial gate is not a gate.** Running only the linter or only one package's
tests leaves the rest unverified, and a change that satisfies one stage routinely
fails another — a decomposition that fixes a line-count violation still has to
compile, stay formatted and keep the tests green.

If any check fails, fix the violation and re-run until the gate exits 0. Report
the result honestly: if something is still failing, say which and why, rather
than describing the task as done.
