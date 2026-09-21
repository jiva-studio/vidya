# Stock Caddy has no rate limiter built in — caddy-ratelimit
# (github.com/mholt/caddy-ratelimit) compiles in as a module via xcaddy.
FROM caddy:2-builder-alpine AS caddy-build
RUN xcaddy build --with github.com/mholt/caddy-ratelimit

FROM caddy:2-alpine AS runtime

COPY --from=caddy-build /usr/bin/caddy /usr/bin/caddy
COPY modules/services/gateway/Caddyfile /etc/caddy/Caddyfile
COPY modules/services/gateway/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080 8443

ENTRYPOINT ["/docker-entrypoint.sh"]
