FROM node:22-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev && npm cache clean --force

FROM node:22-alpine AS production

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=8000

COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./
COPY --chown=node:node .env* ./

USER node

EXPOSE 8000

CMD ["node", "dist/main.js"]
