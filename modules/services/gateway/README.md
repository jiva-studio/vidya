# gateway

The reverse proxy Vidya deploys behind: TLS termination (certificates
obtained and renewed automatically, no certbot, no sidecar), **two origins** —
the student site and the administration console — each serving its own build
and proxying its own `/api` to the API, the response headers that belong at
the edge rather than in an application, and a coarse rate limit. Caddy, driven
by one Caddyfile and a shell entrypoint — no application code.

Before this existed, nothing terminated TLS, so `Strict-Transport-Security`
had nowhere to be true (`configs/security-headers.config.ts`), the documents'
CSP could not carry `frame-ancestors` (a `<meta>` tag cannot express it — see
the comment in `apps/admin/index.html`), and nothing served the built
applications in production at all.

## Two origins

The student site answers on the bare domain and the console on its own host.
They are two sites in the Caddyfile, not two paths of one, and the reason is
not tidiness:

- **A browser shares `localStorage`, IndexedDB and Web Locks by origin — scheme,
  host and port — never by path.** On one origin, a scripting hole anywhere in
  the public student site reaches the console's refresh token, the local
  SQLite database and the lock that elects the writing tab. Two origins is the
  only boundary the browser itself enforces. `apps/admin/index.html` is written
  about exactly this token.
- **The two need different content security policies.** The student site
  compiles SQLite to WebAssembly and so needs `'wasm-unsafe-eval'` in
  `script-src`; the console has no use for it and must not be given it. One
  origin would mean one policy, the looser of the two.
- **The joining link needs the root.** `/j/<code>` is a route of the student
  site, and a path prefix under the console's host would put the console at the
  address people are handed.

The apex stays with the student site because a joining link is the address
spoken aloud. A cookie is never set on the parent domain: sibling hosts are
isolated in `localStorage` but all three would see a cookie set on
`.<domain>` — which is why the sessions here live in `localStorage` and not in
cookies.

Each site proxies its own `/api/*` to the same API, so both talk to a
same-origin path and neither needs CORS.

## Running it locally

The everyday dev flow is unaffected: `make dev` still runs both applications
through Vite's own dev servers and their own `/api` proxies, same as before
this existed — and on `:7811` and `:7814`, which are already two origins, so
the storage separation holds there too. The gateway is an _additional_,
opt-in way to exercise the production shape — two hosts, built bundles, a real
reverse proxy — against your own machine.

```bash
make api-run      # or `make dev`; something has to answer on VIDYA_API_PORT
make gateway-up   # builds both applications fresh and starts Caddy in front
```

Then open `http://localhost:7813` for the student site and
`http://localhost:7815` for the console. `make gateway-down` stops it,
`make gateway-logs` follows Caddy's access/error log.

The two hosts are two **ports** locally and two **names** in a deployment.
Ports are what the entrypoint already substitutes for the local stand, they
need no DNS, and they separate storage exactly as names do — an origin is
scheme, host _and_ port. Names on one port (`student.localhost`,
`admin.localhost`) would read closer to production but resolve by themselves
only in Chrome and Firefox, not in Safari.

`gateway-up` sits behind a docker-compose profile (`gateway`), so
`make dev-up`/`make dev` never start it — see the header comment in
`modules/docker-compose.dev.yml`. It runs at ports **7813** (student site) and
**7815** (console), in the `781x` application range after `7810` (api), `7811`
(admin), `7812` (storybook) and `7814` (student site under Vite).

TLS is off in this local stand, and stays off on purpose: there is no public
domain to request a certificate for, and Caddy's automatic HTTPS would try
ACME against `localhost` and fail slowly and noisily rather than fast and
quiet (Caddy does have an internal certificate authority for exactly this
case, but it still means a self-signed root, browser trust prompts, and one
more thing to explain to a developer who just wants `make gateway-up` to
work). Plain HTTP was the simpler of Caddy's two ways to stay quick and quiet
locally, so that is what `VIDYA_GATEWAY_TLS_ENABLED=false` (the default)
gives you: same-origin routing on both hosts, the coarse rate limit, and the
documents' headers, everything except TLS itself.

### Configuration

All environment variables, with their defaults:

| Variable                         | Default                            | What it does                                                    |
| -------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| `VIDYA_GATEWAY_API_UPSTREAM`     | `http://host.docker.internal:7810` | Where `/api/*` is proxied, prefix stripped, from both hosts     |
| `VIDYA_GATEWAY_TLS_ENABLED`      | `false`                            | Request real certificates and terminate TLS on 8443             |
| `VIDYA_GATEWAY_DOMAIN`           | _(none)_                           | The domain the student site answers on; required when TLS is on |
| `VIDYA_GATEWAY_ADMIN_DOMAIN`     | `admin.$VIDYA_GATEWAY_DOMAIN`      | The host the console answers on, when it is not that default    |
| `VIDYA_GATEWAY_HSTS_MAX_AGE`     | `63072000` (2 years)               | `Strict-Transport-Security` max-age, TLS mode only              |
| `VIDYA_GATEWAY_RATE_LIMIT_RPS`   | `20`                               | Coarse per-IP sustained request rate                            |
| `VIDYA_GATEWAY_RATE_LIMIT_BURST` | `40`                               | Per-IP requests absorbed in any single second                   |

