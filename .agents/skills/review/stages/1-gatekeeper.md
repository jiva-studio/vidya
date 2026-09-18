---
name: reviewer
description: Specialized quality assurance and code review agent that audits changes against architectural standards, code style, template purity, and gatekeeper status.
---

# Vidya Reviewer Agent

This skill guides the automated and semantic review of changes in `vidya`.

## Review Protocol

The reviewer executes a two-level inspection:

### Level 1: Automated Gatekeeper Execution (Programmatic)
Run the full automated verification suite:

```bash
make check
```

It chains, across every workspace in `modules/`: `typecheck` (`tsc --noEmit`),
`lint` (ESLint flat config), `format:check` (Prettier) and `test` (Jest).

**Auto-Rejection Criteria**:
- If `tsc` fails -> **REJECT** (Type errors).
- If `eslint` fails -> **REJECT**. The structural rules carry specific meaning:
  - `max-lines` / `vue/max-lines-per-block` -> a file or block outgrew its ceiling.
  - `complexity` / `max-depth` -> branching that needs decomposition, not a bigger limit.
  - `no-restricted-syntax` in `libs/` -> ambient clock or RNG where a port belongs.
  - `no-empty` -> a swallowed error.
  - `simple-import-sort` -> run `make lint-fix`.
- If `prettier` fails -> **REJECT** (Unformatted files).
- If `jest` fails -> **REJECT** (Broken tests).

**Never accept a partial gate as a passing gate.**
`make lint` alone proves nothing about types, formatting or behaviour, and a
decomposition that satisfies `max-lines` routinely breaks the build in the same
commit. The gate is `make check` exiting 0, in full.

### Level 2: Semantic & Architectural Inspection (Manual)
Once programmatic checks pass, inspect the diff for:

1. **Component Sizing & Decomposition**:
   - Are components modular and single-responsibility?
   - Is template logic completely absent (no hidden business logic in template)?
2. **Component Sections**:
   - Do `.vue` components follow the standardized section banners?
     (`Props` -> `Events` -> `State` -> `Hooks` -> `Handlers` -> `Helpers`)
3. **Composable File Naming & Scope**:
   - Is every composable (`useXxx`) defined in a file strictly named `useXxx.ts`?
   - Reject any composable living in a plain noun file (e.g. `director.ts`).
   - **Reject God / Junk-Drawer Composables**: Reject any composable that dumps an entire component's script into one file (>8 exports or >200 LOC orchestrating everything). Require proper UI decomposition into subcomponents instead.
4. **Type Isolation**:
   - Are props and emits extracted into adjacent `types.ts`?
   - Are types re-exported through `index.ts` and `src/index.ts`?
5. **Tailwind Styling Discipline & Extraction**:
   - Are static class arrays and CVA variants extracted to adjacent `styles.ts`? (Forbidden in `<script>`: enforced by `vidya/no-static-styles-in-script`).
   - Are class chains split into multi-line arrays with concise English intent comments explaining their visual purpose?
6. **No DOM Leakage**:
   - Does any component query the DOM for user input or state? (Forbidden: enforced by `vidya/no-dom-state-query`). State must flow through props/emits/models.
7. **Domain Purity & Cohesion Audit (Frontend & Backend)**:
   - **REJECT** any service combining concerns from disparate functional areas. A service must have high cohesion and represent a single bounded context.
   - **REJECT** any service designed to mirror a composite HTTP response payload ("endpoint-driven design"). Composition of multiple domains belongs in the transport layer (Router / Controller), never in a mutated domain service.
   - **REJECT** any flat `api.ts` dumping ground or direct `fetch()` calls in components or composables. All HTTP interactions must live in dedicated domain services utilizing a typed `HttpClient`.
8. **Anti-God-Object & Transport Separation (Backend)**:
   - **REJECT** any struct combining multiple responsibilities (e.g. HTTP routing, domain logic, and I/O watching).
   - Domain services must be cleanly separated and completely decoupled from HTTP transport (`Router`).

### Output Integration
All findings from this stage must be integrated into **Stage 1 (Gatekeeper & Architecture)** of the Unified Report defined in [`../SKILL.md`](../SKILL.md). Do not output a separate standalone report.
