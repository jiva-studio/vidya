#!/bin/sh
# Computes what the checked-in Caddyfile cannot compute for itself, then
# hands off to Caddy. Caddy expands every {$VAR} placeholder in the Caddyfile
# on its own (see Caddyfile's header comment), so — unlike the nginx gateway
# this replaces — there is no envsubst/template-render step here: this
# script only has to decide the handful of values that differ structurally
# between the local stand and a real TLS deployment, export them, and exec.
set -eu

: "${VIDYA_GATEWAY_TLS_ENABLED:=false}"
: "${VIDYA_GATEWAY_API_UPSTREAM:=http://host.docker.internal:7810}"
: "${VIDYA_GATEWAY_ADMIN_UPSTREAM:=http://host.docker.internal:7811}"
: "${VIDYA_GATEWAY_STUDENT_UPSTREAM:=http://host.docker.internal:7814}"
: "${VIDYA_GATEWAY_DOMAIN:=}"
: "${VIDYA_GATEWAY_ADMIN_DOMAIN:=}"
: "${VIDYA_GATEWAY_HSTS_MAX_AGE:=63072000}"
: "${VIDYA_GATEWAY_RATE_LIMIT_RPS:=20}"
: "${VIDYA_GATEWAY_RATE_LIMIT_BURST:=40}"

VIDYA_GATEWAY_HSTS_DIRECTIVE=

if [ "$VIDYA_GATEWAY_TLS_ENABLED" = "true" ]; then
  if [ -z "$VIDYA_GATEWAY_DOMAIN" ]; then
    echo "gateway: VIDYA_GATEWAY_TLS_ENABLED=true but VIDYA_GATEWAY_DOMAIN is not set" >&2
    echo "gateway: see README.md, 'TLS certificates', for what a deployment must set" >&2
    exit 1
  fi

  # Real hostnames, so Caddy's automatic HTTPS treats these as sites to
  # request certificates for (Let's Encrypt, falling back to ZeroSSL) rather
  # than bare ports. See README.md, "TLS certificates".
  VIDYA_GATEWAY_SITE_ADDRESS="$VIDYA_GATEWAY_DOMAIN"
  VIDYA_GATEWAY_ADMIN_SITE_ADDRESS="${VIDYA_GATEWAY_ADMIN_DOMAIN:-admin.$VIDYA_GATEWAY_DOMAIN}"
  VIDYA_GATEWAY_HSTS_DIRECTIVE="header Strict-Transport-Security \"max-age=${VIDYA_GATEWAY_HSTS_MAX_AGE}; includeSubDomains\""
else
  # Bare ports, not domains: this is what keeps Caddy from ever treating the
  # local stand as sites to obtain certificates for — no ACME attempt, plain
  # HTTP, same as `curl localhost:8080` today. Two ports are two origins, so
  # the separation the deployment gets from two names holds here too. See
  # README.md, "Local stand".
  VIDYA_GATEWAY_SITE_ADDRESS=":8080"
  VIDYA_GATEWAY_ADMIN_SITE_ADDRESS=":8081"
fi

# caddy-ratelimit has no separate "burst" parameter (see Caddyfile) — two
# zones approximate nginx's rate+burst instead: a 1s window capped at BURST
# events (absorbs a spike), and a 5s window capped at RPS*5 events, which is
# the same thing as an average of RPS req/s sustained over that window. See
# README.md, "Rate limiting".
VIDYA_GATEWAY_RATE_LIMIT_SUSTAINED_EVENTS=$((VIDYA_GATEWAY_RATE_LIMIT_RPS * 5))

export VIDYA_GATEWAY_API_UPSTREAM VIDYA_GATEWAY_ADMIN_UPSTREAM VIDYA_GATEWAY_STUDENT_UPSTREAM \
  VIDYA_GATEWAY_SITE_ADDRESS VIDYA_GATEWAY_ADMIN_SITE_ADDRESS \
  VIDYA_GATEWAY_HSTS_DIRECTIVE \
  VIDYA_GATEWAY_RATE_LIMIT_RPS VIDYA_GATEWAY_RATE_LIMIT_BURST VIDYA_GATEWAY_RATE_LIMIT_SUSTAINED_EVENTS

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
