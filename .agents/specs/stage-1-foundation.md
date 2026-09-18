# 📋 Task Specification: Stage 1 — Teaching API

**Branch / Worktree**: `stage-1-foundation`
**Status**: `IN_PROGRESS`
**Target Modules**: `modules/libs/domain`, `modules/libs/entities`, `modules/libs/protocol`, `modules/services/api`

---

## 1. Business Context & User Value (JTBD)

### Problem Statement & Trigger

- **Trigger**: v1 is "one school runs one course end to end". Nothing on that path
  can be built yet, because the data it runs on does not exist.
- **Pain Point**: three gaps block every downstream stage at once.
  `lessons.content` is a `json` column typed as an empty placeholder, so a lesson
  cannot hold anything. There is no `enrollments` table, so nobody can join a
  course. There is no homework anywhere in the system — it existed only as a
  client-side aggregate in the archived Classroom mobile app and never had a
  server.
- **Current Workaround**: none. The API serves schools, roles and users; the
  teaching half of the product has tables for courses, groups and lessons that
  no endpoint reads and no model describes.

### User Journey & Workflow (Before vs After)

- **Before**: a developer starting the courses API has to invent the lesson
  content shape, the enrollment lifecycle and the homework lifecycle inline,
  and hand-write a TypeORM migration class per change while a second hardcoded
  datasource applies them.
- **After**: the contracts exist in `@vidya/protocol`, the schema exists in
  Postgres, and applying migrations is a plain `.sql` file plus a runner the API
  executes at startup. Stage 2 writes endpoints against a settled model.

### Value & Success Criteria

- **Primary Value Delivered**: stages 2 through 6 stop being blocked, and the
  data model stops being decided ad hoc inside whichever endpoint is written first.
- **Observable Verification**: a fresh, empty Postgres reaches the full v1 schema
  by starting the API and nothing else, and `make check` passes.

---

## 2. Goals, Non-Goals & Scope Guardrails (The 80/20 Rule)

The API already serves `auth`, `edu/schools`, `edu/roles` and `edu/users` on
eight migrations. This stage adds the teaching half and the mechanism that
applies schema changes.

### In-Scope Goals

- Migration mechanism: hand-written `.sql`, applied by the API at startup, with
  the eight existing migrations converted and `services/database` dissolved.
- Lesson content model — sections and typed blocks — declared in `@vidya/protocol`.
- Lesson versioning: content belongs to an immutable published version, not to
  the lesson row.
- Schema and entities for `lesson_versions`, `enrollments`, `homework`, `block_states`.
- Endpoints, following the shape the existing `edu` controllers already use:
  `edu/courses`, `edu/lessons` (with draft/publish), `edu/groups`,
  `edu/enrollments` (with moderation), `edu/homework` (submit, review, grade).
- Permission keys for courses, lessons, groups, enrollments and homework, scoped
  by school like the existing ones.
- Quiz auto-grading on submit.
- Correct the inverted JWT token lifetimes.
- NestJS 10 → 11 and Node 22.

### Non-Goals (Strict Scope Boundaries / Anti-Rabbit-Holes)

- **No sync engine.** `outbox`, `sync_state`, HLC and the pull/push endpoints
  are Stage 2. Only the `schoolId` column that synced rows will need is added
  now, so Stage 2 never has to migrate databases already on devices.
- **No client work.** No `libs/ui`, no admin panel, no lesson editor, no mobile.
  Frontend package versions are chosen when those packages are created; the
  Ionic and Capacitor upgrade belongs to the mobile stage.
- **No media storage.** Video is embed-only in v1, so the `source` discriminator
  is declared but no upload, signed URL or download queue is built.
- **No seed data** for the new tables.

---

## 3. Observable Acceptance Criteria (AC)

- [ ] **AC-1**: Starting the API against an empty Postgres creates every v1 table
      and records each applied file in `schema_migrations`. Starting it a second
      time applies nothing and logs nothing new.
- [ ] **AC-2**: The migration runner acquires a **session-scoped** Postgres
      advisory lock on a dedicated non-pooled connection, and releases it even
      when a migration throws.
- [ ] **AC-3**: A migrations directory that resolves to zero files fails
      startup with a named error. It never reports success.
