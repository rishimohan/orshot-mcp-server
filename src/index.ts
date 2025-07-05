#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "fs";
import { z } from "zod";

// Manually load environment variables from .env file to avoid stdout pollution
try {
  const envFile = readFileSync('.env', 'utf8');
  const envLines = envFile.split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (error) {
  // .env file not found or not readable, continue without it
}

// Orshot API configuration
const ORSHOT_API_BASE = "https://api.orshot.com";
const DEFAULT_API_KEY = process.env.ORSHOT_API_KEY || "test-key-for-debugging";

// Create server instance
const server = new McpServer({
  name: "orshot-mcp-server",
  version: "1.4.1",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Type definitions for Orshot API responses
interface OrShotLibraryResponse {
  success: boolean;
  message?: string;
  data?: string; // base64 data when type is base64
  url?: string;  // download URL when type is url
  task_id?: string;
  status?: string;
}

interface OrShotStudioResponse {
  success: boolean;
  message?: string;
  data?: string; // base64 data when type is base64
  url?: string;  // download URL when type is url
  task_id?: string;
  status?: string;
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

// Helper function to determine template type (library vs studio)
async function getTemplateType(templateId: string, apiKey: string): Promise<'library' | 'studio' | null> {
  try {
    // First check if it's a library template
    const libraryResponse = await fetch(`${ORSHOT_API_BASE}/v1/templates`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (libraryResponse.ok) {
      const libraryData = await libraryResponse.json();
      const libraryTemplates = Array.isArray(libraryData) ? libraryData : [];
      
      // Check if templateId exists in library templates
      const isLibraryTemplate = libraryTemplates.some((template: any) => 
        template.id === templateId || template.template_id === templateId
      );
      
      if (isLibraryTemplate) {
        return 'library';
      }
    }

    // Then check if it's a studio template
    const studioResponse = await fetch(`${ORSHOT_API_BASE}/v1/studio/templates`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (studioResponse.ok) {
      const studioData = await studioResponse.json();
      const studioTemplates = studioData.templates || studioData.data || [];
      
      // Check if templateId exists in studio templates
      const isStudioTemplate = studioTemplates.some((template: any) => 
        template.id === templateId || template.template_id === templateId
      );
      
      if (isStudioTemplate) {
        return 'studio';
      }
    }

    return null; // Template not found in either
  } catch (error) {
    console.error("Error determining template type:", error);
    return null;
  }
}

// Tool 1: Generate Image From Library Template
server.tool(
  "generate-image-from-library",
  "Generate an image from an Orshot library template using specified modifications",
  {
    apiKey: z.string().optional().describe("Orshot API key for authentication (optional if set in environment)"),
    templateId: z.string().describe("The ID of the library template to use"),
    modifications: z.record(z.any()).default({}).describe("Object containing modifications to apply to the template (e.g., text replacements, color changes)"),
    format: z.enum(["png", "jpg", "pdf"]).default("png").describe("Output format for the generated image"),
    responseType: z.enum(["base64", "url", "binary"]).default("base64").describe("Response type: base64 data, download URL, or binary data"),
  },
  async (args) => {
    const { apiKey, templateId, modifications, format, responseType } = args;
    const actualApiKey = apiKey || DEFAULT_API_KEY;
    
    if (!actualApiKey) {
      return {
        content: [
          {
            type: "text",
            text: "No API key provided. Please provide an API key parameter or set ORSHOT_API_KEY environment variable.",
          },
        ],
      };
    }
    const requestBody = {
      templateId: templateId,
      modifications: modifications,
      response: {
        type: responseType,
        format: format
      },
      source: "orshot-mcp-server"
    };

    const response = await makeOrShotRequest<OrShotLibraryResponse>(
      `${ORSHOT_API_BASE}/v1/generate/images`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${actualApiKey}`,
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
    
    // Handle different response types
    if (responseType === "base64" && response.data && response.data.startsWith('data:image/')) {
      // Return the image inline for base64 responses
      return {
        content: [
          {
            type: "image",
            data: response.data,
            mimeType: response.data.split(';')[0].split(':')[1], // Extract MIME type from data URL
          },
          {
            type: "text",
            text: `Image generated successfully from library template!
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${response.url ? `Download URL: ${response.url}` : ''}`,
          },
        ],
      };
    } else if (responseType === "url" && response.url) {
      // Return clickable URL for url responses
      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully from library template!

🖼️ **Your image is ready!** 
📥 Download: [Click here to download](${response.url})

Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}

💡 *Tip: The download link will expire after some time, so save your image soon!*`,
          },
        ],
      };
    } else if (responseType === "binary") {
      // Handle binary response
      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully from library template!

📋 **Binary data response received**
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${response.url ? `Alternative download URL: ${response.url}` : ''}

💡 *Note: Binary data has been returned. If you need a viewable format, try using responseType "base64" or "url" instead.*`,
          },
        ],
      };
    }
    
    // Fallback to text response
    return {
      content: [
        {
          type: "text",
          text: `Image generated successfully from library template!
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
URL: ${response.url || 'Not available'}

${response.data ? 'Image data is available in the response.' : 'You can use the URL to retrieve your generated image.'}`,
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
    apiKey: z.string().optional().describe("Orshot API key for authentication (optional if set in environment)"),
    templateId: z.string().describe("The ID of the Orshot Studio template to use"),
    data: z.record(z.any()).default({}).describe("Object containing data to populate the template (e.g., dynamic content, variable replacements)"),
    format: z.enum(["png", "jpg", "pdf"]).default("png").describe("Output format for the generated image"),
    responseType: z.enum(["base64", "url", "binary"]).default("base64").describe("Response type: base64 data, download URL, or binary data"),
    webhook: z.string().url().optional().describe("Optional webhook URL to receive notifications when the rendering is complete"),
  },
  async (args) => {
    const { apiKey, templateId, data, format, responseType, webhook } = args;
    const actualApiKey = apiKey || DEFAULT_API_KEY;
    
    if (!actualApiKey) {
      return {
        content: [
          {
            type: "text",
            text: "No API key provided. Please provide an API key parameter or set ORSHOT_API_KEY environment variable.",
          },
        ],
      };
    }
    const requestBody: any = {
      templateId: templateId,
      modifications: data,
      response: {
        type: responseType,
        format: format
      },
      source: "orshot-mcp-server"
    };

    if (webhook) {
      requestBody.webhook = webhook;
    }

    const response = await makeOrShotRequest<OrShotStudioResponse>(
      `${ORSHOT_API_BASE}/v1/studio/render`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${actualApiKey}`,
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
    
    // Handle different response types
    if (responseType === "base64" && response.data && response.data.startsWith('data:image/')) {
      // Return the image inline for base64 responses
      return {
        content: [
          {
            type: "image",
            data: response.data,
            mimeType: response.data.split(';')[0].split(':')[1], // Extract MIME type from data URL
          },
          {
            type: "text",
            text: `Studio image generated successfully!
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${response.url ? `Download URL: ${response.url}` : ''}
${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}`,
          },
        ],
      };
    } else if (responseType === "url" && response.url) {
      // Return clickable URL for url responses
      return {
        content: [
          {
            type: "text",
            text: `Studio image generated successfully!

🖼️ **Your image is ready!** 
📥 Download: [Click here to download](${response.url})

Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}

💡 *Tip: The download link will expire after some time, so save your image soon!*`,
          },
        ],
      };
    } else if (responseType === "binary") {
      // Handle binary response
      return {
        content: [
          {
            type: "text",
            text: `Studio image generated successfully!

📋 **Binary data response received**
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${response.url ? `Alternative download URL: ${response.url}` : ''}
${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}

💡 *Note: Binary data has been returned. If you need a viewable format, try using responseType "base64" or "url" instead.*`,
          },
        ],
      };
    }
    
    // Fallback to text response
    return {
      content: [
        {
          type: "text",
          text: `Studio image generated successfully!
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
URL: ${response.url || 'Not available'}

${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}

${response.data ? 'Image data is available in the response.' : 'You can use the URL to retrieve your generated image.'}`,
        },
      ],
    };
  }
);

// Tool 3: Generate Image (Auto-detect template type)
server.tool(
  "generate-image",
  "Generate an image from an Orshot template (automatically detects library vs studio template)",
  {
    apiKey: z.string().optional().describe("Orshot API key for authentication (optional if set in environment)"),
    templateId: z.string().describe("The ID of the template to use (will auto-detect if it's library or studio)"),
    modifications: z.record(z.any()).default({}).describe("Object containing modifications/data to apply to the template (works for both library and studio templates)"),
    format: z.enum(["png", "jpg", "pdf"]).default("png").describe("Output format for the generated image"),
    responseType: z.enum(["base64", "url", "binary"]).default("base64").describe("Response type: base64 data, download URL, or binary data"),
    webhook: z.string().url().optional().describe("Optional webhook URL to receive notifications (studio templates only)"),
  },
  async (args) => {
    const { apiKey, templateId, modifications, format, responseType, webhook } = args;
    const actualApiKey = apiKey || DEFAULT_API_KEY;
    
    if (!actualApiKey) {
      return {
        content: [
          {
            type: "text",
            text: "No API key provided. Please provide an API key parameter or set ORSHOT_API_KEY environment variable.",
          },
        ],
      };
    }

    // Determine template type
    const templateType = await getTemplateType(templateId, actualApiKey);
    
    if (!templateType) {
      return {
        content: [
          {
            type: "text",
            text: `Template "${templateId}" not found in either library or studio templates. Please check the template ID.`,
          },
        ],
      };
    }

    if (templateType === 'library') {
      // Use library template endpoint
      const requestBody = {
        templateId: templateId,
        modifications,
        response: {
          type: responseType,
          format: format
        },
        source: "orshot-mcp-server"
      };

      const response = await makeOrShotRequest<OrShotLibraryResponse>(
        `${ORSHOT_API_BASE}/v1/generate/images`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${actualApiKey}`,
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
      
      // Handle different response types for library templates
      if (responseType === "base64" && response.data && response.data.startsWith('data:image/')) {
        return {
          content: [
            {
              type: "image",
              data: response.data,
              mimeType: response.data.split(';')[0].split(':')[1], // Extract MIME type from data URL
            },
            {
              type: "text",
              text: `Image generated successfully from library template!
Template Type: Library
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${response.url ? `Download URL: ${response.url}` : ''}`,
            },
          ],
        };
      } else if (responseType === "url" && response.url) {
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully from library template!

🖼️ **Your image is ready!** 
📥 Download: [Click here to download](${response.url})

Template Type: Library
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}

💡 *Tip: The download link will expire after some time, so save your image soon!*`,
            },
          ],
        };
      } else if (responseType === "binary") {
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully from library template!

📋 **Binary data response received**
Template Type: Library
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${response.url ? `Alternative download URL: ${response.url}` : ''}

💡 *Note: Binary data has been returned. If you need a viewable format, try using responseType "base64" or "url" instead.*`,
            },
          ],
        };
      }
      
      // Fallback to text response
      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully from library template!
Template Type: Library
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
URL: ${response.url || 'Not available'}

${response.data ? 'Image data is available in the response.' : 'You can use the URL to retrieve your generated image.'}`,
          },
        ],
      };
    } else {
      // Use studio template endpoint
      const requestBody: any = {
        templateId: templateId,
        modifications: modifications, // Studio templates use 'modifications' field
        response: {
          type: responseType,
          format: format
        },
        source: "orshot-mcp-server"
      };

      if (webhook) {
        requestBody.webhook = webhook;
      }

      const response = await makeOrShotRequest<OrShotStudioResponse>(
        `${ORSHOT_API_BASE}/v1/studio/render`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${actualApiKey}`,
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
      
      // Handle different response types for studio templates
      if (responseType === "base64" && response.data && response.data.startsWith('data:image/')) {
        return {
          content: [
            {
              type: "image",
              data: response.data,
              mimeType: response.data.split(';')[0].split(':')[1], // Extract MIME type from data URL
            },
            {
              type: "text",
              text: `Image generated successfully from studio template!
Template Type: Studio
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${response.url ? `Download URL: ${response.url}` : ''}
${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}`,
            },
          ],
        };
      } else if (responseType === "url" && response.url) {
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully from studio template!

🖼️ **Your image is ready!** 
📥 Download: [Click here to download](${response.url})

Template Type: Studio
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}

💡 *Tip: The download link will expire after some time, so save your image soon!*`,
            },
          ],
        };
      } else if (responseType === "binary") {
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully from studio template!

📋 **Binary data response received**
Template Type: Studio
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${response.url ? `Alternative download URL: ${response.url}` : ''}
${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}

💡 *Note: Binary data has been returned. If you need a viewable format, try using responseType "base64" or "url" instead.*`,
            },
          ],
        };
      }
      
      // Fallback to text response
      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully from studio template!
Template Type: Studio
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
URL: ${response.url || 'Not available'}

${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}

${response.data ? 'Image data is available in the response.' : 'You can use the URL to retrieve your generated image.'}`,
          },
        ],
      };
    }
  }
);

