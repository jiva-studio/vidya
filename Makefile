.PHONY: install \
        check check-package typecheck lint lint-fix format format-check \
        test test-package test-postgres-required test-postgres \
        coverage coverage-package \
        mutate-diff mutate-full \
        api-build api-run api-test \
        db-start db-schema-drop db-migrate db-testdb-drop \
        dev dev-up dev-down dev-logs mail storybook bootstrap \
        gateway-up gateway-down gateway-logs \
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
# Coverage
#
# What the suites never looked at, per workspace. It is a map of blind spots,
# not a score: nothing fails on a threshold here, because a number that must be
# met is a number that gets met by testing the easy half. Reports land in each
# package's own `coverage/`.
# ---------------------------------------------------------------------------

coverage:
	./scripts/vidya-coverage-run

coverage-package:
	./scripts/vidya-coverage-run $(PKG)

# ---------------------------------------------------------------------------
# Mutation testing
#
# Coverage says a line ran. Mutation testing says the suite noticed. `mutate-diff`
# only mutates what the branch changed and is the one to run per change;
# `mutate-full` re-measures a whole package. Hours. Run it on this machine,
# not on paid CI minutes.
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
# Local stand
# ---------------------------------------------------------------------------
#
#   780x  infrastructure   7800 postgres · 7801 redis · 7802 smtp · 7803 mail ui
#   781x  applications     7810 api · 7811 admin · 7812 storybook · 7813 gateway

COMPOSE := docker compose -f modules/docker-compose.dev.yml
MAIL_UI := http://localhost:7803

export VIDYA_DB_PORT      := 7800
export VIDYA_REDIS_PORT   := 7801
export VIDYA_MAILER_PORT  := 7802
export VIDYA_API_PORT     := 7810
export VIDYA_ADMIN_PORT   := 7811
export VIDYA_SB_PORT      := 7812
export VIDYA_API_URL      := http://localhost:7810

# Query logging defaults to off (see db.config.ts); set explicitly here so
# local dev keeps seeing SQL in the console instead of relying on a default
# that production needs to be off.
export VIDYA_DB_LOGGING   := true

# `configs/jwt.config.ts` refuses to start without a real secret — no fallback,
# generated or literal (see its comment for why). This is a fixture for the
# local stand only; anything beyond one developer's machine sets its own.
export VIDYA_JWT_SECRET   := local-dev-fixture-jwt-secret-do-not-use-elsewhere

dev-up:
	$(COMPOSE) up -d
	@echo ""
	@echo "  postgres  localhost:7800"
	@echo "  redis     localhost:7801"
	@echo "  smtp      localhost:7802"
	@echo "  mail ui   $(MAIL_UI)"
	@echo ""

dev-down:
	$(COMPOSE) down

dev-logs:
	$(COMPOSE) logs -f

# The mailbox every OTP code lands in.
mail:
	@xdg-open $(MAIL_UI) >/dev/null 2>&1 || echo "$(MAIL_UI)"

dev: dev-up
	$(NPM) run dev

# The admin, component by component and screen by screen, without API or database.
storybook:
	$(NPM) run storybook -w @vidya/admin

# The production shape, locally: one origin serving a built admin and proxying
# /api to the API on the host. Opt-in — see the `gateway` profile note in
# modules/docker-compose.dev.yml and modules/services/gateway/README.md — and
# not part of `dev`/`dev-up`, so the everyday Vite-proxy flow is unaffected.
# `api-run` or `dev` must already be serving the API for /api to answer.
gateway-up:
	$(COMPOSE) --profile gateway up -d --build gateway
	@echo ""
	@echo "  gateway   http://localhost:7813"
	@echo ""

gateway-down:
	$(COMPOSE) --profile gateway down

gateway-logs:
	$(COMPOSE) --profile gateway logs -f gateway

# One school, an owner role holding '*', and a user with that email. Idempotent,
# unlike `seed`, which truncates first and exists to fill an empty database.
bootstrap:
	@test -n "$(EMAIL)" || (echo "usage: make bootstrap EMAIL=you@example.com" && exit 1)
	$(NPM) run bootstrap -w @vidya/seeder -- --email $(EMAIL)

# ---------------------------------------------------------------------------
# Housekeeping
# ---------------------------------------------------------------------------

clean:
	rm -rf modules/node_modules modules/*/*/dist modules/*/*/*.tsbuildinfo
