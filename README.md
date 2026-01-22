https://github.com/user-attachments/assets/1b9641ba-41cd-4f0b-9538-c71171c29e24

# Orshot MCP Server

[Orshot](https://orshot.com) is an Image, PDF and Video Generation API which lets you generate dynamic images from [pre-designed and AI generated templates](https://orshot.com/templates) via [API and Integrations](https://orshot.com/integrations)

Orshot's MCP Server lets you dynamically generate images from your templates from your prompts in Claude, Cursor or any app that supports MCP Servers

## How to Use

### Quick Connect (Remote)

The easiest way to use the Orshot MCP Server is to connect to our hosted remote server.

**Server URL:** `https://mcp.orshot.com/sse`

Since the remote server is shared, you must provide your **Orshot API Key** in your prompt (e.g., "Generate a website screenshot of apple.com. Here is my API key: os-...") or configure your MCP client to send it.

#### Cursor (Agent Mode)

1. Settings > General > MCP Servers
2. Add new MCP server
3. Select **SSE** and enter `https://mcp.orshot.com/sse`

#### VS Code (MCP Extension)

Add to `.vscode/mcp.json` or your global configuration:

```json
{
  "servers": {
    "orshot": {
      "type": "sse",
      "url": "https://mcp.orshot.com/sse"
    }
  }
}
```

### Local Installation (Advanced)

For developers who want to run the server locally or contribute.

1. **Clone and Build**:

   ```bash
   git clone https://github.com/rishimohan/orshot-mcp-server
   cd orshot-mcp-server
   npm install && npm run build
   ```

2. **Configure Claude Desktop**:
   Add to `claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "orshot": {
         "command": "node",
         "args": ["/absolute/path/to/orshot-mcp-server/build/index.js"],
         "env": { "ORSHOT_API_KEY": "your-api-key" }
       }
     }
   }
   ```

## Examples

Here are some example prompts you can use with Orshot's MCP Server

- generate a mockup using studio template id 64 with this image https://example.com/logo.png
- generate a website screenshot of github.com using orshot
- generate image using orshot from "Ad banner" studio template with heading "Grow your business" and subheading "Get your ebook now"
- list all studio templates in orshot
- generate this tweet's screenshot using orshot https://x.com/TheCatsX/status/1941620988279652599

## Features

This MCP server exposes nine tools for working with Orshot:

### Template Discovery

1. **Get Library Templates** - List all available library templates for your account
2. **Get Studio Templates** - List all available studio templates for your account
3. **Get Template Modifications** - Get available parameters/modifications for any template

### Image & Media Generation

4. **Generate Image** - Unified tool with automatic template detection (recommended). Supports **Images (PNG, JPG, WEBP)**, **PDFs**, and **Videos (MP4, WEBM, GIF)**.
5. **Generate Image From Library Template** - Generate images from Orshot library templates
6. **Generate Image From Studio Template** - Generate images, PDFs or videos from Orshot Studio templates

### Documentation & Help

7. **Get Orshot Docs** - Fetch the latest documentation directly from Orshot
8. **List Docs Topics** - List available documentation topics

### Utilities

9. **Check API Status** - Test API connectivity and validate your API key

### New Capabilities

- **Video Generation**: Create MP4, WebM, or GIF videos from Studio templates.
- **PDF Generation**: Generate multi-page PDFs with custom DPI and margins.
- **Documentation Integration**: Ask the agent to look up Orshot documentation for you.

### Local Development

```bash
# 1. Install and build
npm install && npm run build

# 2. Configure (required)
export ORSHOT_API_KEY="your-api-key-here"

# 3. Run production server
npm start
```

### Getting Help

If you experience any issues:

1. Check the [Orshot API documentation](https://orshot.com/docs)
2. Verify your account status at [Orshot Dashboard](https://orshot.com/dashboard)
3. Contact Orshot support at hi@orshot.com if API issues persist

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
