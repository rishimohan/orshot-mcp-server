#!/usr/bin/env node

// Simple test script to verify parameter passing works with MCP server
import { spawn } from "child_process";

// Test data
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
  console.error("Server error:", data.toString());
});

// Clean up after 5 seconds
setTimeout(() => {
  serverProcess.kill();
  process.exit(0);
}, 5000);
