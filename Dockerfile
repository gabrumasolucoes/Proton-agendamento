# Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Produção (sem devDependencies; secrets vêm do Railway em runtime, não ARG/ENV)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.js ./
COPY api ./api
COPY lib ./lib

EXPOSE 3000
CMD ["node", "server.js"]
