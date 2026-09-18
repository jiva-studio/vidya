.PHONY: install check typecheck lint lint-fix format format-check test test-postgres \
        api-build api-run api-test db-run db-drop db-migrate db-migrate-generate seed clean \
        dev dev-up dev-down dev-logs mail bootstrap storybook

NPM := npm --prefix modules

# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------

install:
	$(NPM) install

# The single gatekeeper. Chains typecheck, lint, format and tests across every
# workspace in modules/. Run this before marking any coding task complete.
check:
	$(NPM) run check

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
	$(NPM) run test

# The same suite against a real Postgres, plus the cases the in-memory database
# cannot model at all — advisory locks, real constraints under concurrency.
# Needs a server; see VIDYA_TEST_DB_* for where to find it.
test-postgres:
	VIDYA_TEST_DB=postgres $(NPM) run test

# ---------------------------------------------------------------------------
# API service
# ---------------------------------------------------------------------------

api-build:
	$(NPM) run build -w @vidya/api

api-run:
	$(NPM) run start:dev -w @vidya/api

api-test:
	$(NPM) run test -w @vidya/api

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

db-run:
	./scripts/vidya-db-run

db-drop:
	./scripts/vidya-db-drop

# Migrations are applied by the API at startup; this target exists for the case
# where you want the schema without running the service.
db-migrate:
	./scripts/vidya-db-migrations-run

seed:
	$(NPM) run seed -w @vidya/seeder

# ---------------------------------------------------------------------------
# Local stand
# ---------------------------------------------------------------------------
#
#   780x  infrastructure   7800 postgres · 7801 redis · 7802 smtp · 7803 mail ui
#   781x  applications     7810 api · 7811 admin · 7812 storybook

COMPOSE := docker compose -f docker-compose.dev.yml
MAIL_UI := http://localhost:7803

export VIDYA_DB_PORT      := 7800
export VIDYA_REDIS_PORT   := 7801
export VIDYA_MAILER_PORT  := 7802
export VIDYA_API_PORT     := 7810
export VIDYA_ADMIN_PORT   := 7811
export VIDYA_SB_PORT      := 7812
export VIDYA_API_URL      := http://localhost:7810

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
