.PHONY: install check typecheck lint lint-fix format format-check test \
        api-build api-run api-test db-run db-drop db-migrate db-migrate-generate seed clean

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
# Housekeeping
# ---------------------------------------------------------------------------

clean:
	rm -rf modules/node_modules modules/*/*/dist modules/*/*/*.tsbuildinfo
