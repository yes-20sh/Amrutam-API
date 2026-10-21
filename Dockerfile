# ==============================================================================
# Stage 1: Build Application
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install native build tools for compiling C++ addons like bcrypt
RUN apk add --no-cache python3 make g++

# Copy package manifests for deterministic caching
COPY api/package.json api/package-lock.json* api/bun.lock* ./

# Install all dependencies (including devDependencies for Nest CLI & TypeScript)
RUN npm ci || npm install

# Copy configuration files and source code
COPY api/tsconfig*.json api/nest-cli.json ./
COPY api/src/ ./src/

# Compile NestJS TypeScript application into /dist
RUN npm run build

# ==============================================================================
# Stage 2: Production Dependencies
# ==============================================================================
FROM node:22-alpine AS dependencies

WORKDIR /usr/src/app

RUN apk add --no-cache python3 make g++

COPY api/package.json api/package-lock.json* api/bun.lock* ./

# Install only production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# ==============================================================================
# Stage 3: Minimal Production Runtime
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=8000

# Security: Run as non-privileged node user
USER node

# Copy production dependencies and compiled artifacts from prior stages
COPY --chown=node:node --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node api/package.json ./

EXPOSE 8000

# Healthcheck to verify the HTTP server is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/graphql || exit 1

# Start the compiled NestJS application
CMD ["node", "dist/main.js"]
