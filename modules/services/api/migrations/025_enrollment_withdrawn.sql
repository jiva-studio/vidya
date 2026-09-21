-- A student may hand the place back themselves, which is a fifth status the
-- CHECK constraint predates.

ALTER TABLE "enrollments" DROP CONSTRAINT "CK_enrollments_status";
ALTER TABLE "enrollments" ADD CONSTRAINT "CK_enrollments_status"
  CHECK ("status" IN ('pending', 'accepted', 'declined', 'revoked', 'withdrawn'));
