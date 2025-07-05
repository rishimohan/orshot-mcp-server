#!/usr/bin/env node

// Test that the manual .env loading works correctly
import { readFileSync } from "fs";

// Manually load environment variables from .env file
try {
  const envFile = readFileSync(".env", "utf8");
  const envLines = envFile.split("\n");
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (error) {
  console.error("Error loading .env file:", error.message);
  process.exit(1);
}

console.error(
  "ORSHOT_API_KEY loaded:",
  process.env.ORSHOT_API_KEY ? "YES" : "NO"
);
console.error(
  "Key starts with:",
  process.env.ORSHOT_API_KEY
    ? process.env.ORSHOT_API_KEY.substring(0, 8) + "..."
    : "N/A"
);
