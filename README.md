# Orshot MCP Server

A Model Context Protocol (MCP) server that provides image generation capabilities using the Orshot API.

## Features

This MCP server exposes seven tools for working with Orshot:

### Template Discovery

1. **Get Library Templates** - List all available library templates for your account
2. **Get Studio Templates** - List all available studio templates for your account
3. **Get Template Modifications** - Get available modifications for any template

### Image Generation

4. **Generate Image** - Unified tool with automatic template detection (recommended)
5. **Generate Image From Library Template** - Generate images from Orshot library templates
6. **Generate Image From Studio Template** - Generate images from Orshot Studio templates

### Specialized Tools

7. **Check API Status** - Test API connectivity and validate your API key

### Image Display & Response Types

✨ **NEW in v1.4.0**: Enhanced response type support for better user experience!

The image generation tools now support three response types:

- **`base64`** (default): Returns base64-encoded image data that displays inline in Claude Desktop and compatible MCP clients
- **`url`**: Returns a download URL with clickable link formatting for easy access
- **`binary`**: Returns raw binary data (useful for programmatic access)

Examples:

```json
// Inline image display (recommended for chat)
{
  "responseType": "base64"
}

// Download link
{
  "responseType": "url"
}

// Raw binary data
{
  "responseType": "binary"
}
```

Generated images with `base64` response type are automatically displayed inline in your chat conversation!

### Note on Website Screenshots

Website screenshots are available through the standard library templates (template ID: `website-screenshot`). Simply use the `generate-image` or `generate-image-from-library` tools with the `website-screenshot` template and provide the `websiteUrl` modification.

## Installation

```bash
npm install
npm run build
```

## Configuration

### API Key

You can provide your Orshot API key in two ways:

1. **Environment Variable** (recommended): Set `ORSHOT_API_KEY` environment variable
2. **Parameter**: Pass the API key as a parameter to each tool call

### Claude Desktop Configuration

