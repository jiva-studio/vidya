# ADR 003: School Storage Profiles

A school keeps its files in object storage, and the credentials that reach that
storage are a third party's secret we are asked to hold. `032_storage_profiles.sql`
is where that lives, and the shape of the table is the decision this records.

## Decision

### A profile is written once and never edited

New credentials mean a new row: the previous one gets `retiredAt` and the school
points at the new one through `schools."currentStorageProfileId"`. Files already
uploaded name the profile that wrote them, so a rotation leaves them readable
instead of orphaning everything the school has published.

A school has at most one live profile, and the database is what says so —
`UQ_storage_profiles_live_per_school`, unique on `"schoolId"` where
`"retiredAt" IS NULL`. Two people rotating at the same moment therefore end with
one live row and one refusal (`storage-rotation-conflicted`, 409), rather than a
school lent two buckets.

The plain `IDX_storage_profiles_school` index stays beside it: the partial index
covers only the live row, and reading a school's retired profiles — which is what
resolving an old file does — is a lookup the partial index cannot serve.

### The provider is named, and the address derived from it wherever it can be

`s3.<region>.amazonaws.com`, `<region>-s3.storage.bunnycdn.com`,
`<account>.r2.cloudflarestorage.com`. A school picks its provider and types keys,
never a URL. Only `s3-compatible` carries an `endpoint` of its own, and that is
the single case the SSRF allowlist has to police: a free-form address is one the
API dials from inside its own network. Credentials written in front of the host
(`https://user:password@host`) are refused at the door — the SDK strips them
before dialling, so they would be a password sitting in a column that is read
back to anyone with `storage:read` and repeated into the audit trail.

### The sealed keys are one document, not six columns

`secrets` is a `json` envelope — `{ keyVersion, dek, secret, tokenSecret }`, each
sealed value carrying its own nonce, the school and profile ids as AES-GCM
additional data. What is sealed is one envelope: a data key wrapped under the
installation's master key, and under it the storage secret and the CDN token
secret. Splitting it across the schema would spread one encryption over six
columns that must be written and read together or not at all. Base64 rather than
`bytea` because a raw buffer parameter is text to some of the drivers this schema
is read through, and text means UTF-8, which silently replaces every byte above
0x7F.

`keyVersion` names the master key that wrapped the data key, so two master keys
can be installed at once and every document opens under its own. Retiring the old
key needs a rewrap of the documents that name it, and no rewrap surface exists
yet — until one does, a rotation adds a key and never removes one.

### The installation's own bucket is a row, with `schoolId` null

A school that has brought no keys writes into the installation's bucket under
`school/<schoolId>`. That bucket is a real profile row rather than configuration
consulted at read time, because a file is read through the profile that wrote it:
a `media."profileId"` that meant "whatever the installation storage happened to
be" would break every read the day the installation rotates its own keys.

The row is created from configuration on first use — nothing writes a row for a
bucket nobody has touched — and it needs its own partial unique index,
`WHERE "schoolId" IS NULL AND "retiredAt" IS NULL`, because Postgres treats nulls
as distinct and the per-school index would permit any number of installation
rows.

What a school is told about that bucket is only that it is lent one: the view
carries `lent: true` and the school's own prefix, and no endpoint, bucket name,
key id or secret tail. An installation bucket reachable by every school that
happens to store in it is not a bucket we are holding in trust.

### What the table does not hold

- **How much a school has stored.** That is `SUM("sizeBytes")` over its ready
  files. A counter here is read from the live profile and written by the profile
  that stored the file, so a key rotated on the same bucket resets it; and a
  stored counter earns its keep at millions of rows, not at a school library's
  thousands.
- **What a school may store.** The ceiling is policy and lives in
  `school_storage_quotas`, beside the school rather than on a row that is replaced
  on every rotation. It is a `bigint`, and a value past `Number.MAX_SAFE_INTEGER`
  is refused on the way in and on the way out (`storage-quota-unreadable`, 409)
  rather than answered as a number it is not.
- **The video provider.** A transcoding library is a second vendor relationship,
  not a bucket's credentials, and it gets its own table when one is needed.
