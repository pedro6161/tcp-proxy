FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json first (for better Docker layer caching)
COPY package.json ./

# Install dependencies if any exist, otherwise skip
RUN if [ -f package.json ] && [ "$(cat package.json | grep -c '\"dependencies\"')" -gt 0 ]; then npm install --only=production; fi

# Copy application code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose ports
EXPOSE 443 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start application
CMD ["node", "index.js"]
