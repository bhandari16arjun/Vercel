# build-server/Dockerfile
FROM node:20-slim

# Install git for cloning
RUN apt-get update && apt-get install -y git

WORKDIR /home/app

COPY package*.json .
RUN npm install

COPY . .
RUN npm run build

# Make the output directory
RUN mkdir -p dist/src/output

CMD ["npm", "start"]
