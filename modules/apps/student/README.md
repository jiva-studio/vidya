# @vidya/student

The student's site: one origin, one server, and the same local database and
sync engine the handset runs.

```sh
make dev                       # the API and both front ends
npm run dev -w @vidya/student  # this site alone, on :7814
```

What is particular to this application, as opposed to the console:

- **The data comes from the local database, not from REST.** `@vidya/client`
  holds the ports, the scenarios, the SQL repositories and the device
  migrations; `src/app/` is the composition root that wires them to a browser.
- **SQLite runs as WebAssembly** (`sql.js`) with its image in IndexedDB, which
  is why `index.html` carries a policy of its own.
- **One tab writes.** The writing tab is elected with the Web Locks API; the
  others read.
- **Nothing but signing in talks HTTP.** `src/app/__tests__/networkBoundary.spec.ts`
  walks the sources and fails if anything else names a transport.
