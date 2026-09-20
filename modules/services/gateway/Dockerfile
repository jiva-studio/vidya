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

FROM nginx:1.27-alpine AS runtime

COPY --from=admin-build /app/apps/admin/dist /usr/share/vidya-gateway/admin
COPY modules/services/gateway/nginx.conf /etc/nginx/nginx.conf
COPY modules/services/gateway/templates /etc/nginx/templates
COPY modules/services/gateway/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 8080 plain HTTP (always; also the HTTPS redirect target when TLS is on),
# 8443 TLS. A deployment maps these to 80/443 or to whatever its own edge
# expects; the container never binds a privileged port itself.
EXPOSE 8080 8443

ENTRYPOINT ["/docker-entrypoint.sh"]
