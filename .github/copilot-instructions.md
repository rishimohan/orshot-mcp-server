<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Orshot MCP Server Project Instructions

This is an MCP (Model Context Protocol) Server project for Orshot image generation API integration.

## Key Information

- You can find more info and examples at https://modelcontextprotocol.io/llms-full.txt
- This project provides MCP tools for generating images using the Orshot API
- The server supports two main operations:
  1. Generate images from library templates (`/v1/generate/images`)
  2. Generate images from Orshot Studio templates (`/v1/studio/render`)

## Code Guidelines

- Use TypeScript with strict type checking
- Follow ES modules syntax
- Use Zod for schema validation and type safety
- Implement proper error handling for API requests
- Follow MCP SDK patterns and conventions
- Include descriptive parameter descriptions for tool schemas

## Architecture

- `src/index.ts` - Main MCP server implementation
- Tools are defined using the MCP SDK's `server.tool()` method
- Each tool corresponds to an Orshot API endpoint
- API responses include task IDs, status, and download URLs
