-- The code a joining link carries. Null until a school asks for one, so the
-- unique index has to skip the nulls rather than count them as equal.

ALTER TABLE "schools" ADD COLUMN "code" character varying(6);

CREATE UNIQUE INDEX "UQ_schools_code" ON "schools" ("code") WHERE "code" IS NOT NULL;
