-- Courses gain a draft state: only published ones appear in a school's catalogue.
--
-- Two defaults in a row on purpose: the first one backfills the courses that
-- already exist, which their schools have been showing all along, and the
-- second decides what a course created from here on starts as.

ALTER TABLE "courses" ADD COLUMN "status" character varying NOT NULL DEFAULT 'published';

ALTER TABLE "courses" ALTER COLUMN "status" SET DEFAULT 'draft';

ALTER TABLE "courses" ADD CONSTRAINT "CK_courses_status"
  CHECK ("status" IN ('draft', 'published'));
