// Comprehensive logging utilities for HackXplore backend

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  platform?: string
  requestId?: string
  userId?: string
}

export class Logger {
  private static instance: Logger
  private logLevel: LogLevel = LogLevel.INFO

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private formatLogEntry(entry: LogEntry): string {
    const baseMessage = `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}`

    const contextParts: string[] = []
    if (entry.platform) contextParts.push(`platform=${entry.platform}`)
    if (entry.requestId) contextParts.push(`request=${entry.requestId}`)
    if (entry.userId) contextParts.push(`user=${entry.userId}`)

    const contextStr = contextParts.length > 0 ? ` (${contextParts.join(', ')})` : ''

    const jsonContext = entry.context ? JSON.stringify(entry.context) : ''

    return `${baseMessage}${contextStr}${jsonContext ? ` ${jsonContext}` : ''}`
  }

  debug(message: string, context?: Record<string, any>, additionalInfo?: { platform?: string, requestId?: string, userId?: string }): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      context,
      ...additionalInfo
    }

    console.debug(this.formatLogEntry(entry))
  }

  info(message: string, context?: Record<string, any>, additionalInfo?: { platform?: string, requestId?: string, userId?: string }): void {
    if (!this.shouldLog(LogLevel.INFO)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      context,
      ...additionalInfo
    }

    console.info(this.formatLogEntry(entry))
  }

  warn(message: string, context?: Record<string, any>, additionalInfo?: { platform?: string, requestId?: string, userId?: string }): void {
    if (!this.shouldLog(LogLevel.WARN)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      context,
      ...additionalInfo
    }

    console.warn(this.formatLogEntry(entry))
  }

  error(message: string, context?: Record<string, any>, additionalInfo?: { platform?: string, requestId?: string, userId?: string }): void {
    if (!this.shouldLog(LogLevel.ERROR)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context,
      ...additionalInfo
    }

    console.error(this.formatLogEntry(entry))
  }

  // Specialized logging methods
  scrapingStarted(platform: string, config: Record<string, any>): void {
    this.info(`Scraping started`, config, { platform })
  }

  scrapingCompleted(platform: string, stats: { scraped: number, created: number, updated: number, errors: number }): void {
    this.info(`Scraping completed`, stats, { platform })
  }

  scrapingFailed(platform: string, error: string, context?: Record<string, any>): void {
    this.error(`Scraping failed`, { error, ...context }, { platform })
  }

  apiRequest(method: string, path: string, userId?: string): string {
    const requestId = crypto.randomUUID()
    this.debug(`API request`, { method, path }, { requestId, userId })
    return requestId
  }

  apiResponse(requestId: string, statusCode: number, duration: number): void {
    this.debug(`API response`, { statusCode, duration: `${duration}ms` }, { requestId })
  }

  apiError(requestId: string, error: string, context?: Record<string, any>): void {
    this.error(`API error`, { error, ...context }, { requestId })
  }

  validationError(entity: string, errors: string[], context?: Record<string, any>): void {
    this.warn(`Validation failed for ${entity}`, { errors, ...context })
  }

  databaseQuery(table: string, operation: string, duration: number, recordCount?: number): void {
    this.debug(`Database operation`, { table, operation, duration: `${duration}ms`, recordCount })
  }

  databaseError(table: string, operation: string, error: string, context?: Record<string, any>): void {
    this.error(`Database operation failed`, { table, operation, error, ...context })
  }

  cacheHit(key: string): void {
    this.debug(`Cache hit`, { key })
  }

  cacheMiss(key: string): void {
    this.debug(`Cache miss`, { key })
  }

  cacheError(key: string, error: string): void {
    this.warn(`Cache operation failed`, { key, error })
  }
}

// Export singleton instance
export const logger = Logger.getInstance()

// Request context helper for logging
export class RequestContext {
  private static readonly CONTEXT_KEY = 'hackxplore_request_context'

  static set(context: { requestId: string; userId?: string; platform?: string }): void {
    // In Deno, we use a simple object approach since we don't have async local storage
    globalThis[RequestContext.CONTEXT_KEY] = context
  }

  static get(): { requestId: string; userId?: string; platform?: string } | undefined {
    return globalThis[RequestContext.CONTEXT_KEY]
  }

  static clear(): void {
    delete globalThis[RequestContext.CONTEXT_KEY]
  }
}

// Structured error class for better error tracking
export class HackXploreError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly platform?: string
  public readonly context?: Record<string, any>

  constructor(message: string, code: string, statusCode: number = 500, options?: { platform?: string; context?: Record<string, any> }) {
    super(message)
    this.name = 'HackXploreError'
    this.code = code
    this.statusCode = statusCode
    this.platform = options?.platform
    this.context = options?.context
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      platform: this.platform,
      context: this.context,
      stack: this.stack
    }
  }
}

// Common error codes
export const ErrorCodes = {
  // Scraping errors
  SCRAPER_INIT_FAILED: 'SCRAPER_INIT_FAILED',
  SCRAPER_EXECUTION_FAILED: 'SCRAPER_EXECUTION_FAILED',
  PLATFORM_NOT_FOUND: 'PLATFORM_NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // API errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Database errors
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',

  // Configuration errors
  MISSING_ENVIRONMENT: 'MISSING_ENVIRONMENT',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION'
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]