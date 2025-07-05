# Railway Deployment Guide

This guide explains how to deploy the Orshot MCP Server on Railway.

## Prerequisites

1. A Railway account (sign up at https://railway.app)
2. Your Orshot API key

## Deployment Steps

### Method 1: Deploy from GitHub (Recommended)

1. **Connect your repository to Railway:**

   - Go to https://railway.app/dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account and select this repository

2. **Configure environment variables:**

   - In your Railway project dashboard, go to "Variables"
   - Add the following environment variables:
     ```
     ORSHOT_API_KEY=your_orshot_api_key_here
     NODE_ENV=production
     ```

3. **Deploy:**
   - Railway will automatically build and deploy your application
   - The build process uses the `nixpacks.toml` configuration and auto-detection

### Method 2: Deploy via Railway CLI

1. **Install Railway CLI:**

   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**

   ```bash
   railway login
   ```

3. **Initialize the project:**

   ```bash
   cd /path/to/orshot-mcp-server
   railway init
   ```

4. **Set environment variables:**

   ```bash
   railway variables set ORSHOT_API_KEY=your_orshot_api_key_here
   railway variables set NODE_ENV=production
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

## Configuration

### Environment Variables

| Variable         | Required | Description                  | Default       |
| ---------------- | -------- | ---------------------------- | ------------- |
| `ORSHOT_API_KEY` | Yes      | Your Orshot API key          | -             |
| `NODE_ENV`       | No       | Environment mode             | `development` |
| `PORT`           | No       | Port for health check server | `3000`        |

### Health Check

The server includes a built-in health check endpoint at `/health` that Railway uses to monitor your deployment. This endpoint returns:

```json
{
  "status": "healthy",
  "service": "orshot-mcp-server",
  "version": "1.8.0",
  "timestamp": "2025-07-05T12:00:00.000Z"
}
```

## Monitoring

- **Logs:** View real-time logs in your Railway dashboard
- **Metrics:** Monitor CPU, memory, and network usage
- **Health Check:** Automatic health monitoring via `/health` endpoint

## Scaling

Railway automatically handles:

- Auto-scaling based on traffic
- Zero-downtime deployments
- SSL certificate management
- CDN integration

## Troubleshooting

### Common Issues

1. **Build failures:**

   - Check that all dependencies are listed in `package.json`
   - Verify Node.js version compatibility (requires Node.js ≥18.0.0)

2. **Runtime errors:**

   - Check environment variables are set correctly
   - Review logs in Railway dashboard
   - Verify Orshot API key is valid

3. **Health check failures:**
   - Ensure the PORT environment variable is set
   - Check if the health server is binding correctly

### Support

- Railway Documentation: https://docs.railway.app
- Railway Community: https://discord.gg/railway
- Orshot API Documentation: https://docs.orshot.com

## Cost Optimization

- Railway offers a generous free tier
- Consider setting resource limits for cost control
- Monitor usage in the Railway dashboard
- Use environment-based scaling policies
