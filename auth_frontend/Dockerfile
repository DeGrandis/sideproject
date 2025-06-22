

FROM alpine AS shared-assets

# RUN ls -la
WORKDIR /app
COPY shared-packages shared-packages

FROM node:22 AS app-builder

# Set the working directory
WORKDIR /auth_frontend

# Copy package.json and package-lock.json
COPY auth_frontend/package.json /auth_frontend/package-lock.json ./

COPY --from=shared-assets app/shared-packages ./shared-packages

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY ./auth_frontend ./
run ls -la 
# ARG ENV_FILE=.env.prod
# COPY ${ENV_FILE} .env

ENV SHARED_PACKAGES_PATH=/shared-packages

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000
# Start the application
CMD ["npm", "start"]    