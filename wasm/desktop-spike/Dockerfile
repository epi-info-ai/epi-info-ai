FROM node:24.19.0-alpine AS build

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY wasm ./wasm
RUN corepack enable \
    && corepack install \
    && pnpm install --frozen-lockfile \
    && pnpm run typecheck \
    && pnpm run build \
    && pnpm run test:build

FROM nginxinc/nginx-unprivileged:1.29-alpine

LABEL org.opencontainers.image.title="Epi Info AI browser spike" \
      org.opencontainers.image.description="Local container serving the browser-first Epi Info AI build" \
      org.opencontainers.image.licenses="Apache-2.0"

COPY wasm/desktop-spike/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/wasm/dist /usr/share/nginx/html

USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