// Tool 4: Get Library Templates
server.tool(
  "get-library-templates",
  "Get all available library templates for the user using their API key",
  {
    apiKey: z.string().optional().describe("Orshot API key for authentication (optional if set in environment)"),
  },
  async (args) => {
    const { apiKey } = args;
    const actualApiKey = apiKey || DEFAULT_API_KEY;
    
    if (!actualApiKey) {
      return {
        content: [
          {
            type: "text",
            text: "No API key provided. Please provide an API key parameter or set ORSHOT_API_KEY environment variable.",
          },
        ],
      };
    }

    try {
      const response = await fetch(`${ORSHOT_API_BASE}/v1/templates`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${actualApiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const templates = await response.json();
      const templateArray = Array.isArray(templates) ? templates : [];

      if (templateArray.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No library templates found for your account.",
            },
          ],
        };
      }

      const templateList = templateArray.map((template: any, index: number) => {
        const modifications = template.modifications || [];
        const modificationsList = modifications.length > 0 
          ? modifications.map((mod: any) => `  - ${mod.key}: ${mod.description || 'No description'}`).join('\n')
          : '  - No modifications available';

        return `${index + 1}. **${template.title || 'Untitled'}**
   ID: ${template.id}
   Description: ${template.description || 'No description'}
   Available Modifications:
${modificationsList}`;
      }).join('\n\n');

      return {
        content: [
          {
            type: "text",
            text: `Found ${templateArray.length} library template(s):\n\n${templateList}`,
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch library templates: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 5: Get Studio Templates
server.tool(
  "get-studio-templates",
  "Get all available studio templates for the user using their API key",
  {
    apiKey: z.string().optional().describe("Orshot API key for authentication (optional if set in environment)"),
  },
  async (args) => {
    const { apiKey } = args;
    const actualApiKey = apiKey || DEFAULT_API_KEY;
    
    if (!actualApiKey) {
      return {
        content: [
          {
            type: "text",
            text: "No API key provided. Please provide an API key parameter or set ORSHOT_API_KEY environment variable.",
          },
        ],
      };
    }

    try {
      // Try multiple possible endpoints for studio templates
      let response;
      let studioTemplates = [];

      // First try the main studio templates endpoint
      try {
        response = await fetch(`${ORSHOT_API_BASE}/v1/studio/templates`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${actualApiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          studioTemplates = data.templates || data.data || data || [];
        }
      } catch (error) {
        console.error("Error fetching from /v1/studio/templates:", error);
      }

      // If no templates found, try alternative endpoint
      if (studioTemplates.length === 0) {
        try {
          response = await fetch(`${ORSHOT_API_BASE}/v1/studio`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${actualApiKey}`,
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            studioTemplates = data.templates || data.data || data || [];
          }
        } catch (error) {
          console.error("Error fetching from /v1/studio:", error);
        }
      }

      if (studioTemplates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No studio templates found for your account. You may need to create templates in Orshot Studio first.",
            },
          ],
        };
      }

      const templateList = studioTemplates.map((template: any, index: number) => {
        return `${index + 1}. **${template.title || template.name || 'Untitled'}**
   ID: ${template.id || template.template_id}
   Description: ${template.description || 'No description'}
   ${template.created_at ? `Created: ${new Date(template.created_at).toLocaleDateString()}` : ''}
   ${template.updated_at ? `Updated: ${new Date(template.updated_at).toLocaleDateString()}` : ''}`;
      }).join('\n\n');

      return {
        content: [
          {
            type: "text",
            text: `Found ${studioTemplates.length} studio template(s):\n\n${templateList}`,
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch studio templates: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 6: Get Template Modifications
server.tool(
  "get-template-modifications",
  "Get available modifications for a specific template (works for both library and studio templates)",
  {
    apiKey: z.string().optional().describe("Orshot API key for authentication (optional if set in environment)"),
    templateId: z.string().describe("The ID of the template to get modifications for"),
    templateType: z.enum(["library", "studio", "auto"]).default("auto").describe("Type of template (library, studio, or auto-detect)"),
  },
  async (args) => {
    const { apiKey, templateId, templateType } = args;
    const actualApiKey = apiKey || DEFAULT_API_KEY;
    
    if (!actualApiKey) {
      return {
        content: [
          {
            type: "text",
            text: "No API key provided. Please provide an API key parameter or set ORSHOT_API_KEY environment variable.",
          },
        ],
      };
    }

    try {
      let modifications: any[] = [];
      let detectedType: "library" | "studio" = templateType === "auto" ? "library" : templateType;

      if (templateType === "auto") {
        // Auto-detect template type
        const autoDetectedType = await getTemplateType(templateId, actualApiKey);
        if (!autoDetectedType) {
          return {
            content: [
              {
                type: "text",
                text: `Template "${templateId}" not found in either library or studio templates.`,
              },
            ],
          };
        }
        detectedType = autoDetectedType;
      }

      if (detectedType === "library") {
        // Get library template modifications
        try {
          // First try to get template details from the templates endpoint
          const templatesResponse = await fetch(`${ORSHOT_API_BASE}/v1/templates`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${actualApiKey}`,
              "Content-Type": "application/json",
            },
          });

          if (templatesResponse.ok) {
            const templates = await templatesResponse.json();
            const templateArray = Array.isArray(templates) ? templates : [];
            const selectedTemplate = templateArray.find((template: any) => template.id === templateId);

            if (selectedTemplate && selectedTemplate.modifications) {
              modifications = selectedTemplate.modifications;
            }
          }

          // Fallback to modifications endpoint if template doesn't have modifications
          if (modifications.length === 0) {
            const modResponse = await fetch(`${ORSHOT_API_BASE}/v1/templates/modifications?template_id=${templateId}`, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${actualApiKey}`,
                "Content-Type": "application/json",
              },
            });

            if (modResponse.ok) {
              const modData = await modResponse.json();
              modifications = Array.isArray(modData) ? modData : [];
            }
          }
        } catch (error) {
          console.error("Error fetching library template modifications:", error);
        }
      } else if (detectedType === "studio") {
        // Get studio template modifications
        try {
          const response = await fetch(`${ORSHOT_API_BASE}/v1/studio/template/modifications?templateId=${templateId}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${actualApiKey}`,
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const modData = await response.json();
            modifications = Array.isArray(modData) ? modData : [];
          }
        } catch (error) {
          console.error("Error fetching studio template modifications:", error);
        }
      }

      if (modifications.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No modifications found for ${detectedType} template "${templateId}". This template may not have any customizable elements.`,
            },
          ],
        };
      }

      const modificationsList = modifications.map((mod: any, index: number) => {
        const key = mod.key || mod.id;
        const description = mod.description || 'No description';
        const examples = mod.examples ? ` (e.g., ${mod.examples.slice(0, 2).join(', ')})` : '';

        return `${index + 1}. **${key}**${examples}
   ${description}`;
      }).join('\n\n');

      return {
        content: [
          {
            type: "text",
            text: `Found ${modifications.length} modification(s) for ${detectedType} template "${templateId}":\n\n${modificationsList}`,
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch template modifications: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 7: Check API Status
server.tool(
  "check-api-status",
  "Check the API connectivity and validate the API key",
  {
    apiKey: z.string().optional().describe("Orshot API key for authentication (optional if set in environment)"),
  },
  async (args) => {
    const { apiKey } = args;
    const actualApiKey = apiKey || DEFAULT_API_KEY;
    
    if (!actualApiKey) {
      return {
        content: [
          {
            type: "text",
            text: "❌ No API key provided. Please provide an API key parameter or set ORSHOT_API_KEY environment variable.",
          },
        ],
      };
    }

    try {
      // Test API connectivity with a simple endpoint
      const response = await fetch(`${ORSHOT_API_BASE}/v1/templates`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${actualApiKey}`,
          "Content-Type": "application/json",
        },
      });

      const statusCode = response.status;
      const statusText = response.statusText;

      if (response.ok) {
        const data = await response.json();
        const templateCount = Array.isArray(data) ? data.length : 0;
        
        return {
          content: [
            {
              type: "text",
              text: `✅ API Status: Connected successfully!
🔑 API Key: Valid
📊 Status Code: ${statusCode} ${statusText}
📝 Templates Found: ${templateCount}
🌐 API Base URL: ${ORSHOT_API_BASE}

Your Orshot API integration is working correctly.`,
            },
          ],
        };
      } else {
        let errorMessage = `HTTP ${statusCode} ${statusText}`;
        
        try {
          const errorData = await response.text();
          const parsedError = JSON.parse(errorData);
          if (parsedError.message) {
            errorMessage = parsedError.message;
          } else if (parsedError.error) {
            errorMessage = parsedError.error;
          }
        } catch {
          // If we can't parse the error, use the raw response
        }

        return {
          content: [
            {
              type: "text",
              text: `❌ API Status: Connection failed
🔑 API Key: ${statusCode === 401 ? 'Invalid or expired' : 'Potentially valid'}
📊 Status Code: ${statusCode} ${statusText}
🌐 API Base URL: ${ORSHOT_API_BASE}
❗ Error: ${errorMessage}

${statusCode === 401 ? 'Please check your API key.' : 
  statusCode === 403 ? 'API key valid but insufficient permissions.' :
  statusCode === 404 ? 'API endpoint not found.' :
  statusCode >= 500 ? 'Orshot server error. Try again later.' :
  'Unknown error occurred.'}`,
            },
          ],
        };
      }

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ API Status: Network error
🌐 API Base URL: ${ORSHOT_API_BASE}
❗ Error: ${error instanceof Error ? error.message : 'Unknown network error'}

This could be due to:
- Network connectivity issues
- Firewall blocking the request
- DNS resolution problems
- Orshot service unavailable`,
          },
        ],
      };
    }
  }
);



// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Orshot MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
