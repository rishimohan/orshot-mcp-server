#!/usr/bin/env node

// Test direct API call to see what the Orshot API expects
import fs from "fs";
import { config } from "dotenv";

config();

const API_KEY = process.env.ORSHOT_API_KEY;

async function testDirectAPICall() {
  console.log("Testing direct API call...");

  const requestBody = {
    templateId: "website-screenshot",
    modifications: {
      websiteUrl: "https://www.example.com",
    },
    response: {
      format: "png",
      type: "base64",
    },
    source: "orshot-mcp-server",
  };

  console.log("Request body:", JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch("https://api.orshot.com/v1/generate/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response status:", response.status);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (response.ok) {
      try {
        const responseJson = JSON.parse(responseText);
        console.log("Parsed response:", responseJson);
      } catch (e) {
        console.log("Response is not JSON");
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testDirectAPICall();
