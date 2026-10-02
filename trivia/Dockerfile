# Two stages: the build stage has every dependency and the sources; the final image only what the server runs.

# Build: install everything, build the Next.js app, and bundle the custom server (server.ts and src/lib, which
# Socket.IO and the game logic live in) into one JavaScript file, so the image needs no tsx/TypeScript at runtime.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build \
 && npx esbuild server.ts --bundle --platform=node --target=node22 --format=cjs --packages=external --outfile=dist/server.js \
 && rm -rf .next/cache .next/standalone \
 && mkdir -p public

# Runtime: production dependencies only. The SWC compiler binaries are only needed to build, so they are removed.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
 && npm cache clean --force \
 && rm -rf node_modules/@next/swc-*
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/dist/server.js ./server.js
COPY next.config.js ./

EXPOSE 3002
CMD ["node", "server.js"]
