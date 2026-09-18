-- The server's change log. Every synchronised write lands here as one row, and
-- `global_seq` is the cursor devices read the world by.
--
-- The addressee is stamped at write time (`scope_kind`, `scope_id`) rather than
-- computed at read time, so a pull is one index scan with no permission joins:
-- a row a device may not see was never addressed to it in the first place.
--
-- Column names are snake_case here, unlike the rest of the schema. This table is
-- read by hand-written SQL rather than through the ORM, and unquoted snake_case
-- is what survives being typed into psql.

CREATE TABLE "sync_journal" (
  "global_seq"  BIGSERIAL   NOT NULL,
  "collection"  TEXT        NOT NULL,
  "doc_id"      uuid        NOT NULL,
  "op"          TEXT        NOT NULL,  -- upsert | delete
  "data"        JSONB,                 -- NULL on delete
  "hlc"         TEXT        NOT NULL,
  "scope_kind"  TEXT        NOT NULL,  -- school | course | user
  "scope_id"    uuid        NOT NULL,
  "school_id"   uuid        NOT NULL,
  "device_id"   TEXT,                  -- NULL when the write did not come through sync
  "author_id"   uuid,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_sync_journal" PRIMARY KEY ("global_seq")
);

-- Idempotency. A retried push carries the same HLC, so the second insert is a
-- no-op rather than a duplicate delivered to every device on the scope.
CREATE UNIQUE INDEX "sync_journal_idempotency"
  ON "sync_journal" ("collection", "doc_id", "hlc");

-- The pull path: one scope, everything above the device's position, in order.
CREATE INDEX "sync_journal_pull"
  ON "sync_journal" ("scope_kind", "scope_id", "global_seq");
