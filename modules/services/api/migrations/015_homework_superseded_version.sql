-- Set when a student answered a version that was no longer the published one.
-- The work is still accepted — nobody is penalised for an edit made while they
-- were offline — but the reviewer is told, and can open the version actually
-- answered.

ALTER TABLE "homework"
  ADD COLUMN "answeredSupersededVersion" boolean NOT NULL DEFAULT false;
