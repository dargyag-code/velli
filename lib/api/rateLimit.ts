import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ── Lazy init de Redis ─────────────────────────────────────────────────────
// `undefined` = aún no consultado. `null` = env vars faltan, deshabilitado.
let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _redis = null;
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// ── Limiters (lazy, cacheados) ─────────────────────────────────────────────
let _analyzeLimiter: Ratelimit | null | undefined;
let _validateLimiter: Ratelimit | null | undefined;

export function analyzeLimiter(): Ratelimit | null {
  if (_analyzeLimiter !== undefined) return _analyzeLimiter;
  const redis = getRedis();
  if (!redis) {
    _analyzeLimiter = null;
    return null;
  }
  _analyzeLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'velli:rl:analyze',
    analytics: false,
  });
  return _analyzeLimiter;
}

export function validateLimiter(): Ratelimit | null {
  if (_validateLimiter !== undefined) return _validateLimiter;
  const redis = getRedis();
  if (!redis) {
    _validateLimiter = null;
    return null;
  }
  _validateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 h'),
    prefix: 'velli:rl:validate',
    analytics: false,
  });
  return _validateLimiter;
}

let _checkoutLimiter: Ratelimit | null | undefined;

export function checkoutLimiter(): Ratelimit | null {
  if (_checkoutLimiter !== undefined) return _checkoutLimiter;
  const redis = getRedis();
  if (!redis) {
    _checkoutLimiter = null;
    return null;
  }
  _checkoutLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'velli:rl:checkout',
    analytics: false,
  });
  return _checkoutLimiter;
}

// ── checkRateLimit ─────────────────────────────────────────────────────────
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  reset: number;
}

let _warned = false;

export async function checkRateLimit(
  limiter: Ratelimit | null,
  userId: string
): Promise<RateLimitResult> {
  if (!limiter) {
    if (!_warned) {
      console.warn(
        '[rateLimit] UPSTASH_REDIS_REST_URL no configurada — rate limit deshabilitado en este proceso'
      );
      _warned = true;
    }
    return { ok: true, remaining: Number.MAX_SAFE_INTEGER, reset: Date.now() };
  }
  const { success, remaining, reset } = await limiter.limit(userId);
  return { ok: success, remaining, reset };
}
