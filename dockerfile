FROM node:16-alpine
WORKDIR /redux-server
COPY package.json .
RUN npm install
COPY . .
EXPOSE 7653
CMD ["npm", "start"]