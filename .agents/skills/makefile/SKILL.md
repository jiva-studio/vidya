---
name: makefile
description: Manage, edit, and execute targets in the root Makefile following the strict <project>-<action> naming convention.
---

# Makefile Management & Execution Skill

This skill defines the standards for editing and using the repository root `Makefile`.

## Naming Convention: `<project>-<action>`

All project-specific targets MUST use the `<project>-<action>` prefix format:

- `<project>`: the module or subsystem (e.g. `api`, `db`).
- `<action>`: the operation (e.g. `build`, `run`, `test`, `migrate`).

Workspace-wide gates are the exception and stay unprefixed: `check`, `typecheck`,
`lint`, `format`, `test`, `install`, `clean`.

### Standard Targets

**Gates**
- `check` — the full quality gate. Chains typecheck, lint, format-check and test
  across every workspace. The mandatory pre-submit command.
- `typecheck` — `tsc --noEmit` in each workspace.
- `lint` / `lint-fix` — ESLint flat config over `modules/`.
- `format` / `format-check` — Prettier.
- `test` — Jest across every workspace that defines a test script.

**API**
- `api-build` — `nest build` for `@vidya/api`.
- `api-run` — start the API in watch mode.
- `api-test` — Jest for `@vidya/api` only.

**Database**
- `db-run` — start the local Postgres instance.
- `db-drop` — drop the local database.
- `db-migrate` — run pending migrations.
- `db-migrate-generate` — generate a migration from entity changes.
- `seed` — populate the database with development data.

**Housekeeping**
- `install` — install workspace dependencies.
- `clean` — remove `node_modules`, `dist` and build info.

### Why Targets Delegate to npm

`modules/` is an npm workspace root. Every target shells out through
`npm --prefix modules` (captured once as `$(NPM)`) rather than hardcoding a
package path, so adding a workspace to `modules/package.json` makes it part of
the gate automatically. Per-package targets use `-w @vidya/<name>` for the same
reason.

### Why Scripts Are Not Inlined

Database targets call `./scripts/vidya-*` rather than embedding a docker or
typeorm invocation. The scripts are the developer-facing entry points and work
without `make`; the Makefile is a convenience layer over them, not a second
implementation that can drift.

---

## Rules for Editing the Makefile

1. **Target Prefixing**
   - Every project-specific rule starts with `<project>-`.
   - Workspace-wide gates stay unprefixed.

2. **Declaration & Phony**
   - Always register targets in `.PHONY`:
   ```makefile
   .PHONY: api-build api-run check clean
   ```

3. **Argument Passing**
   - Use `ARGS ?=` to allow parameters from the CLI:
   ```makefile
   api-test:
   	$(NPM) run test -w @vidya/api -- $(ARGS)
   ```

4. **No Duplicated Logic**
   - A target either delegates to an npm script or to a file in `scripts/`. It
     does not reimplement either.

---

## How to Use the Makefile

```bash
# Install workspace dependencies
make install

# Full quality gate — the mandatory pre-submit command
make check

# Individual gates for a fast inner loop
make typecheck
make lint
make lint-fix
make format
make test

# API
make api-build
make api-run
make api-test

# Database
make db-run
make db-migrate
make db-migrate-generate
make seed
make db-drop

# Clean build artifacts
make clean
```
