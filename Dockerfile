FROM node:20-alpine

WORKDIR /app

# Copy package configurations
COPY package.json bun.lock* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application (compiles Vite frontend and server.ts)
RUN npm run build

# Expose the server port
EXPOSE 3000

# Start the built server using Node
CMD ["npm", "run", "start"]
