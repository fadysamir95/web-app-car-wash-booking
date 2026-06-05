type RateRecord = {
  count: number;
  resetAt: number;
};

const hits = new Map<string, RateRecord>();

export function checkRateLimit(key: string, limit = 6, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const record = hits.get(key);

  if (!record || record.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { ok: false, remaining: 0 };
  }

  record.count += 1;
  return { ok: true, remaining: limit - record.count };
}
