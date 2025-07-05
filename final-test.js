#!/usr/bin/env node

// Final comprehensive test of all MCP tools
import { spawn } from "child_process";

const tests = [
  {
    name: "get-library-templates",
    message: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get-library-templates",
        arguments: {},
      },
    },
  },
  {
    name: "generate-image-from-library",
    message: {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "generate-image-from-library",
        arguments: {
          templateId: "website-screenshot",
          modifications: {
            websiteUrl: "https://www.google.com",
          },
        },
      },
    },
  },
  {
    name: "check-api-status",
    message: {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "check-api-status",
        arguments: {},
      },
    },
  },
];

console.log("🧪 Running comprehensive tests of all MCP tools...\n");

for (const test of tests) {
  console.log(`Testing ${test.name}...`);

  const serverProcess = spawn("node", ["build/index.js"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  await new Promise((resolve) => {
    let responseReceived = false;

    serverProcess.stdout.on("data", (data) => {
      const response = data.toString();
      if (response.includes(`"id":${test.message.id}`)) {
        try {
          const parsed = JSON.parse(
            response
              .split("\n")
              .find((line) => line.includes(`"id":${test.message.id}`))
          );
          if (
            parsed.result &&
            parsed.result.content &&
            parsed.result.content[0] &&
            parsed.result.content[0].text
          ) {
            console.log(`✅ ${test.name}: SUCCESS`);
          } else {
            console.log(`❌ ${test.name}: Invalid response format`);
          }
        } catch (e) {
          console.log(`❌ ${test.name}: Failed to parse response`);
        }
        responseReceived = true;
        serverProcess.kill();
        resolve();
      }
    });

    serverProcess.stderr.on("data", (data) => {
      // Ignore stderr unless there's an error
    });

    // Send the test message
    serverProcess.stdin.write(JSON.stringify(test.message) + "\n");

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.log(`⏰ ${test.name}: TIMEOUT`);
        serverProcess.kill();
        resolve();
      }
    }, 5000);
  });

  console.log(); // Add spacing between tests
}

console.log("🎉 All tests completed!");
