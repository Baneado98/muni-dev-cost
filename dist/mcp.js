#!/usr/bin/env node
// stdio entrypoint for the muni-dev-cost MCP server.
//
// This is the binary `npx -y muni-dev-cost-mcp` runs. It is a THIN CLIENT: it
// carries no aggregation engine — every lookup (free dev-costs + premium tools)
// is served by the hosted server (see mcpServer.ts). That keeps the jurisdiction
// resolver, the normalized fee KB and the accumulating per-jurisdiction cache
// behind the paywall (the moat).
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./mcpServer.js";
async function main() {
    const server = buildMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("muni-dev-cost MCP server running on stdio.");
}
main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
