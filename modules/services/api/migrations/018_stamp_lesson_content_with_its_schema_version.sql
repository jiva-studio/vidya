-- A published version is frozen and stays readable for as long as the answers
-- against it are worth keeping, which is longer than any one shape of the
-- document will last. Without a number on the document, a reader years from now
-- infers which rules produced it from whichever fields happen to be present, and
-- every future change to the block types becomes guesswork.
--
-- Stamped now because it is free now. Nothing has authored real content yet: the
-- API creates drafts holding the empty default, and the seeder does not touch
-- lesson versions at all. After the first school fills a course, this is a
-- rewrite of every row.
--
-- The backfill matches the old default literally rather than editing the
-- document, because jsonb_set does not exist in pg-mem and the test suite runs
-- these files verbatim. Matching the literal is enough precisely because no row
-- with authored sections can predate this migration.

ALTER TABLE "lesson_versions"
  ALTER COLUMN "content" SET DEFAULT '{"schemaVersion":1,"sections":[]}';

UPDATE "lesson_versions"
   SET "content" = '{"schemaVersion":1,"sections":[]}'
 WHERE "content"::text = '{"sections":[]}';
