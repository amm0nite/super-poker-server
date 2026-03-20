FROM node:24-trixie-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN useradd superpoker
USER superpoker

EXPOSE 8080

CMD [ "node", "index.js" ]
