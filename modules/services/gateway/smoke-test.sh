#!/usr/bin/env bash
# Smoke test for the gateway, run against a real local stand. It exercises
# these things end to end rather than reading the adapted Caddy config:
#
#   1. each host serves its own application, and not the other's, with the
#      headers the gateway owns on both documents (see README.md, "Header
#      ownership" and "Two origins")
#   2. /api/* reaches the live API through both hosts, with the /api prefix
#      stripped the way each application's Vite dev proxy does it
#   3. a deep route answers with the application's index.html rather than 404,
#      while the same path under /api/ answers as the API
#   4. X-Forwarded-For / X-Forwarded-Proto arrive at the upstream, and a
#      client-supplied X-Forwarded-For is overwritten rather than trusted
#
# Preconditions: `make gateway-up`, and something answering on
# VIDYA_GATEWAY_API_UPSTREAM (the real API via `make api-run`/`make dev`) for
# checks 2 and 3. Run from the repo root or from here:
#
#   ./modules/services/gateway/smoke-test.sh
#
# Check 4 does not depend on the real API or on the running gateway: it starts
# a disposable Python HTTP server that echoes the request headers it received,
# points a throwaway gateway container straight at it, and tears both down
# again. This is the one check the real API cannot answer today — the dev
# environment does not set `VIDYA_TRUST_PROXY` (see README.md, "Forwarded
# headers and trust proxy") — so it is verified against the mechanism Caddy
# is running, not against app-observable behaviour.
set -uo pipefail

STUDENT_URL="${STUDENT_URL:-http://localhost:7813}"
CONSOLE_URL="${CONSOLE_URL:-http://localhost:7815}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# The code `make seed-student` gives its school. The routing is what is being
# checked, and it is the same whether or not the API finds a school behind the
# code — so this check does not require the seed to have been run.
JOIN_CODE="ABC123"

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

# The two builds are told apart by their own CSP: the student site compiles
# SQLite to WebAssembly and so carries 'wasm-unsafe-eval', which the console's
# policy deliberately does not (see apps/student/index.html).
serves_student() { grep -q "wasm-unsafe-eval" <<<"$1"; }
serves_console() { grep -q "Content-Security-Policy" <<<"$1" && ! serves_student "$1"; }
lacks_student() { ! serves_student "$1"; }
lacks_console() { ! serves_console "$1"; }

# What a guarded API route answers when the proxy is right: JSON from the
# application, and not 404. A 404 is what the API returns when the `/api`
# prefix was not stripped and it sees a path it has no route for; a 502 or 504
# is what the gateway returns when it reached nothing at all; an HTML body is
# the file server having answered instead of the proxy.
answered_as_api() {
  local status="$1"
  local content_type="$2"
  [ -n "$status" ] && [ "$status" != "000" ] && [ "$status" != "404" ] &&
    [ "$status" != "502" ] && [ "$status" != "504" ] &&
    grep -q 'application/json' <<<"$content_type"
}

check_gateway_headers() {
  local headers="$1"
  local host="$2"
  check "$host — X-Frame-Options: DENY" grep -qi '^x-frame-options: *deny' <<<"$headers"
  check "$host — Content-Security-Policy: frame-ancestors 'none'" \
    grep -qi "content-security-policy:.*frame-ancestors 'none'" <<<"$headers"
  check "$host — X-Content-Type-Options: nosniff" \
    grep -qi '^x-content-type-options: *nosniff' <<<"$headers"
  check "$host — Referrer-Policy: no-referrer" grep -qi '^referrer-policy: *no-referrer' <<<"$headers"
}

# 401 is what an unauthenticated GET against a guarded route returns, which is
# both proof that a live API answered and proof that it saw the path without
# the `/api` prefix.
check_answers_as_api() {
  local url="$1"
  local desc="$2"
  local answer
  answer="$(curl -sS -m 5 -o /dev/null -w '%{http_code} %{content_type}' "$url")"

  if [ -z "$answer" ] || [ "${answer%% *}" = "000" ]; then
    echo "FAIL: no response from $url — is the API running (make api-run / make dev)?"
    fail=$((fail + 1))
    return
  fi

  check "$desc (answered: $answer)" answered_as_api "${answer%% *}" "${answer#* }"
}

echo "== 1. each host serves its own application =="
student_headers="$(curl -fsSI -m 5 "$STUDENT_URL/")"
console_headers="$(curl -fsSI -m 5 "$CONSOLE_URL/")"
if [ -z "$student_headers" ] || [ -z "$console_headers" ]; then
  echo "FAIL: could not reach $STUDENT_URL and $CONSOLE_URL — is 'make gateway-up' running?"
  exit 1
fi

student_document="$(curl -fsS -m 5 "$STUDENT_URL/")"
console_document="$(curl -fsS -m 5 "$CONSOLE_URL/")"

check "$STUDENT_URL serves the student site" serves_student "$student_document"
check "$STUDENT_URL does not serve the console" lacks_console "$student_document"
check "$CONSOLE_URL serves the console" serves_console "$console_document"
check "$CONSOLE_URL does not serve the student site" lacks_student "$console_document"

check_gateway_headers "$student_headers" "student"
check_gateway_headers "$console_headers" "console"

echo
echo "== 2. /api reaches the upstream through both hosts =="
check_answers_as_api "$STUDENT_URL/api/edu/schools" \
  "student — GET /api/edu/schools reached the API with the prefix stripped"
check_answers_as_api "$CONSOLE_URL/api/edu/schools" \
  "console — GET /api/edu/schools reached the API with the prefix stripped"

echo
echo "== 3. a joining link opens the site, the same path under /api answers as the API =="
join_document="$(curl -fsS -m 5 "$STUDENT_URL/j/$JOIN_CODE")"
check "GET /j/$JOIN_CODE served the student site's index.html, not a 404" \
  serves_student "$join_document"

join_answer="$(curl -sS -m 5 -o /dev/null -w '%{http_code} %{content_type}' "$STUDENT_URL/api/j/$JOIN_CODE")"
check "GET /api/j/$JOIN_CODE answered as the API (answered: ${join_answer:-<nothing>})" \
  grep -q 'application/json' <<<"$join_answer"

echo
echo "== 4. X-Forwarded-For / X-Forwarded-Proto reach the upstream =="
echo "   (disposable echo server + throwaway gateway container; does not touch the running stand)"

probe_image="vidya-gateway:smoke-test"
docker build -q -f "$REPO_ROOT/modules/services/gateway/Dockerfile" -t "$probe_image" "$REPO_ROOT" >/dev/null

docker rm -f vidya-gateway-fwd-probe >/dev/null 2>&1
docker run -d --name vidya-gateway-fwd-probe --network host \
  -e VIDYA_GATEWAY_API_UPSTREAM=http://127.0.0.1:19199 \
  "$probe_image" >/dev/null

# The echo server is started after the image is built and the container is up:
# it serves one request and then exits, and its own timeout must cover the wait
# for that request, not a build that may take longer than the timeout itself.
echo_log="$(mktemp)"
timeout 30 python3 - "$echo_log" <<'PY' &
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

cleanup() {
  docker rm -f vidya-gateway-fwd-probe >/dev/null 2>&1
  kill "$echo_pid" >/dev/null 2>&1
  rm -f "$echo_log"
}
trap cleanup EXIT

sleep 2
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
