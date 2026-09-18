-- How far each device has applied, as the device itself reports it.
--
-- This is not where a device reads from: the read positions are per scope and
-- live on the device. This is the input a future compaction of `sync_journal`
-- needs — a row may only be discarded once every device that follows it has
-- said it applied it — which is a property of the whole journal, so one number
-- per device is the right shape.
--
-- The key carries the user as well as the device because one phone is shared:
-- two accounts on one device follow the journal independently, and a shared
-- row would have one identity acknowledge the other's rows.

CREATE TABLE "sync_device_cursors" (
  "device_id"  TEXT        NOT NULL,
  "user_id"    uuid        NOT NULL,
  "acked_seq"  BIGINT      NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_sync_device_cursors" PRIMARY KEY ("device_id", "user_id")
);
