-- What the student asked for, beside what the school answered. `groupId` is the
-- placement; these three are the wish that preceded it.
--
-- No ON DELETE SET NULL on the preferred group: a cascade is plain SQL inside
-- Postgres and the sync journal is written by the entity subscriber, so a
-- cascade would clear the column on every device's behalf without journalling
-- one row. The nulling goes through the service, before the group is deleted.

ALTER TABLE "enrollments" ADD COLUMN "preferred_group_id" uuid;
ALTER TABLE "enrollments" ADD COLUMN "preferred_times" jsonb;
ALTER TABLE "enrollments" ADD COLUMN "comment" character varying;

ALTER TABLE "enrollments" ADD CONSTRAINT "FK_enrollments_preferred_group"
  FOREIGN KEY ("preferred_group_id") REFERENCES "groups"("id");
