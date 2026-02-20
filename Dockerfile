# Build Frontend
FROM node:20-alpine as client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Setup Server
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=client-build /app/client/dist ./public
COPY server/ ./server

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Start
EXPOSE 3000
CMD ["npm", "start"]