- [ ] **AC-4**: Each `.sql` file applies inside its own transaction: a file that
      fails midway leaves no partial objects, and previously applied files stay
      applied.
- [ ] **AC-5**: Migrations run to completion before `app.listen()` — the process
      never serves a request against an unmigrated schema.
- [ ] **AC-6**: `@vidya/protocol` exports the lesson content model: a section
      carries a stable id and an ordered list of blocks; a block is a discriminated
      union of `text`, `video`, `audio`, `quiz`; a video block carries a `source`
      discriminator distinguishing embedded from downloadable.
- [ ] **AC-7**: `lesson_versions` holds the content; `lessons` no longer has a
      `content` column. A version is `draft` or `published`, and a published
      version is never updated in place.
- [ ] **AC-8**: `homework` references the `lesson_version` it was answered
      against, not the lesson, and carries the section id it answers.
- [ ] **AC-9**: `enrollments` allows a null `groupId`, so a student can be
      enrolled on a course before any group exists.
- [ ] **AC-10**: `PermissionKeys` includes create/read/update/delete for courses,
      lessons and groups, plus `enrollments:moderate` and `homework:grade`.
- [ ] **AC-11**: The refresh token's lifetime is strictly greater than the access
      token's, and a unit test asserts that ordering rather than the literal values.
- [ ] **AC-12**: `services/database` no longer exists as a workspace, and no
      database connection string is hardcoded anywhere.
- [ ] **AC-13**: `make check` exits 0, and the 78 existing tests still pass.

---

## 4. Technical Risks, Failure Modes & Edge Cases

| Risk / Failure Vector | Impact | Mitigation Strategy in Code |
| :--- | :---: | :--- |
| **Advisory lock taken on a pooled connection** | High | The runner opens its own `pg.Client`, never the app pool: a session lock acquired on one pooled session and released on another silently locks nothing. Asserted by a test that runs two runners concurrently. |
| **Migrations directory missing from the image** | High | Path comes from `VIDYA_MIGRATIONS_DIR`; zero resolved files is a fatal startup error (AC-3). Without this the API starts, reports success and dies on the first query. |
| **pg-mem cannot parse production DDL** | High | pg-mem backs the existing suite but is not Postgres. If a `.sql` file fails only there, the runner is tested against real Postgres in CI and pg-mem keeps serving the domain tests — the runner's tests do not silently weaken to match the fake. |
| **Dropping `lessons.content`** | Medium | No data exists — nothing is deployed and there have been no releases — so the conversion moves the column into `lesson_versions` without a data migration. Recorded here so it is not mistaken for an oversight later. |
| **Content JSON without stable ids** | High | Section and block ids are required, generated at authoring time and never reused. Homework and block state reference them, so an id assigned at render time or an array index would orphan every submitted answer on the next edit. |
| **Startup migration blocks readiness** | Medium | Migrations run before `listen()` by design (AC-5). A long migration delays readiness rather than serving a half-migrated schema; the health check simply is not up yet. |
| **`schoolId` omitted from synced rows** | Medium | `homework` and `block_states` carry `schoolId` now. Adding it in Stage 3 would mean migrating databases already on user devices. |
| **Enum drift between DB and protocol** | Medium | Homework and enrollment statuses are declared once in `@vidya/domain` and referenced by both the migration and the entity, so a new status cannot be added to one side only. |

---

## 5. Blast Radius & Target Files

