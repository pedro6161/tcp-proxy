FROM node:18-alpine

WORKDIR /app

# Copy files directly - NO NPM COMMANDS AT ALL
COPY index.js ./
COPY healthcheck.js ./

# Create minimal package.json in container (optional)
RUN echo '{"name":"mt4-proxy","version":"1.0.0","main":"index.js"}' > package.json

# No dependencies, no npm install, no npm ci - NOTHING!

# Expose ports
EXPOSE 443 8080

# Start directly with node
CMD ["node", "index.js"]
