FROM node:20.20.2-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY src ./src

EXPOSE 3001

CMD ["npm", "start"]