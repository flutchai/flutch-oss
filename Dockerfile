FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install
COPY . .
RUN yarn build
RUN yarn client:build

FROM node:20-alpine AS production
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn workspaces focus --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY graph.manifest.json ./
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
RUN chown -R nestjs:nodejs /app
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "dist/main.js"]
