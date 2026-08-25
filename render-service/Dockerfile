# Plain node:slim + apt-installed Chromium/ffmpeg rather than the official
# puppeteer/puppeteer image -- puppeteer-core (no bundled Chromium download)
# pointed at the apt package via PUPPETEER_EXECUTABLE_PATH is a well-known,
# version-independent pattern that doesn't depend on internal paths/env vars
# of a third-party base image.
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]
