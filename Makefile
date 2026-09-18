.PHONY: install \
        check check-package typecheck lint lint-fix format format-check \
        test test-package test-postgres-required test-postgres \
        mutate-diff mutate-full \
        api-build api-run api-test \
        db-start db-schema-drop db-migrate db-migrate-generate db-testdb-drop \
        seed clean

NPM := npm --prefix modules

# Narrows the per-workspace targets. Example:
#   make check-package PKG=@vidya/api
PKG ?= @vidya/api

# Extra arguments handed to the underlying test runner. Example:
#   make test-package PKG=@vidya/api ARGS='--testPathPattern edu'
ARGS ?=

# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------

install:
	$(NPM) install

# ---------------------------------------------------------------------------
# Quality gate
#
# `check` is the gate: typecheck, lint, format and tests over every workspace.
# It is what CI runs and what a branch must pass before it is merged.
#
# `check-package` is the inner loop: the same four stages, one workspace. Use it
# while working; it does not replace `check`, because a package's own tests say
# nothing about the packages that import it.
# ---------------------------------------------------------------------------

check:
	$(NPM) run check

check-package:
	./scripts/vidya-workspace-check $(PKG)

typecheck:
	$(NPM) run typecheck

lint:
	$(NPM) run lint

lint-fix:
	$(NPM) run lint:fix

format:
	$(NPM) run format

format-check:
	$(NPM) run format:check

test:
	./scripts/vidya-test-suite-run memory

test-package:
	$(NPM) run test -w $(PKG) --if-present -- $(ARGS)

# Only the suites that a real database is required for: the properties pg-mem
# cannot model, such as advisory locking under concurrency. Fast, and part of
# what a branch must pass.
test-postgres-required:
	./scripts/vidya-test-suite-run postgres-required

# Every suite, with a real Postgres behind it instead of pg-mem. Broader and
# slower; run it by hand or on a schedule, not per change.
test-postgres:
	./scripts/vidya-test-suite-run postgres

# ---------------------------------------------------------------------------
# Mutation testing
#
# Coverage says a line ran. Mutation testing says the suite noticed. `mutate-diff`
# only mutates what the branch changed and is the one to run per change;
# `mutate-full` re-measures a whole package and is for a schedule.
# ---------------------------------------------------------------------------

mutate-diff:
	./scripts/vidya-mutation-suite-run diff $(PKG)

mutate-full:
	./scripts/vidya-mutation-suite-run full $(PKG)

# ---------------------------------------------------------------------------
# API service
# ---------------------------------------------------------------------------

api-build:
	$(NPM) run build -w @vidya/api

api-run:
	$(NPM) run start:dev -w @vidya/api

api-test:
	$(NPM) run test -w @vidya/api -- $(ARGS)

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

db-start:
	./scripts/vidya-db-server-start

db-schema-drop:
	./scripts/vidya-db-schema-drop

# Migrations are applied by the API at startup; this target exists for the case
# where you want the schema without running the service.
db-migrate:
	./scripts/vidya-db-migrations-apply

# Drops the databases the test suite created. Each checkout reuses one database,
# so this is for reclaiming the ones left by worktrees that no longer exist.
db-testdb-drop:
	./scripts/vidya-db-testdb-drop

seed:
	$(NPM) run seed -w @vidya/seeder

# ---------------------------------------------------------------------------
# Housekeeping
# ---------------------------------------------------------------------------

clean:
	rm -rf modules/node_modules modules/*/*/dist modules/*/*/*.tsbuildinfo
