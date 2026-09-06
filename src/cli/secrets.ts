const SECRET_KEY_PATTERN =
  /(TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|API[_-]?KEY|ACCESS[_-]?KEY|SESSION)/i;

const REDACTED = "<set in environment>";

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

export function redactSecrets(
  values: Record<string, string>,
  showSecrets = false,
): { values: Record<string, string>; secretsRedacted: boolean } {
  if (showSecrets) {
    return { values: { ...values }, secretsRedacted: false };
  }

  let secretsRedacted = false;
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (isSecretKey(key)) {
      redacted[key] = REDACTED;
      secretsRedacted = true;
    } else {
      redacted[key] = value;
    }
  }
  return { values: redacted, secretsRedacted };
}

/** Quote a value for `.env` / shell copy-paste. */
export function quoteEnvValue(value: string): string {
  if (/^[A-Za-z0-9_./:@+-]*$/.test(value)) {
    return value;
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$")}"`;
}
