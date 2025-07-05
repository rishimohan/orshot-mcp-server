#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "test-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "test-tool",
  "A test tool",
  {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "A test message",
      },
    },
    required: ["message"],
  },
  async (args, extra) => {
    return {
      content: [
        {
          type: "text",
          text: `Args: ${JSON.stringify(args)}, Extra: ${JSON.stringify(
            extra
          )}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Test MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
