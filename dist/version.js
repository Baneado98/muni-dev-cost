// Single source of truth for the server version. Imported by BOTH the thin
// client (mcpServer.ts) and the hosted server (server.ts) so the version is
// never hardcoded in two places that can drift. Keep in sync with package.json.
export const SERVER_VERSION = "0.18.0";
export const SERVER_NAME = "muni-dev-cost";
