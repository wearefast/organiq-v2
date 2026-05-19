# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root tsconfig (referenced by server tsconfig)
COPY tsconfig.base.json ./

# Copy server package files
COPY server/package.json server/package-lock.json* ./server/

# Install dependencies
WORKDIR /app/server
RUN npm ci

# Copy server source
COPY server/ ./

# Build
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files and install production deps only
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

# Copy built output
COPY --from=builder /app/server/dist ./dist

# Copy prompts (needed at runtime)
COPY server/src/prompts ./src/prompts

EXPOSE 3002

ENV NODE_ENV=production
ENV PORT=3002

CMD ["node", "dist/main.js"]
