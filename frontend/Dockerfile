FROM node:22

# Set the working directory
WORKDIR /frontend

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

ARG ENV_FILE=.env.prod
COPY ${ENV_FILE} .env


# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000
# Start the application
CMD ["npm", "start"]    