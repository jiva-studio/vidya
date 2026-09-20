# gateway

The reverse proxy Vidya deploys behind: TLS termination, one origin serving
the built admin and proxying `/api` to the API, the response headers that
belong at the edge rather than in an application, and a coarse rate limit.
nginx, driven by two small templates and a shell entrypoint — no application
code.

Before this existed, nothing terminated TLS, so `Strict-Transport-Security`
had nowhere to be true (`configs/security-headers.config.ts`), the admin's
CSP could not carry `frame-ancestors` (a `<meta>` tag cannot express it — see
the comment in `apps/admin/index.html`), and nothing served the built admin
in production at all.

## Running it locally

The everyday dev flow is unaffected: `make dev` still runs the admin through
Vite's own dev server and its own `/api` proxy, same as before this existed.
The gateway is an _additional_, opt-in way to exercise the production shape —
one origin, a built admin, a real reverse proxy — against your own machine.

```bash
make api-run      # or `make dev`; something has to answer on VIDYA_API_PORT
make gateway-up   # builds the admin fresh and starts nginx in front of it
```

Then open `http://localhost:7813`. `make gateway-down` stops it,
`make gateway-logs` follows nginx's access/error log.

`gateway-up` sits behind a docker-compose profile (`gateway`), so
`make dev-up`/`make dev` never start it — see the header comment in
`modules/docker-compose.dev.yml`. It runs at port **7813**, the next
`781x` application slot after `7810` (api), `7811` (admin) and `7812`
(storybook).

TLS is off in this local stand: there is no certificate to hand it, and
turning HSTS on against a host that does not really offer TLS would lock a
visitor out rather than protect them (the same call `security-headers.config.ts`
makes for the API). What you get locally is everything else: same-origin
routing, the coarse rate limit, and the admin document's headers.

### Configuration

All environment variables, with their defaults:

| Variable                         | Default                                | What it does                                       |
| -------------------------------- | -------------------------------------- | -------------------------------------------------- |
| `VIDYA_GATEWAY_API_UPSTREAM`     | `http://host.docker.internal:7810`     | Where `/api/*` is proxied, prefix stripped         |
| `VIDYA_GATEWAY_SERVER_NAME`      | `_` (any)                              | nginx `server_name`                                |
| `VIDYA_GATEWAY_TLS_ENABLED`      | `false`                                | Terminate TLS on 8443 and redirect 8080 → 8443     |
| `VIDYA_GATEWAY_TLS_CERT`         | `/etc/vidya-gateway/tls/fullchain.pem` | Certificate (chain), PEM                           |
| `VIDYA_GATEWAY_TLS_KEY`          | `/etc/vidya-gateway/tls/privkey.pem`   | Private key, PEM                                   |
| `VIDYA_GATEWAY_HSTS_MAX_AGE`     | `63072000` (2 years)                   | `Strict-Transport-Security` max-age, TLS mode only |
| `VIDYA_GATEWAY_RATE_LIMIT_RPS`   | `20`                                   | Coarse per-IP request rate                         |
| `VIDYA_GATEWAY_RATE_LIMIT_BURST` | `40`                                   | Burst absorbed before a 503                        |

The container always listens on 8080 (plain HTTP, or the HTTPS redirect
target when TLS is on) and 8443 (HTTPS, only bound when TLS is on); a
deployment maps those to whatever ports it actually exposes.

### TLS certificates

Not decided in this repository, on purpose: how a certificate reaches this
container depends on how Vidya is deployed, and that is not settled yet. What
is decided is the shape a deployment has to fill in: mount a certificate chain
and a private key as files, in PEM format, at the two paths above (or point
the two env vars elsewhere), and set `VIDYA_GATEWAY_TLS_ENABLED=true`. That
is deliberately the same shape `certbot`, `acme.sh` and most ACME sidecars
already produce, and equally the shape a mounted Kubernetes TLS secret takes,
so nothing here has to assume which one is in front of it. Fetching or
renewing a certificate is out of scope for this service; it consumes one.

If the two files are missing, the entrypoint refuses to start nginx at all
rather than starting it TLS-broken.

## Header ownership

Two processes now answer for the same origin, and headers set in both would
drift out of sync silently. The split:

**The API's helmet (`services/api/src/shared/security-headers/`) owns every
header on `/api/*`.** The gateway proxies and rate-limits that path; it adds
no response headers of its own there. That includes `Strict-Transport-Security`
— the API already sends it, conditionally, once `VIDYA_HSTS_ENABLED=true`, and
standing this gateway up in front of it in a real deployment is exactly what
that flag has been waiting for (see `configs/security-headers.config.ts`).

