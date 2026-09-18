---
name: coder
description: Specialized software engineering agent for implementing features, fixing bugs, and refactoring in Vidya following strict architectural and coding style guidelines.
---

# Vidya Coder Agent

This skill defines the mandatory implementation workflow for all coding tasks in `vidya`.

## Mandatory Implementation Workflow

Whenever implementing changes, you MUST follow these phases in order:

### Phase 1: Context & Rule Retrieval
1. Read `.agents/rules/architecture.md`.
2. If working on a service (NestJS / TypeORM):
   - Read `.agents/rules/coding-style-backend.md`.
3. If working on an app (Vue 3):
   - Read `.agents/rules/coding-style-frontend.md`.

### Phase 2: Design & Sizing Constraints

Before writing code, verify:

**Everywhere**
- **File size**: max 350 lines, blanks and comments excluded.
- **Complexity**: max cyclomatic complexity 10; max control-flow nesting 3.
- **Package boundaries**: cross-package imports use `@vidya/*`, never a relative
  path that climbs out of the package. Libs never import from apps or services.
- **Determinism in `libs/`**: no `Date.now()`, `new Date()`, `setTimeout`,
  `setInterval`, `Math.random()`. Inject a port.
- **No error swallowing**: an empty `catch` block fails lint. Handle, rethrow,
  log, or explain in a comment.

**Services (NestJS)**
- Controllers parse and dispatch; they never hold domain logic and never return a
  TypeORM entity.
- Domain services never import `express` types, never set HTTP status codes.
- **Domain purity**: one service, one bounded context.
- **Domain-driven, not endpoint-driven**: never model a service on the composite
  payload of one endpoint. Compose in the controller instead.
- **Anti-god-object**: a class that routes, validates, persists and notifies must
  be split.
- Validation lives on the DTO via `class-validator`, not in the handler body.
- Every route carries its `@ApiOperation` / `@ApiResponse` metadata.

**Apps (Vue)**
- `<template>` <= 100 lines, `<script>` <= 300 lines, template depth <= 4.
- Section banners in order: `Props` -> `Events` -> `State` -> `Hooks` -> `Handlers` -> `Helpers`.
- Props and emits extracted to an adjacent `types.ts`.
- No nested ternaries in templates, no logic in event handlers, no `querySelector`
  to read state, no monolithic class strings.
- No flat `api.ts` dumping ground — one typed domain service per entity over a
  shared typed HTTP client.

### Phase 3: Implementation

Implement the change respecting the constraints above. Prefer decomposing early
over refactoring at the ceiling: a second focused file is always cheaper than a
350-line one that has to be split later.

### Phase 4: Mandatory Gatekeeper Verification (Strict Requirement)

Before finishing any task, run the full verification command from the repository root:

```bash
make check
```

This runs, across every workspace in `modules/`:

1. `typecheck` — `tsc --noEmit` in each package
2. `lint` — ESLint flat config: structural limits, purity rules, import order
3. `format:check` — Prettier (`semi: false`, `singleQuote`, `printWidth: 100`)
4. `test` — Jest

A partial gate is not a gate. Running only `make lint` or only `make api-test`
leaves the other three stages unverified, and a change that passes one stage
routinely fails another — a decomposition that satisfies `max-lines` still has to
typecheck and stay formatted.

If ANY check fails, you MUST fix the violation immediately and re-run until all
checks pass with exit code 0.
