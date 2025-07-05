#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "fs";
import { z } from "zod";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { createServer } from "http";

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
const ORSHOT_API_BASE = config.api.baseUrl;
const DEFAULT_API_KEY = process.env.ORSHOT_API_KEY;

// Validation for required environment variables
if (!DEFAULT_API_KEY && config.security.requireApiKey) {
  logger.warn("ORSHOT_API_KEY environment variable not set. API key must be provided in requests.");
} else if (DEFAULT_API_KEY) {
  logger.info("Orshot API key loaded from environment");
}

// Create server instance
const server = new McpServer({
  name: config.server.name,
  version: config.server.version,
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Simple health check server for Railway
const healthCheckPort = process.env.PORT || 3000;
const healthServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      service: 'orshot-mcp-server',
      version: config.server.version,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
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

// Helper function for making Orshot API requests with proper error handling and retries
async function makeOrShotRequest<T>(
  url: string,
  options: RequestInit = {},
  retries: number = config.api.retries
): Promise<T | null> {
  let lastError: Error | null = null;
  
  logger.time(`API Request: ${url}`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.api.timeout);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `${config.server.name}/${config.server.version}`,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status} ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Use the raw error text if JSON parsing fails
          errorMessage = errorText || errorMessage;
        }
        
        logger.apiRequest(options.method || 'GET', url, response.status);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      logger.apiRequest(options.method || 'GET', url, response.status);
      logger.timeEnd(`API Request: ${url}`);
      return result as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`Request timeout on attempt ${attempt}/${retries}`, { url, timeout: config.api.timeout });
      } else {
        logger.error(`Request failed on attempt ${attempt}/${retries}`, { url, error: lastError.message });
      }
      
      // Don't retry for certain error types
      if (error instanceof Error && 
          (error.message.includes('401') || error.message.includes('403') || error.message.includes('404'))) {
        break;
      }
      
      if (attempt < retries) {
        // Exponential backoff with configurable delay
        const delay = Math.pow(2, attempt - 1) * config.api.retryDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        logger.debug(`Retrying request after ${delay}ms delay`, { url, attempt: attempt + 1, retries });
      }
    }
  }
  
  logger.error("All retry attempts failed", { url, error: lastError?.message });
  logger.timeEnd(`API Request: ${url}`);
  return null;
}

// Helper function to validate and sanitize template ID
function validateTemplateId(templateId: string): { isValid: boolean; sanitized: string; error?: string } {
  if (!templateId || typeof templateId !== 'string') {
    const error = 'Template ID is required and must be a string';
    logger.validation('template-id', false, error);
    return { isValid: false, sanitized: '', error };
  }
  
  const sanitized = templateId.trim();
  if (sanitized.length === 0) {
    const error = 'Template ID cannot be empty';
    logger.validation('template-id', false, error);
    return { isValid: false, sanitized: '', error };
  }
  
  if (sanitized.length > config.security.maxTemplateIdLength) {
    const error = `Template ID is too long (max ${config.security.maxTemplateIdLength} characters)`;
    logger.validation('template-id', false, error);
    return { isValid: false, sanitized: '', error };
  }
  
  // Allow alphanumeric, hyphens, underscores for library templates and numbers for studio templates
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    const error = 'Template ID contains invalid characters';
    logger.validation('template-id', false, error);
    return { isValid: false, sanitized: '', error };
  }
  
  logger.validation('template-id', true);
  return { isValid: true, sanitized };
}

