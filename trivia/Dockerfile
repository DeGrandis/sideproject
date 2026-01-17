# Use official Node.js LTS
FROM node:22

# Set the working directory
WORKDIR /trivia

# Copy package files
COPY package.json package-lock.json* ./

# Clean install dependencies
RUN npm i

# Copy the rest of the application code
COPY . .

# Build the Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Expose the port the app runs on
EXPOSE 3002

# Set production environment
ENV NODE_ENV=production

# Start the custom server (which includes Socket.IO)
CMD ["npm", "run", "start"]
