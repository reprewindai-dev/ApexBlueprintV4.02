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

# Use the runtime port configured via PORT and expose the actual server port
ENV PORT=3011
EXPOSE 3011

# Start the built server using Node
CMD ["npm", "run", "start"]
