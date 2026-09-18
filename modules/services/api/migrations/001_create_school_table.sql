CREATE TABLE "schools" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "name" character varying NOT NULL,
  CONSTRAINT "PK_95b932e47ac129dd8e23a0db548" PRIMARY KEY ("id")
);
