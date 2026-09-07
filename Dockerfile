FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY index.js ./
RUN mkdir -p /app/sessions
CMD ["node","index.js"]