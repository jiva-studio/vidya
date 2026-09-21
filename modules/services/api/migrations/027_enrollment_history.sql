-- A place on a course becomes a history: a student may take the same course
-- again, change their mind and ask again, or come back a year later. What must
-- stay unique is the live place, not the row.
--
-- The drop and the index are one migration, and the runner applies one file in
-- one transaction, so there is never a moment when nothing guards a second live
-- place.
--
-- The predicate names the live statuses of `LiveEnrollmentStatuses`; SQL cannot
-- import it, and the migration test is what keeps the two in step.

ALTER TABLE "enrollments" DROP CONSTRAINT "UQ_enrollments_course_student";

CREATE UNIQUE INDEX "UQ_enrollments_live_course_student"
  ON "enrollments" ("courseId", "studentId")
  WHERE "status" IN ('pending', 'accepted');
