CREATE TABLE "lessons" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "courseId" uuid NOT NULL, "lessonNumber" integer NOT NULL,
  "title" character varying NOT NULL,
  "content" json NOT NULL,
  CONSTRAINT "UQ_efedd42f0ac45c4a7ddb6fd2f20" UNIQUE ("lessonNumber"),
  CONSTRAINT "UQ_3dad32ba0ff20feee98b1b0c43d" UNIQUE ("title"),
  CONSTRAINT "PK_9b9a8d455cac672d262d7275730" PRIMARY KEY ("id")
);

ALTER TABLE "lessons"
  ADD CONSTRAINT "FK_1a9ff2409a84c76560ae8a92590"
  FOREIGN KEY ("courseId")
  REFERENCES "courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
