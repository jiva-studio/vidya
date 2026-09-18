FROM node:22-alpine AS build
WORKDIR /app

COPY modules/package.json modules/package-lock.json ./
COPY modules/libs ./libs
COPY modules/services/api/package.json ./services/api/
RUN npm ci --workspace @vidya/api --include-workspace-root

COPY modules/tsconfig.base.json ./
COPY modules/services/api ./services/api
RUN npm run build --workspace @vidya/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/api/dist ./dist

# The .sql files are not compiled, so they have to be copied deliberately. The
# runner treats an empty migrations directory as fatal precisely because
# forgetting this line would otherwise start the service against an unmigrated
# database and fail on the first query instead.
COPY modules/services/api/migrations ./migrations
ENV VIDYA_MIGRATIONS_DIR=/app/migrations

EXPOSE 8001
CMD ["node", "dist/services/api/src/main.js"]
