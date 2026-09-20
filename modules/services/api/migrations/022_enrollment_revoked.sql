-- Losing a role in a school takes back every place it carried, which is a
-- fourth status the CHECK constraint predates.

ALTER TABLE "enrollments" DROP CONSTRAINT "CK_enrollments_status";
ALTER TABLE "enrollments" ADD CONSTRAINT "CK_enrollments_status"
  CHECK ("status" IN ('pending', 'accepted', 'declined', 'revoked'));
