#!/usr/bin/env bash
# Smoke test for the gateway, run against a real local stand. It exercises
# three things end to end rather than reading the adapted Caddy config:
#
#   1. the admin document carries the headers the gateway owns (see
#      README.md, "Header ownership")
#   2. /api/* reaches a live upstream through the proxy, with the /api prefix
#      stripped the way modules/apps/admin/vite.config.ts's dev proxy does it
#   3. X-Forwarded-For / X-Forwarded-Proto arrive at the upstream, and a
#      client-supplied X-Forwarded-For is overwritten rather than trusted
#
# Preconditions: `make gateway-up`, and something answering on
# VIDYA_GATEWAY_API_UPSTREAM (the real API via `make api-run`/`make dev`) for
# check 2. Run from the repo root or from here:
#
#   ./modules/services/gateway/smoke-test.sh
#
# Check 3 does not depend on the real API or on the running gateway: it starts
# a disposable Python HTTP server that echoes the request headers it received,
# points a throwaway gateway container straight at it, and tears both down
# again. This is the one check the real API cannot answer today — the dev
# environment does not set `VIDYA_TRUST_PROXY` (see README.md, "Forwarded
# headers and trust proxy") — so it is verified against the mechanism Caddy
# is running, not against app-observable behaviour.
set -uo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:7813}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

pass=0
fail=0

# Wraps a check so a failure never aborts the script (no `set -e` reliance)
# and every check still reports, pass or fail.
check() {
  local desc="$1"
  shift
  if "$@"; then
    echo "PASS: $desc"
    pass=$((pass + 1))
  else
    echo "FAIL: $desc"
    fail=$((fail + 1))
  fi
}

echo "== 1. admin document headers ($GATEWAY_URL/) =="
headers="$(curl -fsSI -m 5 "$GATEWAY_URL/")"
if [ -z "$headers" ]; then
  echo "FAIL: could not reach $GATEWAY_URL — is 'make gateway-up' running?"
  exit 1
fi
check "X-Frame-Options: DENY" grep -qi '^x-frame-options: *deny' <<<"$headers"
check "Content-Security-Policy: frame-ancestors 'none'" \
  grep -qi "content-security-policy:.*frame-ancestors 'none'" <<<"$headers"
check "X-Content-Type-Options: nosniff" grep -qi '^x-content-type-options: *nosniff' <<<"$headers"

echo
echo "== 2. /api reaches the upstream through the proxy =="
status="$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$GATEWAY_URL/api/edu/schools")"
if [ -z "$status" ] || [ "$status" = "000" ]; then
  echo "FAIL: no response from $GATEWAY_URL/api/edu/schools — is the API running (make api-run / make dev)?"
  fail=$((fail + 1))
else
  # Any response nginx did not manufacture itself proves the request reached
  # a live upstream; 401 is what an unauthenticated GET against a guarded
  # route actually returns.
  desc="GET /api/edu/schools got a response from upstream (status $status), not a gateway error"
  if [ "$status" != "502" ] && [ "$status" != "504" ]; then
    echo "PASS: $desc"
    pass=$((pass + 1))
  else
    echo "FAIL: $desc"
    fail=$((fail + 1))
  fi
fi

echo
echo "== 3. X-Forwarded-For / X-Forwarded-Proto reach the upstream =="
echo "   (disposable echo server + throwaway gateway container; does not touch the running stand)"

echo_log="$(mktemp)"
timeout 15 python3 - "$echo_log" <<'PY' &
import http.server, sys

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        with open(sys.argv[1], "w") as f:
            f.write(f"{self.headers.get('X-Forwarded-For')}\n{self.headers.get('X-Forwarded-Proto')}\n")
        self.send_response(200)
        self.end_headers()
    def log_message(self, *a):
        pass

http.server.HTTPServer(("0.0.0.0", 19199), Handler).handle_request()
PY
echo_pid=$!

probe_image="vidya-gateway:smoke-test"
docker build -q -f "$REPO_ROOT/modules/services/gateway/Dockerfile" -t "$probe_image" "$REPO_ROOT" >/dev/null

docker rm -f vidya-gateway-fwd-probe >/dev/null 2>&1
docker run -d --name vidya-gateway-fwd-probe --network host \
  -e VIDYA_GATEWAY_API_UPSTREAM=http://127.0.0.1:19199 \
  "$probe_image" >/dev/null

cleanup() {
  docker rm -f vidya-gateway-fwd-probe >/dev/null 2>&1
  kill "$echo_pid" >/dev/null 2>&1
  rm -f "$echo_log"
}
trap cleanup EXIT

sleep 1
curl -fsS -m 5 -H 'X-Forwarded-For: 10.0.0.1-spoofed' http://localhost:8080/api/probe >/dev/null 2>&1

# The probe request above either landed (and the echo server already exited,
# `handle_request` serving exactly one) or something upstream is broken;
# either way, wait for the process rather than the arbitrary sleep above.
wait "$echo_pid" 2>/dev/null

forwarded_for="$(sed -n '1p' "$echo_log" 2>/dev/null)"
forwarded_proto="$(sed -n '2p' "$echo_log" 2>/dev/null)"

desc="X-Forwarded-For reached the upstream, overwritten rather than appended (got: ${forwarded_for:-<nothing>})"
if [ -n "$forwarded_for" ] && [ "$forwarded_for" != "10.0.0.1-spoofed" ]; then
  echo "PASS: $desc"
  pass=$((pass + 1))
else
  echo "FAIL: $desc"
  fail=$((fail + 1))
fi
check "X-Forwarded-Proto reached the upstream as 'http' (got: ${forwarded_proto:-<nothing>})" \
  [ "$forwarded_proto" = "http" ]

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
