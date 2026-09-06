const TTL_PATTERN = /^(\d+)(s|m|h|d)$/i;

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const TTL_HINT = 'Use a duration like 30m, 2h, or 1d.';

export function parseTtl(input: string): { ms: number; label: string } {
  const match = TTL_PATTERN.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid TTL "${input}". ${TTL_HINT}`);
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid TTL "${input}". ${TTL_HINT}`);
  }
  const unit = match[2].toLowerCase();
  return { ms: amount * UNIT_MS[unit], label: `${amount}${unit}` };
}

export function expiresAtFromTtl(
  ttl: string,
  fromMs: number = Date.now(),
): { expiresAt: string; ttl: string } {
  const parsed = parseTtl(ttl);
  return {
    ttl: parsed.label,
    expiresAt: new Date(fromMs + parsed.ms).toISOString(),
  };
}

export function isExpired(
  env: { expiresAt?: string },
  nowMs: number = Date.now(),
): boolean {
  if (!env.expiresAt) {
    return false;
  }
  const expires = Date.parse(env.expiresAt);
  return Number.isFinite(expires) && expires <= nowMs;
}
