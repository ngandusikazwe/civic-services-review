FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/workflow/package.json packages/workflow/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY apps/api apps/api
COPY apps/web apps/web
COPY packages/workflow packages/workflow
RUN pnpm --filter @workflow/workflow build && pnpm --filter @workflow/api build && VITE_API_URL=/api pnpm --filter @workflow/web build

FROM base AS runtime
ENV NODE_ENV=production
ENV WEB_DIST_PATH=/app/apps/web/dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/migrations ./apps/api/migrations
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages/workflow/dist ./packages/workflow/dist
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/workflow/package.json packages/workflow/package.json
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && node dist/index.js"]
