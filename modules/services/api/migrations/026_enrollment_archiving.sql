-- Both sides put a finished request away, and neither touches the other's
-- stamp: a student who was revoked keeps seeing why until they clear it
-- themselves, however long ago the school closed the row on its own screens.
--
-- Only the student's stamp travels to a device; the school's two stay here.

ALTER TABLE "enrollments" ADD COLUMN "archived_by_student_at" TIMESTAMPTZ;
ALTER TABLE "enrollments" ADD COLUMN "archived_by_school_at" TIMESTAMPTZ;
ALTER TABLE "enrollments" ADD COLUMN "archived_by_school_by_id" uuid;
