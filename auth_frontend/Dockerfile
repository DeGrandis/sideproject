# Build the site with Node, then serve the built files from a small nginx
# image on the same port 3000. The running image holds only the site (tens
# of MB), not Node, every dependency and npm's cache (over a GB on disk).
FROM node:22-slim AS build
WORKDIR /auth_frontend
# Install from package.json alone, as before: the lockfile was made on
# another OS and lacks Linux's build of Rollup (npm's optional-deps bug).
COPY package.json ./
RUN npm i --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /auth_frontend/dist /usr/share/nginx/html
EXPOSE 3000