| File | Action | Purpose & Scope |
| :--- | :---: | :--- |
| `modules/libs/protocol/lessons.ts` | `CREATE` | Section and block model, block-state model, discriminated unions |
| `modules/libs/protocol/enrollments.ts` | `CREATE` | Enrollment wire contract and status |
| `modules/libs/protocol/homework.ts` | `CREATE` | Homework wire contract, status, grade |
| `modules/libs/protocol/index.ts` | `MODIFY` | Re-export the three new modules |
| `modules/libs/domain/permissions/index.ts` | `MODIFY` | Add course, lesson, group, enrollment, homework keys |
| `modules/libs/domain/lifecycle.ts` | `CREATE` | Enrollment and homework status enums, shared by schema and entities |
| `modules/libs/entities/lessonVersion.ts` | `CREATE` | Entity for the versioned content |
| `modules/libs/entities/enrollment.ts` | `CREATE` | Entity |
| `modules/libs/entities/homework.ts` | `CREATE` | Entity |
| `modules/libs/entities/blockState.ts` | `CREATE` | Entity |
| `modules/libs/entities/lesson.ts` | `MODIFY` | Drop `content`; it moves to the version |
| `modules/libs/entities/index.ts` | `MODIFY` | Register the new entities |
| `modules/services/api/migrations/001…008_*.sql` | `CREATE` | The eight existing migrations, SQL lifted out of the TypeORM wrappers |
| `modules/services/api/migrations/009_lesson_versions.sql` | `CREATE` | New |
| `modules/services/api/migrations/010_enrollments.sql` | `CREATE` | New |
| `modules/services/api/migrations/011_homework.sql` | `CREATE` | New |
| `modules/services/api/migrations/012_block_states.sql` | `CREATE` | New |
| `modules/services/api/src/shared/migrations/runner.ts` | `CREATE` | Lock, transaction per file, `schema_migrations`, fatal on empty |
| `modules/services/api/src/shared/migrations/__specs__/runner.spec.ts` | `CREATE` | Idempotency, empty-directory failure, concurrent runners, rollback |
| `modules/services/api/src/shared/migrations/index.ts` | `CREATE` | Barrel |
| `modules/services/api/src/configs/migrations.config.ts` | `CREATE` | `VIDYA_MIGRATIONS_DIR` |
| `modules/services/api/src/configs/jwt.config.ts` | `MODIFY` | Invert the token lifetimes |
| `modules/services/api/src/configs/__specs__/jwt.config.spec.ts` | `CREATE` | Assert refresh outlives access |
| `modules/services/api/src/main.ts` | `MODIFY` | Run migrations before `listen()` |
| `modules/services/api/Dockerfile` | `CREATE` | Copy `migrations/` into the image |
| `modules/services/database/**` | `DELETE` | Workspace dissolves; migrations move, entities already live in `libs/entities` |
| `modules/package.json` | `MODIFY` | Drop the removed workspace |
| `Makefile` | `MODIFY` | `db-migrate` targets now point at the API |
| `docs/PLAN.md` | `MODIFY` | Mark stage 1 delivered |

---

## 6. Phased Execution Plan

### Phase 1: Test-Driven Red Phase (Failing Test First)

- [ ] **Step 1.1**: Author `runner.spec.ts` asserting idempotency, fatal-on-empty,
      transaction rollback and concurrent-runner safety.
- [ ] **Step 1.2**: Author `jwt.config.spec.ts` asserting refresh outlives access.
- [ ] **Step 1.3**: Run the suite and verify a non-zero exit code.

### Phase 2: Implementation (Green Phase)

- [ ] **Step 2.1**: Implement the runner: dedicated client, session advisory lock,
      `schema_migrations`, transaction per file, fatal on zero files.
- [ ] **Step 2.2**: Invert the token lifetimes.
- [ ] **Step 2.3**: Convert the eight TypeORM migrations to `.sql`, lifting the SQL
      out of `queryRunner.query()` unchanged.
- [ ] **Step 2.4**: Write migrations 009–012.
- [ ] **Step 2.5**: Declare the protocol models and the shared status enums.
- [ ] **Step 2.6**: Add the entities; drop `content` from `Lesson`.
- [ ] **Step 2.7**: Run the suite and verify a zero exit code.

### Phase 3: Wiring & Integration (Anti-Orphan Phase)

- [ ] **Step 3.1**: Re-export new protocol modules from `libs/protocol/index.ts`
      and new entities from `libs/entities/index.ts`.
- [ ] **Step 3.2**: Call the runner from `main.ts` before `app.listen()`.
- [ ] **Step 3.3**: Copy `migrations/` in the Dockerfile; resolve the path from config.
- [ ] **Step 3.4**: Delete `services/database`, update `modules/package.json` and
      the Makefile targets.
- [ ] **Step 3.5**: Start the API against an empty database and confirm the full
      schema appears, then restart and confirm nothing is reapplied.

### Phase 4: Cleanliness & Gatekeeper

- [ ] **Step 4.1**: No `TODO`, no stub returns, no hardcoded connection strings.
- [ ] **Step 4.2**: Run the gate.

---

## 7. Verification Gate (Final Command)

```bash
make check
```
