# Minimal, deterministic image for MCP introspection (Glama et al.).
# Installs the already-published, pre-built npm package (ships dist/),
# so there is NO in-container TypeScript build that can fail.
FROM node:20-alpine
WORKDIR /app
RUN npm install --omit=dev --no-audit --no-fund muni-dev-cost-mcp@latest
ENV NODE_ENV=production
CMD ["npx", "--no-install", "muni-dev-cost-mcp"]
