import { config } from "./config.js";

// Log levels
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Log level mapping
const LOG_LEVELS: Record<string, LogLevel> = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG
};

// Get current log level from config
const CURRENT_LOG_LEVEL = LOG_LEVELS[config.server.logLevel] || LogLevel.INFO;

// Enhanced logger with structured logging
class Logger {
  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      service: config.server.name,
      version: config.server.version,
      environment: config.server.environment,
      ...(meta && { meta })
    };

    // In production, use JSON format for structured logging
    if (config.server.environment === "production") {
      return JSON.stringify(logEntry);
    }

    // In development, use human-readable format
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  private log(level: LogLevel, levelName: string, message: string, meta?: any): void {
    if (level <= CURRENT_LOG_LEVEL) {
      const formattedMessage = this.formatMessage(levelName, message, meta);
      
      // Use stderr for logging to avoid polluting stdout (important for MCP)
      console.error(formattedMessage);
    }
  }

  error(message: string, meta?: any): void {
    this.log(LogLevel.ERROR, "error", message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, "warn", message, meta);
  }

  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, "info", message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, "debug", message, meta);
  }

  // Performance logging
  time(label: string): void {
    if (CURRENT_LOG_LEVEL >= LogLevel.DEBUG) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (CURRENT_LOG_LEVEL >= LogLevel.DEBUG) {
      console.timeEnd(label);
    }
  }

  // API request logging
  apiRequest(method: string, url: string, status?: number, duration?: number): void {
    const meta = { method, url, status, duration };
    if (status && status >= 400) {
      this.error(`API request failed: ${method} ${url}`, meta);
    } else {
      this.info(`API request: ${method} ${url}`, meta);
    }
  }

  // Template operation logging
  templateOperation(operation: string, templateId: string, templateType?: string): void {
    this.info(`Template operation: ${operation}`, { templateId, templateType });
  }

  // Auto-mapping logging
  autoMapping(templateId: string, mappedFields: string[]): void {
    this.info(`Auto-mapping applied for template ${templateId}`, { mappedFields });
  }

  // Validation logging
  validation(type: string, success: boolean, error?: string): void {
    if (success) {
      this.debug(`Validation passed: ${type}`);
    } else {
      this.warn(`Validation failed: ${type}`, { error });
    }
  }

  // Security logging
  security(event: string, details?: any): void {
    this.warn(`Security event: ${event}`, details);
  }
}

// Export singleton logger instance
export const logger = new Logger();
