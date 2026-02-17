# Multi-stage build for production (uses Yarn - project has yarn.lock)
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and lockfile
COPY package.json yarn.lock ./
COPY nest-cli.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for build)
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application (show full output)
RUN yarn build 2>&1 | tee /tmp/build.log || (echo "BUILD FAILED!" && cat /tmp/build.log && exit 1)

# List dist contents for debugging
RUN echo "=== Contents of dist/ after build ===" && ls -la dist/ || echo "dist/ does not exist"

# Verify build output exists (check both possible locations)
RUN (test -f dist/main.js || test -f dist/src/main.js) || (echo "ERROR: main.js not found after build!" && echo "=== Full dist/ contents ===" && find dist/ -name "main.js" && exit 1)

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files and lockfile
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production

# Copy built application from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Verify dist was copied (check both possible locations)
RUN (test -f dist/main.js || test -f dist/src/main.js) || (echo "ERROR: main.js not found after copy!" && find dist/ -name "main.js" && exit 1)

# Copy necessary files
COPY --chown=nestjs:nodejs nest-cli.json ./
COPY --chown=nestjs:nodejs package.json ./

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