**The gateway owns every header on the admin document and its static assets
(`/`, everything not under `/api/`).** Nothing else runs in front of that
build — no helmet, no application — so nginx sets, in TLS mode:
`Strict-Transport-Security`, `X-Frame-Options: DENY`,
`Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: no-referrer`. The frame headers in particular are
what `apps/admin/index.html`'s CSP `<meta>` tag explicitly could not carry
(`frame-ancestors` is ignored there by specification) and were left for
"whoever stands the gateway up" — this is that.

If a header needs to change, change it where this table says it lives.
Adding it in the other place too is how it drifts.

## Rate limiting

`limit_req_zone`, per client IP, `VIDYA_GATEWAY_RATE_LIMIT_RPS` (default 20)
with a `VIDYA_GATEWAY_RATE_LIMIT_BURST` (default 40) absorbed before a 503.
This is a coarse outer layer meant to catch what should never reach the
application at all — it is not tuned against the API's own limiter, because
at the time this was written the API had no rate limiting wired in yet (the
`@nestjs/throttler` dependency is present; nothing uses it). Whoever lands
that should check these numbers sit comfortably above whatever the
application enforces, not the other way round.

## Forwarded headers and `trust proxy`

The gateway is the trust boundary: nothing reaches it except from the open
internet. It sets `X-Forwarded-For` to the real client address — overwriting
any inbound value rather than appending to it, so a client cannot plant an
address ahead of its own — and `X-Forwarded-Proto` to the scheme it actually
terminated (`http` or `https`).

For that to mean anything by the time it reaches application code, whatever
wires Express's `trust proxy` setting (`main.ts`, out of scope for this
change) has to trust **exactly one hop** — `app.set('trust proxy', 1)` — so
`req.ip` reads this header instead of the gateway's own socket address.
Trusting more hops than exist re-opens the spoofing this header is supposed
to close.

## What was verified, and what was not

Actually built and run — `docker build`, `docker run`, and the real
`make gateway-up` compose profile — not just read for plausibility:

- Admin document headers (`X-Frame-Options`, `frame-ancestors 'none'`,
  `X-Content-Type-Options`, `Referrer-Policy`, and `Strict-Transport-Security`
  in TLS mode) — verified present, over both plain HTTP and a self-signed TLS
  cert, and again through `make gateway-up` on port 7813.
- `/api/*` proxying with the prefix stripped, matching the dev proxy, against
  a live NestJS API — `GET /api/edu/schools` came back `401 Unauthorized`
  (the API's own answer, not nginx's) rather than a 502/504.
- `X-Forwarded-For` being overwritten rather than appended, and
  `X-Forwarded-Proto` reflecting the actual scheme (`http` and `https`) —
  verified against a disposable echo upstream that logs what it received.
- The coarse rate limit actually returning 503 past its burst — verified with
  a concurrent request burst.
- The HTTP → HTTPS redirect in TLS mode — verified.
- The entrypoint refusing to start when `VIDYA_GATEWAY_TLS_ENABLED=true` and
  the certificate files are absent — verified.
- `smoke-test.sh` itself — run for real; 5 of its 6 checks passed (see below
  for the one that didn't).

One gap, specific to the sandbox this was written in rather than to the
config: the compose service reaches the API via
`http://host.docker.internal:${VIDYA_API_PORT}` over the default bridge
network, and in that sandbox a container cannot open a TCP connection to a
host-bound port that way — `host.docker.internal` resolves correctly and
ICMP gets through, but the TCP connect times out. The proxy mechanics
themselves are verified (above, against the real API) using `--network host`
to sidestep exactly that restriction; what is not verified is the bridge hop
`make gateway-up` actually uses. This is Docker's standard, documented
mechanism for a container reaching the host and is expected to work on an
ordinary Linux or Docker Desktop machine — but it was not observed working
here, so it is called out rather than assumed. If `make gateway-up` cannot
reach the API on a real machine, look here first.

Not verified, and not verifiable without a real deployment: an actual
CA-signed certificate and its renewal path.

## Media, issue #15

Issue #15 (an upload endpoint and storage for lesson media) says the gateway
sits "behind" that work too. Nothing in this change is media-specific: once
that lands, served media reaches the browser through this same proxy under
whatever path the API answers on, the same way every other `/api/*` route
does today. No route table here names media specifically, and none needs to.

## Testing this service

`./smoke-test.sh` (run from the repo root, or from here) against a running
`make gateway-up`. It checks the admin document's headers, that `/api`
reaches a live upstream, and that the forwarded headers arrive at an upstream
correctly — the last of those against a disposable stand-in server it starts
and tears down itself, since the real API does not read `trust proxy` yet and
so cannot show the difference on its own. There is no existing pattern in
this repository for testing infrastructure like this service; a shell script
next to the thing it tests was the simplest fit.
