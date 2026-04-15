FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public
COPY supabase ./supabase
COPY .env.example ./
COPY README.md ./

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["node", "src/server.js"]
