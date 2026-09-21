# Media Usage Tracking

Which files a lesson version points at is kept in `media_usages`
(`modules/services/api/migrations/034_media_usages.sql`). The table is the
answer to "may this file be deleted", so deleting a file is a `SELECT` on one
index rather than a walk over the JSON of every version ever saved.

## How it is written

The rows are written by the save that stores a version's content, in that
save's own transaction. The content is parsed, every `/media/<id>` address in
it is collected, and the difference against what the version held a moment ago
is applied. A save that names a file the school does not have is refused, and
because the two writes share one transaction the refusal takes the content with
it.

Two consequences follow from that, and both are why the transaction matters:

- a row that outlived its block would keep a file undeletable forever;
- a row lost while the content was stored would let a published lesson lose its
  illustration to the next deletion.

There is one row per file per version, however many blocks show it. The only
question ever asked of the table is whether anything still points at a file;
counting blocks would answer a question nobody has.

An address lives in more than one field of a block: a video block carries both
its video and its poster. The fields that hold an address are declared once, in
`modules/services/api/src/edu/services/mediaInContent.ts`, and a block kind that
grows a text field nobody classified stops the suite compiling.

## Why the foreign keys differ

- `mediaId` is `ON DELETE RESTRICT`. The row exists to refuse the deletion of a
  file a lesson shows, so the database has to refuse one the application forgot
  to check. The API translates that refusal into `409 media-in-use`.
- `lessonVersionId` is `ON DELETE CASCADE`. A version that is gone points at
  nothing.

## How a deletion uses it

`DELETE /media/:id` names the lessons that hold the file and refuses if there
are any. The row is then archived (`status = 'archived'`), the object removed,
and only then is the row dropped — in that order, because occupancy is summed
from `ready` rows alone, so a school stops being charged the moment the row is
archived and no intermediate state leaves it paying for bytes nobody can see.
The archiving statement carries the usage check in its own `WHERE`, so a save
committing between the check and the deletion cannot lose its illustration.

A deletion interrupted between the archiving and the object leaves an
`archived` row whose object is still stored. Nothing else notices it — the bytes
are no longer charged for — so the hourly sweep
(`modules/services/api/src/media/services/mediaSweep.service.ts`) takes
`archived` rows as well as `pending` ones and finishes the work.
