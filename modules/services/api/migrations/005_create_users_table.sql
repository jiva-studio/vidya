CREATE TABLE "users" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" character varying,
  "email" character varying NULL,
  "phone" character varying NULL,
  CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_8cf21de8c29e0c6409031a354f" CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX "unique_lower_email_idx" ON "users" (LOWER("email"));
CREATE UNIQUE INDEX "IDX_a000cca60bcf04454e72769949" ON "users" ("phone");
