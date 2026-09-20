# @vidya/mobile

The student application: Ionic + Capacitor + Vue 3.

The app reads from the handset, not from the network. A sync engine fills a
local SQLite database and carries the student's own writes back up; every screen
reads that database, so the catalogue, a course, a lesson and the student's own
places all open in a tunnel. Two things still go out to a server — signing in,
and the engine itself.

## Layout

    src/
    ├── app/         composition root: the device, the connections, the engines
    ├── config/      what the app reads from its environment
    ├── ports/       interfaces the app needs from the outside world
    ├── infra/       adapters that implement them
    ├── usecases/    what a student does, written against the ports
    ├── shared/      composables every slice may use
    ├── design/      presentation primitives, no domain and no transport
    └── ui/          feature slices: auth, education, sync, settings

Dependencies point one way: `ui` → `usecases` → `ports`, with `infra` plugged in
at `app/`. An adapter never imports another adapter.

### `app/`

Everything that has to be decided once, and the small amount of state a screen
is allowed to ask the running app for.

| Module                | What it owns                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `device.ts`           | Opens the SQLite database and runs the device migrations before the first screen is mounted.                                         |
| `connections.ts`      | The servers this handset is signed in to: address, identity, session. A student can study at schools that live on different servers. |
| `sync.ts`             | One engine per connection, and the four triggers that run it: launch, the network returning, a local write, pull-to-refresh.         |
| `deviceRuns.ts`       | One queue of runs per database, and the release of the SQLite lock when the app goes into the background.                            |
| `haltedSyncClient.ts` | Stops the wire the moment the device asks for its database back, so no request is made by an app already being put to sleep.         |
| `deviceSync.ts`       | Starts an engine for every connection held at launch.                                                                                |
| `repositories.ts`     | The device as the screens read and write it, taken from the running engine so that every write is journaled.                         |
| `syncStatus.ts`       | Whether a run is going on, and whether one has ever finished.                                                                        |
| `outboxView.ts`       | How far each journaled row has travelled, asked per document.                                                                        |
| `endSessionOn401.ts`  | What a server's refusal of a token means: this connection needs a new sign-in, and no other is touched.                              |
| `startupFailure.ts`   | The one screen that does not need the database: the app could not create its schema.                                                 |

There is no module for the session: it lives in the connection it belongs to,
and the registry is the only place it is stored.

A screen reaches for `useRepositories()`, `useSyncStatus()` and
`useOutboxView()` and for nothing else here. It never builds a transport: a
client belongs to a server, and `clientForSignIn(baseUrl)` — the one exception,
for the exchange that happens before a connection exists — is handed out ready
made.

### `ui/sync`

The parts of the interface that exist because the data is replicated rather than
fetched: the first run filling the device, working offline, how far an answer
has got, a refusal from the school, lesson content this build cannot draw.

## Running it

The app talks to `@vidya/api`: to sign in, and to sync. Everything else it reads
from the device, so after one successful run it keeps working with the radio
off.

    make dev            # in the repository root: API, database, seed data
    npm --prefix modules run dev -w @vidya/mobile

`VITE_API_BASE_URL` points it elsewhere; it defaults to `http://localhost:8080`.

On a handset the database is Capacitor's SQLite. Anywhere else — the dev server,
the tests — it is `sql.js`, which keeps the database in memory and loses it on
reload; the web build is a development convenience and says so.

## Checks

    npm --prefix modules run check

Runs the whole workspace: types, lint, format and tests. The app is not excluded
from any of it.
