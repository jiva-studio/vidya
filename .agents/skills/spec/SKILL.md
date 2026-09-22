---
name: spec
description: Authors a formal technical specification in .agents/tasks/<slug>/spec.md and a strictly validated done.yaml based on intent.md. Performs codebase reconnaissance, maps blast radius, and defines declarative verification claims. Trigger with "/spec", "spec", "create spec", or "write spec".
---

# Technical Specification Skill (`/spec`)

The `/spec` skill transforms a validated business intent (`intent.md`) into a technical implementation blueprint (`spec.md`) and a machine-readable verification contract (`done.yaml`).

```mermaid
flowchart TD
    ReadIntent["1. Read .agents/tasks/<slug>/intent.md"] --> Recon["2. Codebase Reconnaissance
(Scan existing types/utilities in modules/)"]
    Recon --> WriteSpec["3. Author .agents/tasks/<slug>/spec.md
(DTOs, Interfaces, Blast Radius Table)"]
    WriteSpec --> WriteDone["4. Generate .agents/tasks/<slug>/done.yaml
(Declarative Claims: make, mutation, critic)"]
    WriteDone --> ValidateDone{"5. MANDATORY VALIDATION
(python3 -m scripts.done --validate)"}
    ValidateDone -->|Exit != 0 (Errors)| FixDone["Fix done.yaml schema/params"] --> ValidateDone
    ValidateDone -->|Exit 0 (Valid)| Complete["6. Spec Locked! Ready for /coder"]
```

---

## Step 1: Locate Active Task and Intent

1. Identify active task folder:
   - If argument passed (e.g. `/spec .agents/tasks/feat-enroll`): use that directory.
   - Otherwise, detect branch slug:
     ```bash
     BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr "/" "-")
     TASK_DIR=".agents/tasks/${BRANCH}"
     ```
2. Read `.agents/tasks/<slug>/intent.md`.
   - If `intent.md` does not exist, STOP and instruct the user to run `/intent` first.

---

## Step 2: Codebase Reconnaissance (Anti-Hallucination Gate)

Before inventing new classes, types, or utilities, search the codebase:
1. Grep existing DTOs, models, and domain entities across `modules/libs/` and `modules/services/`.
2. Check if a similar helper, enum, or event already exists.
3. Note all target packages that will be modified or imported.

---

## Step 3: Author `.agents/tasks/<slug>/spec.md`

Generate `spec.md` with:
1. **Target Architecture & Interfaces**: exact TypeScript/Go signatures.
2. **Blast Radius Matrix**:
   | Package | File | Action (Create/Modify) | Downstream Consumers |
   | :--- | :--- | :--- | :--- |
   | `@vidya/domain` | `src/enrollment.ts` | Modify | `@vidya/usecases`, `@vidya/api` |
3. **Negative Invariants**: explicit architectural prohibitions.

---

## Step 4: Generate Declarative `.agents/tasks/<slug>/done.yaml`

Generate the machine-readable contract. Follow this exact declarative schema:

```yaml
slug: <task-slug>
target: "modules/libs/domain"

claims:
  # L1: Compilation, Linting, Unit Tests
  - id: l1-check
    kind: make
    target: check-package
    params:
      PKG: "@vidya/domain"

  # L2: Mutation Testing (Stryker diff against branch changes)
  - id: l2-mutation
    kind: mutation
    target: "@vidya/domain"
    mode: diff

  # L3: Deterministic Critic Agent Review
  - id: l3-critic
    kind: critic
    runner: "gemini"               # gemini | claude | auto
    model: "gemini-2.5-flash"      # or claude-3-5-haiku-latest
    checks:
      - "Follows intent.md and respects all Non-Goals"
      - "No unhandled nulls or security bypasses"

  # Optional: Diff Hygiene Check
  - id: l4-hygiene
    kind: hygiene
    no_stubs: true
    no_skipped_tests: true
```

---

## Step 5: MANDATORY GATE — Validate `done.yaml`

Run the validation command in the terminal:
```bash
python3 -m scripts.done --validate .agents/tasks/<slug>/done.yaml
```

* **HARD RULE**: The specification process **CANNOT finish** until this command exits with code `0`.
* If validation reports errors (missing fields, invalid claim kind, bad parameters), fix `done.yaml` and re-run the validation until it returns `✅ done.yaml is VALID`.

---

## Step 6: Hand Off to `/coder`

Once validated, output:
> *"Specification and contract locked in `.agents/tasks/<slug>/`. Ready for `/coder`."*
