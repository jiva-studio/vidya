-- Returning work without a word to read is a refusal a student cannot act on.
--
-- The grade becomes a percentage on the same statement: it was an unbounded
-- number, and automatic marking needs a scale both it and a reviewer agree on.

ALTER TABLE "homework" ADD COLUMN "comment" character varying;

ALTER TABLE "homework" ADD CONSTRAINT "CK_homework_grade_percentage"
  CHECK ("grade" IS NULL OR ("grade" >= 0 AND "grade" <= 100));
