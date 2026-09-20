# Build context is the repository root (one level above `modules/`), same as
# modules/services/api/Dockerfile, so both can COPY workspace-relative paths.
#
#   docker build -f modules/services/gateway/Dockerfile .

FROM node:22-alpine AS admin-build
WORKDIR /app

COPY modules/package.json modules/package-lock.json ./
COPY modules/libs ./libs
COPY modules/apps/admin/package.json ./apps/admin/
RUN npm ci --workspace @vidya/admin --include-workspace-root

COPY modules/tsconfig.base.json ./
COPY modules/apps/admin ./apps/admin
RUN npm run build --workspace @vidya/admin

# Stock Caddy has no rate limiter built in — caddy-ratelimit
# (github.com/mholt/caddy-ratelimit) compiles in as a module via xcaddy, the
# same way any third-party Caddy plugin is added. See README.md,
# "Rate limiting".
FROM caddy:2-builder-alpine AS caddy-build
RUN xcaddy build --with github.com/mholt/caddy-ratelimit

FROM caddy:2-alpine AS runtime

COPY --from=caddy-build /usr/bin/caddy /usr/bin/caddy
COPY --from=admin-build /app/apps/admin/dist /usr/share/vidya-gateway/admin
COPY modules/services/gateway/Caddyfile /etc/caddy/Caddyfile
COPY modules/services/gateway/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 8080: plain HTTP in the local stand, or the HTTP->HTTPS redirect and ACME
# HTTP-01 challenge listener once TLS is on. 8443: HTTPS, only meaningfully
# served once TLS is on. A deployment maps these to 80/443 or to whatever its
# own edge expects; the container never binds a privileged port itself. See
# README.md.
EXPOSE 8080 8443

ENTRYPOINT ["/docker-entrypoint.sh"]
