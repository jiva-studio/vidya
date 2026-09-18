-- Migration 009 scoped course names and lesson numbers to their owner and left
-- groups behind, so "Morning group" could exist once in the entire system.
--
-- Two schools that never hear of each other could not both run a group by the
-- same obvious name, and the second one to try got a 500. A group belongs to a
-- course, so that is where its name has to be unique.

ALTER TABLE "groups" DROP CONSTRAINT "UQ_664ea405ae2a10c264d582ee563";
ALTER TABLE "groups" ADD CONSTRAINT "UQ_groups_course_name" UNIQUE ("courseId", "name");
