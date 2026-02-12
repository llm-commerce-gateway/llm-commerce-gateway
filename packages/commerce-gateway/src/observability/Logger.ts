/**
 * @betterdata/llm-gateway - Structured Logging System
 * 
 * Production-ready logging with support for structured output,
 * multiple log levels, and pluggable backends (Winston, Pino, etc.)
 * 
 * @license MIT
 */

// ============================================================================
// Logger Interface
// ============================================================================

/**
 * Log level severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger interface that can be implemented by any logging library
 */
export interface Logger {
  /**
   * Log a debug message (development only)
   */
  debug(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log an informational message
   */
  info(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log a warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log an error message
   */
  error(message: string, error?: Error | null, meta?: Record<string, unknown>): void;

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger;
}

/**
 * Log entry structure for structured logging
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context?: string;
  message: string;
  meta?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ============================================================================
// Console Logger (Default)
// ============================================================================

/**
 * Configuration options for ConsoleLogger
 */
export interface ConsoleLoggerOptions {
  /**
   * Minimum log level to output
   */
  level?: LogLevel;

  /**
   * Whether to output JSON (for production) or human-readable (for dev)
   */
  json?: boolean;

  /**
   * Whether to include timestamps
   */
  timestamps?: boolean;

  /**
   * Whether to colorize output (only for non-JSON mode)
   */
  colors?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Default console logger implementation
 * 
 * Supports both JSON output (for production) and human-readable output (for development).
 */
export class ConsoleLogger implements Logger {
  private readonly context?: string;
  private readonly options: Required<ConsoleLoggerOptions>;

  constructor(context?: string, options: ConsoleLoggerOptions = {}) {
    this.context = context;
    this.options = {
      level: options.level ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      json: options.json ?? process.env.NODE_ENV === 'production',
      timestamps: options.timestamps ?? true,
      colors: options.colors ?? process.env.NODE_ENV !== 'production',
    };
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | null, meta?: Record<string, unknown>): void {
    const errorMeta: Record<string, unknown> = { ...meta };
    if (error) {
      errorMeta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    this.log('error', message, errorMeta);
  }

  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new ConsoleLogger(childContext, this.options);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    // Check if we should log this level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (this.context) {
      entry.context = this.context;
    }

    if (meta && Object.keys(meta).length > 0) {
      if (meta.error) {
        entry.error = meta.error as LogEntry['error'];
        const { error: _, ...restMeta } = meta;
        if (Object.keys(restMeta).length > 0) {
          entry.meta = restMeta;
        }
      } else {
        entry.meta = meta;
      }
    }

    this.output(entry);
  }

  private output(entry: LogEntry): void {
    if (this.options.json) {
      this.outputJSON(entry);
    } else {
      this.outputPretty(entry);
    }
  }

  private outputJSON(entry: LogEntry): void {
    const output = JSON.stringify(entry);
    
    switch (entry.level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  private outputPretty(entry: LogEntry): void {
    const { colors } = this.options;
    
    let levelStr: string;
    let levelColor: string;
    
    switch (entry.level) {
      case 'debug':
        levelStr = 'DEBUG';
        levelColor = colors ? COLORS.gray : '';
        break;
      case 'info':
        levelStr = 'INFO ';
        levelColor = colors ? COLORS.blue : '';
        break;
      case 'warn':
        levelStr = 'WARN ';
        levelColor = colors ? COLORS.yellow : '';
        break;
      case 'error':
        levelStr = 'ERROR';
        levelColor = colors ? COLORS.red : '';
        break;
    }

    const reset = colors ? COLORS.reset : '';
    const dim = colors ? COLORS.dim : '';
    const cyan = colors ? COLORS.cyan : '';

    let output = '';

    // Timestamp
    if (this.options.timestamps) {
      output += `${dim}${entry.timestamp}${reset} `;
    }

    // Level
    output += `${levelColor}${levelStr}${reset} `;

    // Context
    if (entry.context) {
      output += `${cyan}[${entry.context}]${reset} `;
    }

    // Message
    output += entry.message;

    // Meta
    if (entry.meta) {
      output += ` ${dim}${JSON.stringify(entry.meta)}${reset}`;
    }

    // Output
    switch (entry.level) {
      case 'error':
        console.error(output);
        if (entry.error?.stack) {
          console.error(`${dim}${entry.error.stack}${reset}`);
        }
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }
}

// ============================================================================
// Structured Logger (for Winston/Pino)
// ============================================================================

/**
 * External logger interface (compatible with Winston, Pino, etc.)
 */
export interface ExternalLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child?(bindings: Record<string, unknown>): ExternalLogger;
}

/**
 * Wrapper for external logging libraries (Winston, Pino, etc.)
 */
export class StructuredLogger implements Logger {
  constructor(
    private readonly logger: ExternalLogger,
    private readonly context?: string
  ) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, this.buildMeta(meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, this.buildMeta(meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, this.buildMeta(meta));
  }

  error(message: string, error?: Error | null, meta?: Record<string, unknown>): void {
    const errorMeta: Record<string, unknown> = this.buildMeta(meta);
    if (error) {
      errorMeta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    this.logger.error(message, errorMeta);
  }

  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    
    if (this.logger.child) {
      return new StructuredLogger(
        this.logger.child({ context: childContext }),
        childContext
      );
    }
    
    return new StructuredLogger(this.logger, childContext);
  }

  private buildMeta(meta?: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    if (this.context) {
      result.context = this.context;
    }
    
    if (meta) {
      Object.assign(result, meta);
    }
    
    return result;
  }
}

// ============================================================================
// No-Op Logger (for testing)
// ============================================================================

/**
 * Silent logger that does nothing (useful for testing)
 */
export class NoOpLogger implements Logger {
  debug(_message: string, _meta?: Record<string, unknown>): void {}
  info(_message: string, _meta?: Record<string, unknown>): void {}
  warn(_message: string, _meta?: Record<string, unknown>): void {}
  error(_message: string, _error?: Error | null, _meta?: Record<string, unknown>): void {}
  child(_context: string): Logger {
    return this;
  }
}

// ============================================================================
// Test Logger (captures logs for assertions)
// ============================================================================

/**
 * Logger that captures all log entries for testing
 */
export class TestLogger implements Logger {
  public readonly entries: LogEntry[] = [];
  private readonly context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.capture('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.capture('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.capture('warn', message, meta);
  }

  error(message: string, error?: Error | null, meta?: Record<string, unknown>): void {
    const errorMeta = error
      ? { ...meta, error: { name: error.name, message: error.message, stack: error.stack } }
      : meta;
    this.capture('error', message, errorMeta);
  }

  child(context: string): TestLogger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    const child = new TestLogger(childContext);
    // Share entries array with parent
    (child as any).entries = this.entries;
    return child;
  }

  private capture(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      meta,
    });
  }

  /**
   * Clear all captured entries
   */
  clear(): void {
    this.entries.length = 0;
  }

  /**
   * Get entries filtered by level
   */
  getByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter((e) => e.level === level);
  }

  /**
   * Check if any entry contains the given message
   */
  hasMessage(message: string): boolean {
    return this.entries.some((e) => e.message.includes(message));
  }
}

// ============================================================================
// Global Logger Management
// ============================================================================

/**
 * Global logger instance
 */
let globalLogger: Logger = new ConsoleLogger('LLMGateway');

/**
 * Set the global logger instance
 * 
 * @example
 * // Use with Winston
 * import winston from 'winston';
 * import { setLogger, StructuredLogger } from '@betterdata/llm-gateway/observability';
 * 
 * const winstonLogger = winston.createLogger({ ... });
 * setLogger(new StructuredLogger(winstonLogger));
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * Get the global logger or create a child logger with context
 * 
 * @example
 * const logger = getLogger('MyComponent');
 * logger.info('Starting up');
 */
export function getLogger(context?: string): Logger {
  if (context) {
    return globalLogger.child(context);
  }
  return globalLogger;
}

/**
 * Reset to default console logger
 */
export function resetLogger(): void {
  globalLogger = new ConsoleLogger('LLMGateway');
}

