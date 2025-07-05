#!/usr/bin/env node

// Test the check-api-status tool to see if it receives an optional parameter correctly
import { spawn } from "child_process";

const testMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "check-api-status",
    arguments: {
      apiKey: "test-custom-key",
    },
  },
};

console.log("Testing check-api-status tool with apiKey parameter");

// Start the MCP server
const serverProcess = spawn("node", ["build/index.js"], {
  stdio: ["pipe", "pipe", "pipe"],
});

// Send the test message
serverProcess.stdin.write(JSON.stringify(testMessage) + "\n");

// Handle responses
serverProcess.stdout.on("data", (data) => {
  console.log("Server response:", data.toString());
});

serverProcess.stderr.on("data", (data) => {
  console.log("Server error:", data.toString());
});

// Clean up after 3 seconds
setTimeout(() => {
  serverProcess.kill();
  process.exit(0);
}, 3000);
