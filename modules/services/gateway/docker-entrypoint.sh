#!/bin/sh
# Renders templates/*.conf.template into conf.d/*.conf with envsubst, then
# starts nginx. Not the stock nginx image's own template mechanism (which
# would render every *.template file unconditionally): TLS on and TLS off are
# structurally different server blocks — one listener or two, an ssl_certificate
# directive or none — and that choice has to be made once, here, rather than
# left for nginx to fail on at startup.
set -eu

: "${VIDYA_GATEWAY_TLS_ENABLED:=false}"
: "${VIDYA_GATEWAY_API_UPSTREAM:=http://host.docker.internal:7810}"
: "${VIDYA_GATEWAY_SERVER_NAME:=_}"
: "${VIDYA_GATEWAY_HSTS_MAX_AGE:=63072000}"
: "${VIDYA_GATEWAY_TLS_CERT:=/etc/vidya-gateway/tls/fullchain.pem}"
: "${VIDYA_GATEWAY_TLS_KEY:=/etc/vidya-gateway/tls/privkey.pem}"
: "${VIDYA_GATEWAY_RATE_LIMIT_RPS:=20}"
: "${VIDYA_GATEWAY_RATE_LIMIT_BURST:=40}"

server_template=/etc/nginx/templates/http.conf.template
VIDYA_GATEWAY_HSTS_HEADER=

if [ "$VIDYA_GATEWAY_TLS_ENABLED" = "true" ]; then
  server_template=/etc/nginx/templates/https.conf.template
  VIDYA_GATEWAY_HSTS_HEADER="add_header Strict-Transport-Security \"max-age=${VIDYA_GATEWAY_HSTS_MAX_AGE}; includeSubDomains\" always;"

  for cert_file in "$VIDYA_GATEWAY_TLS_CERT" "$VIDYA_GATEWAY_TLS_KEY"; do
    if [ ! -f "$cert_file" ]; then
      echo "gateway: VIDYA_GATEWAY_TLS_ENABLED=true but $cert_file does not exist" >&2
      echo "gateway: see README.md, 'TLS certificates', for what to mount" >&2
      exit 1
    fi
  done
fi

export VIDYA_GATEWAY_API_UPSTREAM VIDYA_GATEWAY_SERVER_NAME VIDYA_GATEWAY_TLS_CERT \
  VIDYA_GATEWAY_TLS_KEY VIDYA_GATEWAY_RATE_LIMIT_RPS VIDYA_GATEWAY_RATE_LIMIT_BURST \
  VIDYA_GATEWAY_HSTS_HEADER

# The explicit variable list keeps envsubst from touching nginx's own `$`
# variables ($host, $scheme, $remote_addr, ...) — those have to reach the
# rendered file untouched.
render_vars='${VIDYA_GATEWAY_API_UPSTREAM} ${VIDYA_GATEWAY_SERVER_NAME} ${VIDYA_GATEWAY_TLS_CERT} ${VIDYA_GATEWAY_TLS_KEY} ${VIDYA_GATEWAY_RATE_LIMIT_RPS} ${VIDYA_GATEWAY_RATE_LIMIT_BURST} ${VIDYA_GATEWAY_HSTS_HEADER}'

# Rendered outside conf.d/, which nginx.conf globs wholesale into the http
# context: a `location` block dropped there directly (rather than inside a
# server{} via `include`) is a parse error, not a silent no-op.
mkdir -p /etc/nginx/includes
envsubst "$render_vars" < /etc/nginx/templates/locations.conf.template > /etc/nginx/includes/locations.conf
envsubst "$render_vars" < "$server_template" > /etc/nginx/conf.d/server.conf

exec nginx -g 'daemon off;'
