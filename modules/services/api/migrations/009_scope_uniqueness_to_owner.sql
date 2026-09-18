-- Course names and lesson numbers were globally unique, so two schools could not
-- both run a course called "Bhakti-shastri" and two courses could not both have a
-- lesson 1. Uniqueness belongs inside the owner, not across the whole system.

ALTER TABLE "courses" DROP CONSTRAINT "UQ_6ba1a54849ae17832337a39d5e5";
ALTER TABLE "courses" ADD CONSTRAINT "UQ_courses_school_name" UNIQUE ("schoolId", "name");

ALTER TABLE "lessons" DROP CONSTRAINT "UQ_efedd42f0ac45c4a7ddb6fd2f20";
ALTER TABLE "lessons" DROP CONSTRAINT "UQ_3dad32ba0ff20feee98b1b0c43d";
ALTER TABLE "lessons" ADD CONSTRAINT "UQ_lessons_course_number" UNIQUE ("courseId", "lessonNumber");
