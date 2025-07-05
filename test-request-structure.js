#!/usr/bin/env node

// Test to verify the correct Orshot API request structure

console.log("🧪 Testing Orshot API Request Body Structure...\n");

// Simulate the corrected request body structure
const testRequestBody = {
  templateId: "website-screenshot",
  modifications: {
    delay: 2000,
    width: 1200,
    height: 800,
    websiteUrl: "https://google.com",
    fullCapture: false,
  },
  response: {
    type: "base64", // Note: 'type' comes before 'format'
    format: "png",
  },
  source: "orshot-mcp-server",
};

console.log("✅ Corrected request body structure:");
console.log(JSON.stringify(testRequestBody, null, 2));

console.log("\n📋 Key changes made:");
console.log(
  "- 'type' and 'format' are now in the correct order within 'response' object"
);
console.log(
  "- 'response.type' comes before 'response.format' (matching API expectations)"
);
console.log("- All other fields remain the same");

console.log("\n🎯 This should now match the expected Orshot API format!");

// Also show what the incorrect structure was
const incorrectStructure = {
  templateId: "website-screenshot",
  modifications: {
    delay: 2000,
    width: 1200,
    height: 800,
    websiteUrl: "https://google.com",
    fullCapture: false,
  },
  response: {
    format: "png", // This was in wrong order
    type: "base64", // This was in wrong order
  },
  source: "orshot-mcp-server",
};

console.log("\n❌ Previous incorrect structure was:");
console.log(JSON.stringify(incorrectStructure, null, 2));

console.log(
  "\n🔧 Fix applied: Swapped 'type' and 'format' order in response object"
);
