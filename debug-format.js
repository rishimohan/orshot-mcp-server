#!/usr/bin/env node

// Test to compare the MCP server request format with the direct API call format
import { spawn } from "child_process";

// Test both approaches side by side
console.log("=== Testing MCP Server Request Format ===");

// Start the MCP server
const serverProcess = spawn("node", ["build/index.js"], {
  stdio: ["pipe", "pipe", "pipe"],
});

// Test data that worked with direct API
const testMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "generate-image-from-library",
    arguments: {
      templateId: "website-screenshot",
      modifications: {
        websiteUrl: "https://www.example.com",
      },
      format: "png",
      responseType: "base64",
    },
  },
};

console.log("Sending to MCP server:", JSON.stringify(testMessage, null, 2));

// Send the test message
serverProcess.stdin.write(JSON.stringify(testMessage) + "\n");

// Handle responses
serverProcess.stdout.on("data", (data) => {
  console.log("MCP Server response:", data.toString());
});

serverProcess.stderr.on("data", (data) => {
  console.log("MCP Server error:", data.toString());
});

// Clean up after 3 seconds
setTimeout(() => {
  serverProcess.kill();
  process.exit(0);
}, 3000);
