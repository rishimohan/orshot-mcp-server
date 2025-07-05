#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Orshot API configuration
const ORSHOT_API_BASE = "https://api.orshot.com";

// Create server instance
const server = new McpServer({
  name: "orshot-mcp-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Type definitions for Orshot API responses
interface OrShotLibraryResponse {
  data: {
    download_url: string;
    task_id: string;
    status: string;
  };
}

interface OrShotStudioResponse {
  data: {
    download_url: string;
    task_id: string;
    status: string;
  };
}

// Helper function for making Orshot API requests
async function makeOrShotRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making Orshot API request:", error);
    return null;
  }
}

// Tool 1: Generate Image From Library Template
server.tool(
  "generate-image-from-library",
  "Generate an image from an Orshot library template using specified modifications",
  {
    type: "object",
    properties: {
      apiKey: {
        type: "string",
        description: "Orshot API key for authentication",
      },
      templateId: {
        type: "string",
        description: "The ID of the library template to use",
      },
      modifications: {
        type: "object",
        description: "Object containing modifications to apply to the template (e.g., text replacements, color changes)",
        additionalProperties: true,
      },
      format: {
        type: "string",
        enum: ["png", "jpg", "pdf"],
        default: "png",
        description: "Output format for the generated image",
      },
    },
    required: ["apiKey", "templateId"],
  },
  async ({ apiKey, templateId, modifications = {}, format = "png" }) => {
    const requestBody = {
      template_id: templateId,
      modifications,
      format,
    };

    const response = await makeOrShotRequest<OrShotLibraryResponse>(
      `${ORSHOT_API_BASE}/v1/generate/images`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to generate image from library template. Please check your API key and template ID.",
          },
        ],
      };
    }

    const { data } = response;
    return {
      content: [
        {
          type: "text",
          text: `Image generated successfully!
Task ID: ${data.task_id}
Status: ${data.status}
Download URL: ${data.download_url}

You can use the download URL to retrieve your generated image.`,
        },
      ],
    };
  }
);

// Tool 2: Generate Image From Orshot Studio Template
server.tool(
  "generate-image-from-studio",
  "Generate an image from an Orshot Studio template using specified data modifications",
  {
    type: "object",
    properties: {
      apiKey: {
        type: "string",
        description: "Orshot API key for authentication",
      },
      templateId: {
        type: "string",
        description: "The ID of the Orshot Studio template to use",
      },
      data: {
        type: "object",
        description: "Object containing data to populate the template (e.g., dynamic content, variable replacements)",
        additionalProperties: true,
      },
      format: {
        type: "string",
        enum: ["png", "jpg", "pdf"],
        default: "png",
        description: "Output format for the generated image",
      },
      webhook: {
        type: "string",
        format: "uri",
        description: "Optional webhook URL to receive notifications when the rendering is complete",
      },
    },
    required: ["apiKey", "templateId"],
  },
  async ({ apiKey, templateId, data = {}, format = "png", webhook }) => {
    const requestBody: any = {
      template_id: templateId,
      data,
      format,
    };

    if (webhook) {
      requestBody.webhook = webhook;
    }

    const response = await makeOrShotRequest<OrShotStudioResponse>(
      `${ORSHOT_API_BASE}/v1/studio/render`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to generate image from studio template. Please check your API key and template ID.",
          },
        ],
      };
    }

    const { data: responseData } = response;
    return {
      content: [
        {
          type: "text",
          text: `Studio image generated successfully!
Task ID: ${responseData.task_id}
Status: ${responseData.status}
Download URL: ${responseData.download_url}

${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}

You can use the download URL to retrieve your generated image.`,
        },
      ],
    };
  }
);

// Main function to run the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Orshot MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