With TLS off the container listens on 8080 (the student site) and 8081 (the
console), both plain HTTP. With TLS on, both hosts are names on one listener:
8443 serves them, 8080 is the HTTP→HTTPS redirect and the ACME challenge
listener, and nothing listens on 8081. A deployment maps those to whatever
ports it actually exposes.

**What a deployment must set**: `VIDYA_GATEWAY_TLS_ENABLED=true`,
`VIDYA_GATEWAY_DOMAIN` (the student site's domain — the one a joining link
carries), `VIDYA_GATEWAY_ADMIN_DOMAIN` if the console is not at `admin.` of
it, `VIDYA_GATEWAY_API_UPSTREAM` if the API is not where the default says, and
DNS pointing both names at this container with 8080/8443 mapped to 80/443. No
domain is compiled in anywhere: the defaults here are a development stand's.

### TLS certificates

Caddy obtains and renews these itself — that is the reason this gateway is
Caddy and not another reverse proxy (see the top of this file). Set
`VIDYA_GATEWAY_TLS_ENABLED=true` and `VIDYA_GATEWAY_DOMAIN` to the public
domain the student site answers on; the console's host follows from
`VIDYA_GATEWAY_ADMIN_DOMAIN`, or from `admin.` of that domain. On first
request Caddy gets a certificate for each name from Let's Encrypt (falling
back to ZeroSSL if that issuer is unavailable), staples OCSP, and renews ahead
of expiry, all without a cron job. The container needs port 80 and 443
reachable from the internet at **both** names — mapped from its own 8080/8443
(see "Configuration" above) — for the ACME HTTP-01 challenge and for ordinary
HTTPS traffic.

