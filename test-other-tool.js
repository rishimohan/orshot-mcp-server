#!/usr/bin/env node

// Test the get-library-templates tool to see if it has the same parameter issue
import { spawn } from "child_process";

const testMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "get-library-templates",
    arguments: {},
  },
};

console.log("Testing get-library-templates tool");

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
