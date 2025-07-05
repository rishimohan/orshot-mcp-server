import { z } from "zod";

// Configuration schema with validation
const ConfigSchema = z.object({
  // Server configuration
  server: z.object({
    name: z.string().default("orshot-mcp-server"),
    version: z.string().default("1.8.0"),
    environment: z.enum(["development", "production", "test"]).default("production"),
    logLevel: z.enum(["error", "warn", "info", "debug"]).default("info"),
  }),

  // API configuration
  api: z.object({
    baseUrl: z.string().url().default("https://api.orshot.com"),
    timeout: z.number().min(1000).max(60000).default(30000), // 30 seconds
    retries: z.number().min(1).max(10).default(3),
    retryDelay: z.number().min(100).max(10000).default(1000), // 1 second
  }),

  // Security configuration
  security: z.object({
    requireApiKey: z.boolean().default(true),
    maxTemplateIdLength: z.number().min(1).max(200).default(100),
    maxApiKeyLength: z.number().min(10).max(500).default(200),
    allowedOrigins: z.array(z.string()).default([]),
  }),

  // Features configuration
  features: z.object({
    autoMapping: z.boolean().default(true),
    caching: z.boolean().default(false),
    telemetry: z.boolean().default(false),
    healthCheck: z.boolean().default(true),
  }),

  // Rate limiting (future enhancement)
  rateLimit: z.object({
    enabled: z.boolean().default(false),
    windowMs: z.number().default(60000), // 1 minute
    maxRequests: z.number().default(100),
  }),
});

export type ServerConfig = z.infer<typeof ConfigSchema>;

// Load configuration from environment variables and defaults
export function loadConfig(): ServerConfig {
  const config = {
    server: {
      name: process.env.SERVER_NAME || "orshot-mcp-server",
      version: process.env.SERVER_VERSION || "1.8.0",
      environment: (process.env.NODE_ENV as any) || "production",
      logLevel: (process.env.LOG_LEVEL as any) || "info",
    },
    api: {
      baseUrl: process.env.ORSHOT_API_BASE || "https://api.orshot.com",
      timeout: parseInt(process.env.API_TIMEOUT || "30000"),
      retries: parseInt(process.env.API_RETRIES || "3"),
      retryDelay: parseInt(process.env.API_RETRY_DELAY || "1000"),
    },
    security: {
      requireApiKey: process.env.REQUIRE_API_KEY !== "false",
      maxTemplateIdLength: parseInt(process.env.MAX_TEMPLATE_ID_LENGTH || "100"),
      maxApiKeyLength: parseInt(process.env.MAX_API_KEY_LENGTH || "200"),
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [],
    },
    features: {
      autoMapping: process.env.DISABLE_AUTO_MAPPING !== "true",
      caching: process.env.ENABLE_CACHING === "true",
      telemetry: process.env.ENABLE_TELEMETRY === "true",
      healthCheck: process.env.DISABLE_HEALTH_CHECK !== "true",
    },
    rateLimit: {
      enabled: process.env.ENABLE_RATE_LIMIT === "true",
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
    },
  };

  // Validate configuration
  try {
    return ConfigSchema.parse(config);
  } catch (error) {
    console.error("Configuration validation failed:");
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error("Invalid configuration");
  }
}

// Export singleton configuration instance
export const config = loadConfig();
