

https://github.com/user-attachments/assets/1b9641ba-41cd-4f0b-9538-c71171c29e24



# Orshot MCP Server

[Orshot](https://orshot.com) is an Image Generation API which lets you generate dynamic images from [pre-designed and AI generated templates](https://orshot.com/templates) via [API and Integrations](https://orshot.com/integrations)

Orshot's MCP Server lets you dynamically generate images from your templates from your prompts in Claude, Cursor or any app that supports MCP Servers

## How to Use

### Get your API Key

- You can [signup on Orshot](https://orshot.com/signup) to get your free API key

### Claude Desktop Integration

Add the server to your Claude Desktop configuration in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "orshot": {
      "command": "node", // or output of "which node"
      "args": ["/path/to/orshot-mcp-server/build/index.js"], // update the path
      "env": { "ORSHOT_API_KEY": "your-api-key" } // add Orshot API Key
    }
  }
}
```

NOTE:

- Sometimes the path for node is different if you use libraries like nvm, just run "which node" and paste the output as the value for "command"

## Examples

Here are some example prompts you can use with Orshot's MCP Server

- generate a mockup using studio template id 64 with this image https://example.com/logo.png
- generate a website screenshot of github.com using orshot
- generate image using orshot from "Ad banner" studio template with heading "Grow your business" and subheading "Get your ebook now"
- list all studio templates in orshot
- generate this tweet's screenshot using orshot https://x.com/TheCatsX/status/1941620988279652599

## Features

This MCP server exposes seven tools for working with Orshot:

### Template Discovery

1. **Get Library Templates** - List all available library templates for your account
2. **Get Studio Templates** - List all available studio templates for your account

### Image Generation

4. **Generate Image** - Unified tool with automatic template detection (recommended)
5. **Generate Image From Library Template** - Generate images from Orshot library templates
6. **Generate Image From Studio Template** - Generate images from Orshot Studio templates

### Specialized Tools

7. **Check API Status** - Test API connectivity and validate your API key

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
