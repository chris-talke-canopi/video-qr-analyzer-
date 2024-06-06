FROM node:16.13.0-alpine3.14

WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY package*.json /usr/src/app/
RUN npm install
RUN apk update
RUN apk add
RUN apk add ffmpeg

COPY . /usr/src/app

ENV PORT 1356
EXPOSE 1356
CMD [ "npm", "start" ]