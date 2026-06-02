/**
 * Simple in-memory rate limiter
 * For production, replace with Redis-based solution
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Store rate limit data in memory (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean every minute

export interface RateLimitConfig {
  maxAttempts: number      // Maximum attempts allowed
  windowMs: number         // Time window in milliseconds
  blockDurationMs?: number // How long to block after exceeding limit
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  blocked: boolean
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const key = identifier
  const entry = rateLimitStore.get(key)

  // If no entry exists or window has expired, create new entry
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return {
      success: true,
      remaining: config.maxAttempts - 1,
      resetTime: now + config.windowMs,
      blocked: false,
    }
  }

  // Check if blocked — extend resetTime by blockDurationMs on first hit
  if (entry.count >= config.maxAttempts) {
    if (config.blockDurationMs) {
      const extendedUntil = now + config.blockDurationMs
      if (extendedUntil > entry.resetTime) {
        entry.resetTime = extendedUntil
        rateLimitStore.set(key, entry)
      }
    }
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      blocked: true,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  return {
    success: true,
    remaining: Math.max(0, config.maxAttempts - entry.count),
    resetTime: entry.resetTime,
    blocked: false,
  }
}

/**
 * Reset rate limit for an identifier (e.g., after successful login)
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier)
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry || now > entry.resetTime) {
    return {
      success: true,
      remaining: config.maxAttempts,
      resetTime: now + config.windowMs,
      blocked: false,
    }
  }

  return {
    success: entry.count < config.maxAttempts,
    remaining: Math.max(0, config.maxAttempts - entry.count),
    resetTime: entry.resetTime,
    blocked: entry.count >= config.maxAttempts,
  }
}

// Predefined configurations
export const RATE_LIMIT_CONFIGS = {
  // Login: 5 attempts per 15 minutes
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000, // 30 minutes block
  },
  // API: 100 requests per minute
  api: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  // Contact form: 3 submissions per hour
  contact: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Password reset: 3 attempts per hour
  passwordReset: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
} as const
