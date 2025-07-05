# Production Deployment Guide

This guide covers deploying the Orshot MCP Server in production environments as a simple Node.js application.

## Prerequisites

- Node.js 18.0.0 or higher
- npm package manager
- Orshot API key (obtain from [Orshot](https://orshot.com))
- Claude Desktop or compatible MCP client

## Deployment Options

### 1. Local Installation

#### Quick Setup

```bash
# Clone or download the server
git clone <repository-url>
cd orshot-mcp-server

# Install dependencies
npm install

# Build the server
npm run build

# Set environment variables
export ORSHOT_API_KEY="your-api-key-here"

# Start the server
npm start
```

#### Environment Configuration

Create a `.env` file in the project root:

```env
# Required
ORSHOT_API_KEY=your-actual-api-key

# Optional API Configuration
ORSHOT_API_BASE=https://api.orshot.com
API_TIMEOUT=30000
API_RETRIES=3
API_RETRY_DELAY=1000

# Optional Server Configuration
NODE_ENV=production
LOG_LEVEL=info
SERVER_NAME=orshot-mcp-server
SERVER_VERSION=1.8.0

# Optional Security Configuration
REQUIRE_API_KEY=true
MAX_TEMPLATE_ID_LENGTH=100
MAX_API_KEY_LENGTH=200

# Optional Feature Configuration
DISABLE_AUTO_MAPPING=false
ENABLE_CACHING=false
ENABLE_TELEMETRY=false
DISABLE_HEALTH_CHECK=false

# Optional Rate Limiting
ENABLE_RATE_LIMIT=false
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. System Service Installation

#### Using systemd (Linux)

Create a service file at `/etc/systemd/system/orshot-mcp-server.service`:

```ini
[Unit]
Description=Orshot MCP Server
After=network.target

[Service]
Type=simple
User=orshot
WorkingDirectory=/opt/orshot-mcp-server
Environment=NODE_ENV=production
EnvironmentFile=/opt/orshot-mcp-server/.env
ExecStart=/usr/bin/node build/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable orshot-mcp-server
sudo systemctl start orshot-mcp-server
sudo systemctl status orshot-mcp-server
```

#### Using pm2 (Process Manager)

```bash
# Install pm2 globally
npm install -g pm2

# Create ecosystem file
cat << EOF > ecosystem.config.js
module.exports = {
  apps: [{
    name: 'orshot-mcp-server',
    script: 'build/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Start with pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. Claude Desktop Integration

Add the server to your Claude Desktop configuration:

#### Linux/macOS

Edit `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "orshot": {
      "command": "/usr/local/bin/node",
      "args": ["/path/to/orshot-mcp-server/build/index.js"],
      "env": {
        "ORSHOT_API_KEY": "your-actual-api-key",
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

#### Windows

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "orshot": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\path\\to\\orshot-mcp-server\\build\\index.js"],
      "env": {
        "ORSHOT_API_KEY": "your-actual-api-key",
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Production Considerations

### Security

1. **API Key Management**

   - Store API keys in environment variables, not in code
   - Use a secrets management system in production
   - Rotate API keys regularly
   - Monitor for unauthorized usage

2. **Network Security**

   - Use HTTPS for all API communications
   - Consider firewall rules if running on a server
   - Monitor network traffic for anomalies

3. **Input Validation**
   - All inputs are validated by default
   - Template IDs are sanitized
   - URL validation prevents injection attacks

### Performance

1. **Resource Limits**

   - Default timeout: 30 seconds
   - Default retries: 3 attempts
   - Memory usage: ~50-100MB typical
   - Configure limits based on your needs

2. **Monitoring**

   - Check logs regularly: `journalctl -u orshot-mcp-server -f` (systemd)
   - Monitor API response times
   - Track error rates and patterns

3. **Scaling**
   - The server is stateless and can run multiple instances
   - Consider load balancing for high-volume usage
   - Cache frequently accessed templates (future feature)

### Reliability

1. **Error Handling**

   - Automatic retry with exponential backoff
   - Graceful degradation on API failures
   - Comprehensive error messages and logging

2. **Health Checks**

   - Built-in health check via `npm run health-check`
   - Monitor server responsiveness with systemd or pm2

3. **Recovery**
   - Server automatically restarts on failure (with systemd/pm2)
   - No persistent state to recover
   - Failed requests can be safely retried

### Logging and Monitoring

1. **Log Levels**

   - `error`: Only errors and critical issues
   - `warn`: Warnings and potential issues
   - `info`: General operational information (recommended)
   - `debug`: Detailed debugging information

2. **Log Format**

   - Production: Structured JSON logs
   - Development: Human-readable format
   - All logs go to stderr (stdout reserved for MCP)

3. **Monitoring Metrics**
   - API request success/failure rates
   - Response times
   - Template usage patterns
   - Error frequencies

## Troubleshooting

### Common Issues

1. **"No API key provided" error**

   - Ensure `ORSHOT_API_KEY` environment variable is set
   - Check Claude Desktop configuration
   - Verify API key format and validity

2. **"Template not found" error**

   - Verify template ID is correct
   - Check if template exists in your Orshot account
   - Ensure proper template type (library vs studio)

3. **Connection timeout errors**

   - Check internet connectivity
   - Verify Orshot API status
   - Increase timeout values if needed

4. **Server won't start**
   - Check Node.js version (requires 18+)
   - Verify all dependencies are installed: `npm install`
   - Check for port conflicts
   - Review environment variables

### Debugging

1. **Enable debug logging**

   ```bash
   export LOG_LEVEL=debug
   npm start
   ```

2. **Test API connectivity**

   ```bash
   # Use the check-api-status tool in Claude Desktop
   # Or test directly:
   curl -H "Authorization: Bearer your-api-key" https://api.orshot.com/v1/templates
   ```

3. **Validate configuration**

   ```bash
   npm run validate
   ```

4. **Check system service logs**

   ```bash
   # For systemd
   journalctl -u orshot-mcp-server -f

   # For pm2
   pm2 logs orshot-mcp-server
   ```

### Support

- Check the [Orshot API documentation](https://docs.orshot.com)
- Review server logs for detailed error information
- Test with minimal configuration first
- Verify API key permissions and quotas

## Maintenance

### Regular Tasks

1. **Update dependencies**

   ```bash
   npm audit
   npm update
   npm run build
   ```

2. **Monitor logs**

   ```bash
   # Check for errors and warnings
   # For systemd
   journalctl -u orshot-mcp-server | grep -E "(ERROR|WARN)"

   # For pm2
   pm2 logs orshot-mcp-server | grep -E "(ERROR|WARN)"

   # For direct execution
   npm start 2>&1 | grep -E "(ERROR|WARN)"
   ```

3. **Test functionality**

   ```bash
   # Run health check
   npm run health-check

   # Test API connectivity in Claude Desktop
   # Use: "Check my Orshot API status"
   ```

### Backup and Recovery

- No persistent data to backup (stateless service)
- Configuration files should be version controlled
- API keys should be backed up securely
- Document your Claude Desktop configuration

This completes the production deployment guide. The server is designed to be robust, secure, and production-ready out of the box.
