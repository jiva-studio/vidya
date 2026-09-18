# @vidya/mobile

The student application: Ionic + Capacitor + Vue 3.

## Layout

    src/
    ├── app/         composition root — the HTTP client and the session
    ├── config/      what the app reads from its environment
    ├── ports/       interfaces the app needs from the outside world
    ├── infra/       adapters that implement them
    ├── usecases/    what a student does, written against the ports
    ├── design/      presentation primitives, no domain and no transport
    └── ui/          feature slices: auth, education, settings

Dependencies point one way: `ui` → `usecases` → `ports`, with `infra` plugged in
at `app/`. An adapter never imports another adapter.

## Running it

The app talks to `@vidya/api` over REST. There is no local database and no
offline mode yet — without a network there is no data.

    make dev            # in the repository root: API, database, seed data
    npm --prefix modules run dev -w @vidya/mobile

`VITE_API_BASE_URL` points it elsewhere; it defaults to `http://localhost:8080`.

## Checks

    npm --prefix modules run check

Runs the whole workspace: types, lint, format and tests. The app is not excluded
from any of it.