// Helper function to validate API key format
function validateApiKey(apiKey: string): { isValid: boolean; error?: string } {
  if (!apiKey || typeof apiKey !== 'string') {
    const error = 'API key is required';
    logger.validation('api-key', false, error);
    return { isValid: false, error };
  }
  
  const trimmed = apiKey.trim();
  if (trimmed.length < 10) {
    const error = 'API key appears to be too short';
    logger.validation('api-key', false, error);
    return { isValid: false, error };
  }
  
  if (trimmed.length > config.security.maxApiKeyLength) {
    const error = 'API key is too long';
    logger.validation('api-key', false, error);
    return { isValid: false, error };
  }
  
  logger.validation('api-key', true);
  return { isValid: true };
}
async function autoMapModifications(templateId: string, inputModifications: Record<string, any>, apiKey: string): Promise<Record<string, any>> {
  if (!config.features.autoMapping) {
    logger.debug("Auto-mapping is disabled, returning input as-is");
    return inputModifications;
  }

  try {
    logger.debug(`Starting auto-mapping for template ${templateId}`);
    
    // Get template modifications to understand the expected fields
    const response = await fetch(`${ORSHOT_API_BASE}/v1/studio/template/modifications?templateId=${templateId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      logger.warn("Failed to fetch template modifications for auto-mapping", { templateId, status: response.status });
      return inputModifications;
    }

    const modifications = await response.json();
    const modArray = Array.isArray(modifications) ? modifications : [];
    
    if (modArray.length === 0) {
      logger.warn("No modifications found for template, using input as-is", { templateId });
      return inputModifications;
    }

    logger.debug(`Found ${modArray.length} template modifications`, { 
      templateId, 
      modifications: modArray.map((m: any) => ({ key: m.key || m.id, description: m.description })) 
    });

    // Create a mapping object
    const mappedModifications = { ...inputModifications };
    
    // Helper function to check if a string is a URL
    const isUrl = (str: string) => {
      try {
        const url = new URL(str);
        return url.protocol === 'https:' || url.protocol === 'http:';
      } catch {
        return false;
      }
    };

    // Look for URL patterns in input and map to appropriate fields
    for (const [key, value] of Object.entries(inputModifications)) {
      if (typeof value === 'string' && isUrl(value)) {
        // This is a URL - find the best matching modification field
        const urlMod = modArray.find((mod: any) => {
          const modKey = (mod.key || mod.id || '').toLowerCase();
          const modDesc = (mod.description || '').toLowerCase();
          return (
            modKey.includes('image') ||
            modKey.includes('url') ||
            modKey.includes('photo') ||
            modKey.includes('picture') ||
            modKey.includes('media') ||
            modKey.includes('src') ||
            modDesc.includes('image') ||
            modDesc.includes('url') ||
            modDesc.includes('photo') ||
            modDesc.includes('picture') ||
            modDesc.includes('media')
          );
        });
        
        if (urlMod) {
          const urlKey = urlMod.key || urlMod.id;
          if (urlKey) {
            // Remove the original key if it was a generic name and add the proper field
            if (key !== urlKey) {
              delete mappedModifications[key];
            }
            mappedModifications[urlKey] = value;
            logger.debug(`Auto-mapped URL to field`, { url: value, field: urlKey, templateId });
          }
        }
      }
    }

    // Special handling: if we have a single URL value but no clear field mapping,
    // and there's only one image-like field, use that
    const urlValues = Object.values(inputModifications).filter(v => typeof v === 'string' && isUrl(v));
    const imageFields = modArray.filter((mod: any) => {
      const modKey = (mod.key || mod.id || '').toLowerCase();
      const modDesc = (mod.description || '').toLowerCase();
      return modKey.includes('image') || modKey.includes('photo') || modKey.includes('picture') || 
             modKey.includes('media') || modKey.includes('url') || modKey.includes('src') ||
             modDesc.includes('image') || modDesc.includes('photo') || modDesc.includes('picture');
    });

    if (urlValues.length === 1 && imageFields.length === 1) {
      const urlValue = urlValues[0];
      const imageField = imageFields[0];
      const fieldKey = imageField.key || imageField.id;
      
      if (fieldKey && !mappedModifications[fieldKey]) {
        mappedModifications[fieldKey] = urlValue;
        logger.debug(`Auto-mapped single URL to single image field`, { url: urlValue, field: fieldKey, templateId });
      }
    }

    const mappedFields = Object.keys(mappedModifications).filter(key => key !== Object.keys(inputModifications).find(k => mappedModifications[key] === inputModifications[k]));
    if (mappedFields.length > 0) {
      logger.autoMapping(templateId, mappedFields);
    }
    
    logger.debug("Auto-mapping completed", { templateId, mappedModifications });
    
    return mappedModifications;
  } catch (error) {
    logger.error("Error in auto-mapping modifications", { templateId, error: error instanceof Error ? error.message : String(error) });
    return inputModifications;
  }
}

// Helper function to determine if a template ID is likely a studio template (numeric)
function isLikelyStudioTemplate(templateId: string): boolean {
  return /^\d+$/.test(templateId);
}

// Helper function to determine template type (library vs studio)
async function getTemplateType(templateId: string, apiKey: string): Promise<'library' | 'studio' | null> {
  try {
    // If it's a numeric ID, it's likely a studio template - check studio first
    if (isLikelyStudioTemplate(templateId)) {
      // Check studio templates first for numeric IDs
      const studioResponse = await fetch(`${ORSHOT_API_BASE}/v1/studio/templates`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (studioResponse.ok) {
        const studioTemplates = await studioResponse.json();
        const templatesArray = Array.isArray(studioTemplates) ? studioTemplates : [];
        
        // Check if templateId exists in studio templates (supports both numeric ID and name matching)
        const isStudioTemplate = templatesArray.some((template: any) => 
          template.id === templateId || 
          template.id === parseInt(templateId) ||
          template.name?.toLowerCase() === templateId.toLowerCase()
        );
        
        if (isStudioTemplate) {
          return 'studio';
        }
      }
    }

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

    // If not found in library and not numeric, check studio templates (including name matching)
    if (!isLikelyStudioTemplate(templateId)) {
      const studioResponse = await fetch(`${ORSHOT_API_BASE}/v1/studio/templates`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (studioResponse.ok) {
        const studioTemplates = await studioResponse.json();
        const templatesArray = Array.isArray(studioTemplates) ? studioTemplates : [];
        
        // Check if templateId exists in studio templates (supports name matching for non-numeric IDs)
        const isStudioTemplate = templatesArray.some((template: any) => 
          template.id === templateId || 
          template.name?.toLowerCase() === templateId.toLowerCase()
        );
        
        if (isStudioTemplate) {
          return 'studio';
        }
      }
    }

    return null; // Template not found in either
  } catch (error) {
    console.error("Error determining template type:", error);
    return null;
  }
}

// Helper function to resolve template ID from name (for studio templates)
async function resolveStudioTemplateId(templateIdOrName: string, apiKey: string): Promise<string | null> {
  try {
    // If it's already a numeric ID, return as-is
    if (isLikelyStudioTemplate(templateIdOrName)) {
      return templateIdOrName;
    }

    // Fetch studio templates to find by name
    const studioResponse = await fetch(`${ORSHOT_API_BASE}/v1/studio/templates`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (studioResponse.ok) {
      const studioTemplates = await studioResponse.json();
      const templatesArray = Array.isArray(studioTemplates) ? studioTemplates : [];
      
      // Find template by name (case-insensitive) or exact ID match
      const matchedTemplate = templatesArray.find((template: any) => 
        template.name?.toLowerCase() === templateIdOrName.toLowerCase() ||
        template.id === templateIdOrName
      );
      
      if (matchedTemplate) {
        logger.debug(`Resolved template name "${templateIdOrName}" to ID: ${matchedTemplate.id}`);
        return String(matchedTemplate.id);
      }
    }

    return null; // Template not found
  } catch (error) {
    logger.error("Error resolving studio template ID", { templateIdOrName, error: error instanceof Error ? error.message : String(error) });
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
    responseType: z.enum(["base64", "url", "binary"]).default("url").describe("Response type: base64 data, download URL, or binary data"),
  },
  async (args) => {
    const { apiKey, templateId, modifications, format, responseType } = args;
    
    // Validate template ID
    const templateValidation = validateTemplateId(templateId);
    if (!templateValidation.isValid) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Invalid template ID: ${templateValidation.error}`,
          },
        ],
      };
    }
    
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

    // Validate API key
    const keyValidation = validateApiKey(actualApiKey);
    if (!keyValidation.isValid) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Invalid API key: ${keyValidation.error}`,
          },
        ],
      };
    }
    const requestBody = {
      templateId: templateValidation.sanitized,
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
            text: "❌ Failed to generate image from library template. Please check your API key and template ID, or try again later.",
          },
        ],
      };
    }

    const { data } = response;
    
    // Debug logging to understand response structure
    console.error("Response debug info:", {
      responseType,
      hasData: !!response.data,
      dataType: typeof response.data,
      dataLength: response.data ? response.data.length : 0,
      dataPrefix: response.data ? response.data.substring(0, 20) : 'none',
      hasUrl: !!response.url,
      taskId: response.task_id,
      status: response.status
    });
    
    // Create raw response display (truncate data for readability)
    const responseForDisplay = {
      ...response,
      data: response.data ? 
        (response.data.length > 100 ? 
          `${response.data.substring(0, 100)}... (truncated, total length: ${response.data.length})` : 
          response.data) : 
        response.data
    };
    
    // Handle different response types
    if (responseType === "url" && response.url) {
      // Default case: Return clickable "View Generated Image" link for URL responses
      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully from library template!

🖼️ **[View Generated Image](${response.url})**

Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}`,
          },
        ],
      };
    } else if (responseType === "base64" && response.data && typeof response.data === 'string' && response.data.startsWith('data:image/')) {
      // Return the raw JSON for base64 responses (with truncated data)
      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully from library template!

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
          },
        ],
      };
    } else if (responseType === "binary") {
      // Return the raw JSON for binary responses
      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully from library template!

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
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

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
        },
      ],
    };
  }
);

