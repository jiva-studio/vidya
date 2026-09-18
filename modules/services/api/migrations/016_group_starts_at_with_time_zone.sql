-- "startsAt" was the one TIMESTAMP in a schema of TIMESTAMPTZ.
--
-- Without a zone Postgres keeps the wall-clock digits and discards the offset,
-- so a lesson set for 09:00 by a school in Moscow reads as 09:00 in Lisbon.
--
-- No USING clause: nothing has ever written this column — it appears in the
-- entity and nowhere else, with no DTO, no route and no seed touching it — so
-- there are no values to reinterpret. pg-mem also cannot parse USING, and a
-- migration that only runs against one of the two test backends is not tested.

ALTER TABLE "groups" ALTER COLUMN "startsAt" TYPE TIMESTAMPTZ;
