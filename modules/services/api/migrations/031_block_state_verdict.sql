-- What the server says about an answer.
--
-- Nullable because it is written when the answer is marked, and a block a
-- student only watched is never marked at all. The client never writes here:
-- the field belongs to the server in the ownership table.

ALTER TABLE "block_states" ADD COLUMN "verdict" json;
