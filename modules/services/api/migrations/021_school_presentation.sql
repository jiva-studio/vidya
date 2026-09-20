-- A school reaches a student's device as a row of its own, and a card needs
-- more than a name to be worth drawing.

ALTER TABLE "schools" ADD COLUMN "logoUrl" character varying;
ALTER TABLE "schools" ADD COLUMN "description" character varying;
