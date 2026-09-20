-- Every security-relevant action leaves a row here: who did it (or tried to),
-- what they did, what it touched, and when. TypeORM's query log was the only
-- trace before this and was turned off by default (#26), so this table is now
-- the one source for "what did an attacker reach, and for how long".
--
-- No foreign keys to "users" or "schools": a row must outlive the account or
-- school it describes, same reasoning as "sync_journal". A failed sign-in in
-- particular has a login but no user at all, which is why actorLogin and
-- actorUserId are separate nullable columns rather than one.
--
-- This table only grows; nothing here deletes old rows. A time-based
-- retention sweep is the natural next step and is not implemented yet.

CREATE TABLE "audit_log" (
  "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
  "action"         character varying NOT NULL,
  "actorUserId"    uuid,
  "actorLogin"     character varying,
  "subjectType"    character varying,
  "subjectId"      uuid,
  "schoolId"       uuid,
  "sourceAddress"  character varying,
  "payload"        json NOT NULL DEFAULT '{}',
  "occurredAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_audit_log" PRIMARY KEY ("id")
);

-- "What did this actor do, and when" is the paradigmatic investigation query.
CREATE INDEX "idx_audit_log_actorUserId_occurredAt" ON "audit_log" ("actorUserId", "occurredAt");

-- A flood of failed sign-ins under one login has no actorUserId to search by.
CREATE INDEX "idx_audit_log_actorLogin" ON "audit_log" ("actorLogin");

-- Chronological scans, and the range scan a future retention sweep needs.
CREATE INDEX "idx_audit_log_occurredAt" ON "audit_log" ("occurredAt");
