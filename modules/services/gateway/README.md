# gateway

The reverse proxy Vidya deploys behind: TLS termination (certificates
obtained and renewed automatically, no certbot, no sidecar), one origin
serving the built admin and proxying `/api` to the API, the response headers
that belong at the edge rather than in an application, and a coarse rate
limit. Caddy, driven by one Caddyfile and a shell entrypoint — no application
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
make gateway-up   # builds the admin fresh and starts Caddy in front of it
```

Then open `http://localhost:7813`. `make gateway-down` stops it,
`make gateway-logs` follows Caddy's access/error log.

`gateway-up` sits behind a docker-compose profile (`gateway`), so
`make dev-up`/`make dev` never start it — see the header comment in
`modules/docker-compose.dev.yml`. It runs at port **7813**, the next
`781x` application slot after `7810` (api), `7811` (admin) and `7812`
(storybook).

TLS is off in this local stand, and stays off on purpose: there is no public
domain to request a certificate for, and Caddy's automatic HTTPS would try
ACME against `localhost` and fail slowly and noisily rather than fast and
quiet (Caddy does have an internal certificate authority for exactly this
case, but it still means a self-signed root, browser trust prompts, and one
more thing to explain to a developer who just wants `make gateway-up` to
work). Plain HTTP was the simpler of Caddy's two ways to stay quick and quiet
locally, so that is what `VIDYA_GATEWAY_TLS_ENABLED=false` (the default)
gives you: same-origin routing, the coarse rate limit, and the admin
document's headers, everything except TLS itself.

### Configuration

All environment variables, with their defaults:

| Variable                         | Default                            | What it does                                                            |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| `VIDYA_GATEWAY_API_UPSTREAM`     | `http://host.docker.internal:7810` | Where `/api/*` is proxied, prefix stripped                              |
| `VIDYA_GATEWAY_TLS_ENABLED`      | `false`                            | Request a real certificate and terminate TLS on 8443                    |
| `VIDYA_GATEWAY_DOMAIN`           | _(none)_                           | The public domain to request a certificate for; required when TLS is on |
| `VIDYA_GATEWAY_HSTS_MAX_AGE`     | `63072000` (2 years)               | `Strict-Transport-Security` max-age, TLS mode only                      |
| `VIDYA_GATEWAY_RATE_LIMIT_RPS`   | `20`                               | Coarse per-IP sustained request rate                                    |
| `VIDYA_GATEWAY_RATE_LIMIT_BURST` | `40`                               | Per-IP requests absorbed in any single second                           |

The container always listens on 8080 (plain HTTP locally, or the
HTTP→HTTPS redirect and ACME challenge listener once TLS is on) and 8443
(HTTPS, only meaningfully served once TLS is on); a deployment maps those to
whatever ports it actually exposes.

### TLS certificates

Caddy obtains and renews these itself — that is the reason this gateway is
Caddy and not another reverse proxy (see the top of this file). Set
`VIDYA_GATEWAY_TLS_ENABLED=true` and `VIDYA_GATEWAY_DOMAIN` to the public
domain this deployment answers on; on first request Caddy gets a certificate
from Let's Encrypt (falling back to ZeroSSL if that issuer is unavailable),
staples OCSP, and renews ahead of expiry, all without a cron job. The
container needs port 80 and 443 reachable from the internet at that domain —
mapped from its own 8080/8443 (see "Configuration" above) — for the ACME
HTTP-01 challenge and for ordinary HTTPS traffic.

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

**The gateway owns every header on the admin document and its static assets
(`/`, everything not under `/api/`).** Nothing else runs in front of that
build — no helmet, no application — so Caddy sets, in TLS mode:
`Strict-Transport-Security`, `X-Frame-Options: DENY`,
`Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: no-referrer`. The frame headers in particular are
what `apps/admin/index.html`'s CSP `<meta>` tag explicitly could not carry
(`frame-ancestors` is ignored there by specification) and were left for
"whoever stands the gateway up" — this is that.

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
client IP and apply to the whole site, `/api/*` and the admin document alike.

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
disposable upstream and against a real built admin bundle, both over plain
HTTP and over TLS (Caddy's internal certificate authority standing in for a
real ACME-issued one, since there is no public domain to request one for
here):

- Admin document headers (`X-Frame-Options`, `frame-ancestors 'none'`,
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
- `smoke-test.sh` checks 1 and 3 (headers, forwarded headers) — run directly
  against the built image with the same disposable echo upstream the script
  itself uses. Check 2, which needs a live NestJS API on the compose
  bridge network, was not run end to end in this environment: other agents
  were concurrently using this machine's shared `vidya-postgres` /
  `vidya-redis` / `vidya-mailpit` containers, and starting or restarting them
  risked interfering with that work. `/api/*` proxying itself (routing,
  prefix stripping, forwarded headers) was verified as above, against a
  disposable upstream rather than the real API.

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
`make gateway-up`. It checks the admin document's headers, that `/api`
reaches a live upstream, and that the forwarded headers arrive at an upstream
correctly — the last of those against a disposable stand-in server it starts
and tears down itself, since the real API's `trust proxy` is off by default
in the dev environment (`VIDYA_TRUST_PROXY` is unset) and so cannot show the
difference on its own. There is no existing pattern in this repository for
testing infrastructure like this service; a shell script next to the thing
it tests was the simplest fit.
