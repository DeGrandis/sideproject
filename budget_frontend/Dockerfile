FROM node:22

# Set the working directory
WORKDIR /budget_frontend

RUN ls -la
# Copy package.json and package-lock.json
COPY package.json ./

RUN rm -rf node_modules dist

# Install dependencies
RUN npm i

# Copy the rest of the application code
COPY . .
RUN ls -la 
# ARG ENV_FILE=.env.prod
# COPY ${ENV_FILE} .env


# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001
# Start the application
CMD ["npm", "run", "start"]    