Add the server to your Claude Desktop configuration in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "orshot": {
      "command": "/full/path/to/node",
      "args": ["/full/path/to/orshot-mcp-server/build/index.js"],
      "env": {
        "ORSHOT_API_KEY": "your-actual-api-key-here"
      }
    }
  }
}
```

## Usage

### Direct Usage

```bash
npm start
```

## Tools

### Template Discovery Tools

#### get-library-templates

Get all available library templates for your account.

**Parameters:**

- `apiKey` (string, optional) - Orshot API key for authentication (uses environment variable if not provided)

**Example:**

```
List all my library templates
```

#### get-studio-templates

Get all available studio templates for your account.

**Parameters:**

- `apiKey` (string, optional) - Orshot API key for authentication (uses environment variable if not provided)

**Example:**

```
Show me all my studio templates
```

#### get-template-modifications

Get available modifications for a specific template (works for both library and studio templates).

**Parameters:**

- `apiKey` (string, optional) - Orshot API key for authentication (uses environment variable if not provided)
- `templateId` (string, required) - The ID of the template to get modifications for
- `templateType` (string, optional) - Type of template: "library", "studio", or "auto" (default: "auto")

**Example:**

```
What modifications are available for template "abc123"?
```

### Image Generation Tools

#### generate-image (Recommended)

**NEW**: Unified tool that automatically detects whether a template is from the library or studio and calls the appropriate API endpoint.

**Parameters:**

- `apiKey` (string, optional) - Orshot API key for authentication (uses environment variable if not provided)
- `templateId` (string, required) - The ID of the template to use
- `modifications` (object, optional) - Object containing modifications/data to apply to the template
- `format` (string, optional) - Output format: "png", "jpg", or "pdf" (default: "png")
- `responseType` (string, optional) - Response type: "base64", "url", or "binary" (default: "base64")
- `webhook` (string, optional) - Webhook URL for notifications (studio templates only)

**Example:**

```
Generate an image using template ID "abc123" with text modifications
```

### generate-image-from-library

Generate an image from an Orshot library template.

**Parameters:**

- `apiKey` (string, optional) - Orshot API key for authentication
- `templateId` (string) - The ID of the library template to use
- `modifications` (object, optional) - Object containing modifications to apply to the template
- `format` (string, optional) - Output format (png, jpg, pdf). Default: png
- `responseType` (string, optional) - Response type: "base64", "url", or "binary" (default: "base64")

### generate-image-from-studio

Generate an image from an Orshot Studio template.

**Parameters:**

- `apiKey` (string, optional) - Orshot API key for authentication
- `templateId` (string) - The ID of the Orshot Studio template to use
- `data` (object, optional) - Object containing data to populate the template
- `format` (string, optional) - Output format (png, jpg, pdf). Default: png
- `responseType` (string, optional) - Response type: "base64", "url", or "binary" (default: "base64")
- `webhook` (string, optional) - Webhook URL for completion notifications

#### check-api-status

Check API connectivity and validate your API key.

**Parameters:**

- `apiKey` (string, optional) - Orshot API key for authentication (uses environment variable if not provided)

**Example:**

```
Check if my Orshot API is working
```

#### Taking Website Screenshots

Website screenshots are available through the standard library templates using the `website-screenshot` template ID.

**Using the auto-detect tool:**

```
Generate an image using template website-screenshot with websiteUrl https://example.com and fullCapture true
```

**Using the library template tool directly:**

```
Generate an image from library template website-screenshot with websiteUrl https://example.com
```

**Available modifications for website-screenshot template:**

- `websiteUrl` (string, required) - The URL of the website to screenshot
- `fullCapture` (boolean, optional) - Whether to capture the full page or just the viewport
- `delay` (number, optional) - Delay in milliseconds before taking screenshot
- `width` (number, optional) - Width of the output image
- `height` (number, optional) - Height of the output image

## Troubleshooting

### Common Issues

#### API Key Problems

- **Error: "No API key provided"** - Set the `ORSHOT_API_KEY` environment variable or pass the API key as a parameter
- **Error: "401 Unauthorized"** - Your API key is invalid or expired. Check your Orshot account
- **Error: "403 Forbidden"** - Your API key is valid but lacks permissions for the requested operation

#### Template Issues

- **Error: "Template not found"** - Use the `get-library-templates` or `get-studio-templates` tools to find valid template IDs
- **Error: "Failed to generate image"** - Check that the template ID is correct and your modifications are valid

#### Network Issues

- **Error: "Network error"** - Check your internet connection and firewall settings
- **Error: "Service unavailable"** - Orshot servers may be temporarily down

### Debugging Steps

1. **Test API connectivity**: Use the `check-api-status` tool to verify your API key and connection
2. **List available templates**: Use `get-library-templates` and `get-studio-templates` to see what's available
3. **Check template modifications**: Use `get-template-modifications` to see what parameters a template accepts
4. **Verify template ID**: Make sure you're using the correct template ID from the template listing

### Getting Help

If you continue to experience issues:

1. Check the [Orshot API documentation](https://orshot.com/docs/api-reference)
2. Verify your account status at [Orshot Dashboard](https://orshot.com/dashboard)
3. Contact Orshot support if API issues persist

## Inline Image Display

**NEW in v1.3.0**: The server now returns generated images as proper image content that displays inline in chat:

- **When base64 data is available**: Images are returned with `type: "image"` and proper MIME type detection, allowing compatible MCP clients (like Claude Desktop) to display them inline
- **Fallback**: If no base64 data is available, the server falls back to text responses with image URLs
- **Automatic MIME type detection**: The server automatically extracts the correct MIME type from base64 data URLs (e.g., `image/png`, `image/jpeg`)
- **Dual content**: Both the image and contextual information (task ID, status, URL) are provided together

This enhancement significantly improves the user experience by eliminating the need to manually download or open images in external applications.

## API Endpoints

The server integrates with the following Orshot API endpoints:

### Image Generation

- `POST /v1/generate/images` - Generate images from library templates
- `POST /v1/studio/render` - Generate images from Orshot Studio templates

### Template Discovery

- `GET /v1/templates` - Get all library templates
- `GET /v1/studio/templates` - Get all studio templates
- `GET /v1/templates/modifications?template_id={id}` - Get modifications for library templates
- `GET /v1/studio/template/modifications?templateId={id}` - Get modifications for studio templates

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

## License

ISC
