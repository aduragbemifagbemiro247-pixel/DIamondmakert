import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
}) {
  const buckets = new Map<string, Bucket>();

  // Periodic cleanup to keep memory bounded
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets.entries()) {
      if (b.resetAt <= now) {
        buckets.delete(k);
      }
    }
  }, Math.max(30_000, options.windowMs)).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : '') ||
      req.ip ||
      'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error:
          options.message ||
          `Too many attempts. Please wait ${retryAfterSec} seconds before trying again.`,
      });
      return;
    }

    existing.count += 1;
    next();
  };
}