// Tool 2: Generate Image From Orshot Studio Template
server.tool(
  "generate-image-from-studio",
  "Generate an image from an Orshot Studio template using specified data modifications. Automatically maps URLs to appropriate image fields in the template. You can use either the template ID (numeric) or template name.",
  {
    apiKey: z.string().optional().describe("Orshot API key for authentication (optional if set in environment)"),
    templateId: z.string().describe("The ID or name of the Orshot Studio template to use"),
    data: z.record(z.any()).default({}).describe("Object containing data to populate the template (e.g., dynamic content, variable replacements, URLs for images)"),
    format: z.enum(["png", "jpg", "pdf"]).default("png").describe("Output format for the generated image"),
    responseType: z.enum(["base64", "url", "binary"]).default("url").describe("Response type: base64 data, download URL, or binary data"),
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

    // Resolve template ID from name if needed
    const resolvedTemplateId = await resolveStudioTemplateId(templateId, actualApiKey);
    if (!resolvedTemplateId) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Studio template "${templateId}" not found. Please check the template ID or name.`,
          },
        ],
      };
    }

    // Auto-map modifications based on template structure
    const mappedData = await autoMapModifications(resolvedTemplateId, data, actualApiKey);
    
    const requestBody: any = {
      templateId: resolvedTemplateId,
      modifications: mappedData,
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
    
    // Create raw response display (truncate data for readability)
    const responseForDisplay = {
      ...response,
      data: response.data ? 
        (response.data.length > 100 ? 
          `${response.data.substring(0, 100)}... (truncated, total length: ${response.data.length})` : 
          response.data) : 
        response.data
    };
    
    // Handle different response types
    if (responseType === "url" && response.url) {
      // Default case: Return clickable "View Generated Image" link for URL responses
      return {
        content: [
          {
            type: "text",
            text: `Studio image generated successfully!

🖼️ **[View Generated Image](${response.url})**

Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}`,
          },
        ],
      };
    } else if (responseType === "base64" && response.data && typeof response.data === 'string' && response.data.startsWith('data:image/')) {
      // Return the raw JSON for base64 responses (with truncated data)
      return {
        content: [
          {
            type: "text",
            text: `Studio image generated successfully!

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
          },
        ],
      };
    } else if (responseType === "binary") {
      // Return the raw JSON for binary responses
      return {
        content: [
          {
            type: "text",
            text: `Studio image generated successfully!

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
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

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
        },
      ],
    };
  }
);

// Tool 3: Generate Image (Auto-detect template type)
server.tool(
  "generate-image",
  "Generate an image from an Orshot template (automatically detects library vs studio template). For studio templates, automatically maps URLs to appropriate image fields and supports template names.",
  {
    apiKey: z.string().optional().describe("Orshot API key for authentication (optional if set in environment)"),
    templateId: z.string().describe("The ID or name of the template to use (will auto-detect if it's library or studio). Numeric IDs are likely studio templates. Studio templates can also be referenced by name."),
    modifications: z.record(z.any()).default({}).describe("Object containing modifications/data to apply to the template (works for both library and studio templates). URLs will be auto-mapped to image fields for studio templates."),
    format: z.enum(["png", "jpg", "pdf"]).default("png").describe("Output format for the generated image"),
    responseType: z.enum(["base64", "url", "binary"]).default("url").describe("Response type: base64 data, download URL, or binary data"),
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
      
      // Create raw response display (truncate data for readability)
      const responseForDisplay = {
        ...response,
        data: response.data ? 
          (response.data.length > 100 ? 
            `${response.data.substring(0, 100)}... (truncated, total length: ${response.data.length})` : 
            response.data) : 
          response.data
      };
      
      // Handle different response types for library templates
      if (responseType === "url" && response.url) {
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully from library template!

🖼️ **[View Generated Image](${response.url})**

Template Type: Library
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}`,
            },
          ],
        };
      } else if (responseType === "base64" && response.data && typeof response.data === 'string' && response.data.startsWith('data:image/')) {
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully from library template!

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
            },
          ],
        };
      } else if (responseType === "binary") {
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully from library template!

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
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

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
          },
        ],
      };
    } else {
      // Use studio template endpoint
      
      // Resolve template ID from name if needed
      const resolvedTemplateId = await resolveStudioTemplateId(templateId, actualApiKey);
      if (!resolvedTemplateId) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Studio template "${templateId}" not found. Please check the template ID or name.`,
            },
          ],
        };
      }
      
      // Auto-map modifications based on template structure
      const mappedModifications = await autoMapModifications(resolvedTemplateId, modifications, actualApiKey);
      
      const requestBody: any = {
        templateId: resolvedTemplateId,
        modifications: mappedModifications, // Use auto-mapped modifications
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
      
      // Create raw response display (truncate data for readability)
      const responseForDisplay = {
        ...response,
        data: response.data ? 
          (response.data.length > 100 ? 
            `${response.data.substring(0, 100)}... (truncated, total length: ${response.data.length})` : 
            response.data) : 
          response.data
      };
      
      // Handle different response types for studio templates
      if (responseType === "url" && response.url) {
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully from studio template!

🖼️ **[View Generated Image](${response.url})**

Template Type: Studio
Task ID: ${response.task_id || 'Not available'}
Status: ${response.status || 'Unknown'}
${webhook ? `Webhook notifications will be sent to: ${webhook}` : ""}`,
            },
          ],
        };
      } else if (responseType === "base64" && response.data && typeof response.data === 'string' && response.data.startsWith('data:image/')) {
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully from studio template!

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
            },
          ],
        };
      } else if (responseType === "binary") {
        return {
          content: [
            {
              type: "text",
              text: `Image generated successfully from studio template!

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
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

**Raw API Response:**
\`\`\`json
${JSON.stringify(responseForDisplay, null, 2)}
\`\`\``,
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
      const response = await fetch(`${ORSHOT_API_BASE}/v1/studio/templates`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${actualApiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const studioTemplates = await response.json();
      const templatesArray = Array.isArray(studioTemplates) ? studioTemplates : [];

      if (templatesArray.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No studio templates found for your account. You may need to create templates in Orshot Studio first.",
            },
          ],
        };
      }

      const templateList = templatesArray.map((template: any, index: number) => {
        const modifications = template.modifications || [];
        const modificationsList = modifications.length > 0 
          ? modifications.map((mod: any) => `    - ${mod.key || mod.id}: ${mod.helpText || 'No description'} ${mod.example ? `(e.g., "${mod.example}")` : ''}`).join('\n')
          : '    - No modifications available';

        const dimensions = template.canvas_width && template.canvas_height 
          ? `${template.canvas_width}×${template.canvas_height}px` 
          : 'Unknown';

        return `${index + 1}. **${template.name || 'Untitled'}**
   ID: ${template.id}
   Description: ${template.description || 'No description'}
   Dimensions: ${dimensions}
   ${template.created_at ? `Created: ${new Date(template.created_at).toLocaleDateString()}` : ''}
   ${template.updated_at ? `Updated: ${new Date(template.updated_at).toLocaleDateString()}` : ''}
   ${template.thumbnail_url ? `Thumbnail: ${template.thumbnail_url}` : ''}
   Available Modifications:
${modificationsList}`;
      }).join('\n\n');

      return {
        content: [
          {
            type: "text",
            text: `Found ${templatesArray.length} studio template(s):\n\n${templateList}

💡 **Tip**: You can now use either the template ID (${templatesArray[0]?.id}) or name ("${templatesArray[0]?.name}") when generating images!`,
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
  "Get available modifications for a specific template (works for both library and studio templates). For studio templates, you can use either ID or name.",
  {
    apiKey: z.string().optional().describe("Orshot API key for authentication (optional if set in environment)"),
    templateId: z.string().describe("The ID or name of the template to get modifications for"),
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
          // First try to get template details from the templates endpoint
          const templatesResponse = await fetch(`${ORSHOT_API_BASE}/v1/studio/templates`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${actualApiKey}`,
              "Content-Type": "application/json",
            },
          });

          if (templatesResponse.ok) {
            const templates = await templatesResponse.json();
            const templatesArray = Array.isArray(templates) ? templates : [];
            
            // Find template by ID or name
            const selectedTemplate = templatesArray.find((template: any) => 
              template.id === templateId || 
              template.id === parseInt(templateId) ||
              template.name?.toLowerCase() === templateId.toLowerCase()
            );

            if (selectedTemplate && selectedTemplate.modifications) {
              modifications = selectedTemplate.modifications;
            }
          }

          // Fallback to the old modifications endpoint if template doesn't have modifications
          if (modifications.length === 0) {
            const resolvedTemplateId = await resolveStudioTemplateId(templateId, actualApiKey);
            if (resolvedTemplateId) {
              const response = await fetch(`${ORSHOT_API_BASE}/v1/studio/template/modifications?templateId=${resolvedTemplateId}`, {
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
            }
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
        const description = mod.helpText || mod.description || 'No description';
        const example = mod.example ? ` (e.g., "${mod.example}")` : '';
        const type = mod.type ? ` [${mod.type}]` : '';

        return `${index + 1}. **${key}**${type}${example}
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
  try {
    logger.info(`Starting ${config.server.name} v${config.server.version}`, {
      environment: config.server.environment,
      nodeVersion: process.version,
      logLevel: config.server.logLevel
    });
    
    // Start health check server for Railway
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
      healthServer.listen(healthCheckPort, () => {
        logger.info(`Health check server running on port ${healthCheckPort}`);
      });
    }
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info("Orshot MCP Server running on stdio", {
      apiBase: ORSHOT_API_BASE,
      hasApiKey: !!DEFAULT_API_KEY,
      autoMapping: config.features.autoMapping,
      healthCheck: config.features.healthCheck,
      healthCheckPort: process.env.NODE_ENV === 'production' ? healthCheckPort : 'disabled'
    });
  } catch (error) {
    logger.error("Failed to start server", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info("Received SIGINT, shutting down gracefully");
  if (healthServer.listening) {
    healthServer.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  if (healthServer.listening) {
    healthServer.close();
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error("Uncaught exception", { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error("Unhandled promise rejection", { reason, promise });
  process.exit(1);
});

main().catch((error) => {
  logger.error("Server startup error", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
