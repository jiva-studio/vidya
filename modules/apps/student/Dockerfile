# Build stage: compile the Vue 3 SPA bundle
FROM node:22-alpine AS build
WORKDIR /app

COPY modules/package.json modules/package-lock.json ./
COPY modules/libs ./libs
COPY modules/apps/student/package.json ./apps/student/
RUN npm ci --workspace @vidya/student --include-workspace-root

COPY modules/tsconfig.base.json ./
COPY modules/apps/student ./apps/student
RUN npm run build --workspace @vidya/student

# Production runtime stage: ultra-lightweight static web server (Rust)
FROM joseluisq/static-web-server:2-alpine AS runtime

COPY --from=build /app/apps/student/dist /public

ENV SERVER_PORT=80
ENV SERVER_ROOT=/public
ENV SERVER_SPA_INDEX=true

EXPOSE 80