Certificates and account keys are cached under `/data` inside the container
(Caddy's default `XDG_DATA_HOME`). A deployment that throws this container
away and recreates it on every deploy should mount `/data` on a persistent
volume — otherwise every redeploy requests a fresh certificate, and repeated
requests for the same domain in a short window risk Let's Encrypt's rate
limits.

If `VIDYA_GATEWAY_TLS_ENABLED=true` and `VIDYA_GATEWAY_DOMAIN` is unset, the
entrypoint refuses to start rather than starting Caddy with nothing to
request a certificate for.

## Header ownership

Two processes now answer for the same origin, and headers set in both would
drift out of sync silently. The split:

**The API's helmet (`services/api/src/shared/security-headers/`) owns every
header on `/api/*`.** The gateway proxies and rate-limits that path; it adds
no response headers of its own there. That includes `Strict-Transport-Security`
— the API already sends it, conditionally, once `VIDYA_HSTS_ENABLED=true`. A
deployment that runs this gateway with `VIDYA_GATEWAY_TLS_ENABLED=true` is
exactly the condition `VIDYA_HSTS_ENABLED` was waiting for (see
`configs/security-headers.config.ts`): TLS is real and terminated in front of
the API, so the API's own promise of TLS-only is no longer premature. Turning
one on without the other is still safe either way — each header is
independent of the other process — but there is no longer a reason to leave
the API's off once the gateway's TLS path is live.

**The gateway owns every header on both documents and their static assets
(`/`, everything not under `/api/`, on either host).** Nothing else runs in
front of those builds — no helmet, no application — so Caddy sets, in TLS
mode:
`Strict-Transport-Security`, `X-Frame-Options: DENY`,
`Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: no-referrer`. The frame headers in particular are
what the CSP `<meta>` tag in either `index.html` explicitly could not carry
(`frame-ancestors` is ignored there by specification) and were left for
"whoever stands the gateway up" — this is that. Each document's own `<meta>`
policy stays its own: the student site's carries `'wasm-unsafe-eval'` and the
console's does not, which is one of the reasons they are separate origins.

If a header needs to change, change it where this table says it lives.
Adding it in the other place too is how it drifts.

## Rate limiting

A coarse outer layer meant to catch what should never reach the application
at all — per client IP, well above what the API's own throttling (`#37`)
enforces.

Stock Caddy has no rate limiter; this uses `caddy-ratelimit`
(`github.com/mholt/caddy-ratelimit`), compiled in at build time via `xcaddy`
(see the Dockerfile), which has no separate burst parameter of its own. Two
zones approximate nginx's rate-plus-burst with the primitives it does have: a
1-second window capped at `VIDYA_GATEWAY_RATE_LIMIT_BURST` events absorbs a
short spike, and a 5-second window capped at `VIDYA_GATEWAY_RATE_LIMIT_RPS *
5` events caps the sustained average at `VIDYA_GATEWAY_RATE_LIMIT_RPS`
req/s — the same math as "RPS per second, sustained." Both zones key on the
client IP and apply to a whole site, `/api/*` and the document alike. Each
host has its own pair of zones, so a burst against one site cannot spend the
other's budget.

## Forwarded headers and `trust proxy`

The gateway is the trust boundary: nothing reaches it except from the open
internet. Caddy's `reverse_proxy` sets `X-Forwarded-For` and
`X-Forwarded-Proto` itself, from what it actually observed on the
connection — verified directly (see "What was verified" below): a request
carrying a client-supplied `X-Forwarded-For` arrived at the upstream with
that header replaced by the real peer address, not appended to it, exactly
like the nginx gateway this replaces. A client cannot plant an address ahead
of its own.

For that to mean anything by the time it reaches application code, whatever
wires Express's `trust proxy` setting (`main.ts`) has to trust **exactly one
hop** — `VIDYA_TRUST_PROXY=1` — so `req.ip` reads this header instead of the
gateway's own socket address. This is unchanged from the nginx gateway: one
process still sits between the caller and the API, so the hop count a
deployment sets is the same. Trusting more hops than exist re-opens the
spoofing this header is supposed to close.

## What was verified, and what was not

Actually built and run — `docker build`, and Caddy run directly against a
disposable upstream and against real built bundles, both over plain
HTTP and over TLS (Caddy's internal certificate authority standing in for a
real ACME-issued one, since there is no public domain to request one for
here):

- Document headers on both hosts (`X-Frame-Options`, `frame-ancestors 'none'`,
  `X-Content-Type-Options`, `Referrer-Policy`) — verified present over plain
  HTTP, and `Strict-Transport-Security` additionally present once TLS is on.
- `/api/*` proxying with the prefix stripped, matching the dev proxy, against
  a disposable HTTP upstream that echoes back what it received.
- `X-Forwarded-For` being overwritten rather than appended even when the
  client sends its own, and `X-Forwarded-Proto` reflecting the actual scheme
  (`http` and `https`) — verified against that same echo upstream.
- The rate limiter actually returning `429` past its burst, both on `/` and
  on `/api/*` from the same zone — verified with a request burst.
- The HTTP → HTTPS redirect once TLS is on — verified.
- The entrypoint refusing to start when `VIDYA_GATEWAY_TLS_ENABLED=true` and
  `VIDYA_GATEWAY_DOMAIN` is unset — verified.
- `smoke-test.sh` checks 1 and 4 (each host serving its own application, both
  documents' headers, forwarded headers) — run against `make gateway-up` and
  the image it builds.
- Checks 2 and 3 (`/api` through both hosts, `/j/<code>` against
  `/api/j/<code>`) — run against the same image on host networking, with a
  real API and a real database behind it, because on the machine these were
  run the API listens in a namespace the compose bridge cannot reach. The
  routing verified is the Caddyfile's, which is the same either way; what the
  bridge changes is only where the upstream is.
- The second site being a second **origin** and not a second path: two site
  blocks, two roots, each serving only its own build — verified by asking each
  host for the other's document and getting its own.
- The snippet adapting and both hosts starting in TLS mode as well — verified
  with `caddy validate` against a domain pair, since there is no public domain
  to request certificates for here.
- The checks catching a break rather than reporting a green they cannot see:
  removing the `/api` prefix strip, pointing the console's site block at the
  student build, and deleting `X-Frame-Options` each turn the relevant checks
  red.

Not verified, and not verifiable without a real deployment: an actual
ACME issuance and renewal against a real, publicly resolvable domain, and
the ZeroSSL fallback path.

## Media, issue #15

Issue #15 (an upload endpoint and storage for lesson media) says the gateway
sits "behind" that work too. Nothing in this change is media-specific: once
that lands, served media reaches the browser through this same proxy under
whatever path the API answers on, the same way every other `/api/*` route
does today. No route table here names media specifically, and none needs to.

## Testing this service

`./smoke-test.sh` (run from the repo root, or from here) against a running
`make gateway-up`. It checks that each host serves its own application and not
the other's, that both documents carry the headers the gateway owns, that
`/api` reaches a live upstream through both hosts, that `/j/<code>` answers
with the student site's `index.html` rather than a 404 while `/api/j/<code>`
answers as the API, and that the forwarded headers arrive at an upstream
correctly — the last of those against a disposable stand-in server it starts
and tears down itself, since the real API's `trust proxy` is off by default
in the dev environment (`VIDYA_TRUST_PROXY` is unset) and so cannot show the
difference on its own. There is no existing pattern in this repository for
testing infrastructure like this service; a shell script next to the thing
it tests was the simplest fit.

A developer who wants to sign in to the student site needs data `make
bootstrap` does not create — a school with a joining code, a published course,
and an account holding no permission. `make seed-student EMAIL=…` makes it and
prints the joining link.
