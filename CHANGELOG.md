# Changelog

All notable changes to the Orshot MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.0] - 2025-07-05

### Added

- **Studio Template Name Support** - You can now reference studio templates by name instead of just numeric IDs
- Template name resolution for all studio template operations (generate, modifications, etc.)
- Enhanced studio template listing with detailed information including modifications, dimensions, and thumbnails
- Improved template modification display with better formatting and examples
- Railway deployment optimization with health check endpoint
- Railway configuration files (`railway.toml`, `Procfile`)
- Comprehensive Railway deployment guide (`RAILWAY.md`)

### Changed

- Updated studio templates endpoint to use new `/v1/studio/templates` structure
- Enhanced `get-studio-templates` tool to show comprehensive template information
- Improved `get-template-modifications` tool to handle new modification structure
- Updated all generation tools to support template name resolution
- Removed Docker support in favor of simpler Railway deployment
- Enhanced tool descriptions to mention template name support

### Removed

- Docker configuration files (`Dockerfile`, `docker-compose.yml`)
- Outdated `index_new.ts` file

## [1.8.0] - 2025-07-05

### Added

- Production-ready configuration management system with Zod validation
- Comprehensive structured logging with different log levels
- System service integration with systemd and pm2 support
- Cross-platform deployment support (Linux, macOS, Windows)
- Comprehensive test suite using Node.js built-in test runner
- Production deployment guide (DEPLOYMENT.md)
- Environment configuration template (.env.example)
- Graceful shutdown handling for SIGINT/SIGTERM signals
- Uncaught exception and unhandled rejection monitoring
- Health check scripts and system monitoring
- Resource limits and security configurations
- Rate limiting configuration (for future implementation)
- Comprehensive input validation with security considerations
- Enhanced error handling with retry logic and exponential backoff
- Performance monitoring and timing logs
- Auto-mapping feature toggle and configuration options

### Changed

- Updated all console.error calls to use structured logger
- Improved API request handling with configurable timeouts and retries
- Enhanced validation functions with proper logging
- Updated package.json with production-ready scripts and metadata
- Improved error messages and debugging information
- Better separation of concerns with config and logger modules

### Fixed

- Fixed TypeScript compilation errors
- Improved error handling for edge cases
- Better handling of missing environment variables
- Enhanced security validation for template IDs and API keys

### Security

- Added input sanitization and validation
- Implemented configurable security limits
- Added proper error message sanitization
- Enhanced logging to avoid exposing sensitive information

### Performance

- Optimized Node.js application with minimal dependencies
- Added request timing and performance monitoring
- Improved memory usage with better error handling
- Added configurable request timeouts and retry policies
- Lightweight deployment without container overhead

### Documentation

- Added comprehensive production deployment guide
- Updated README with new features and configuration options
- Added inline code documentation
- Created environment configuration template
- Added system service setup instructions

## [1.7.0] - Previous Version

### Added

- Auto-mapping of URLs to appropriate template fields
- Support for multiple response types (base64, url, binary)
- Enhanced template type detection
- Comprehensive error handling and retries

### Changed

- Improved user experience with better response formatting
- Enhanced template discovery and modification tools
- Better API error handling and messaging

## [1.6.0] - Previous Version

### Added

- Studio template support
- Template modifications discovery
- Enhanced API connectivity testing

## [1.5.0] - Previous Version

### Added

- Library template support
- Basic image generation functionality
- MCP server foundation

## [1.0.0] - Initial Release

### Added

- Initial MCP server implementation
- Basic Orshot API integration
- Core image generation tools
