/**
 * Environment names must be safe for shell, S3 bucket suffixes, GCP project IDs, and .env files.
 */
export const ENV_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,30}$/;

export function isValidEnvName(name: string): boolean {
  return ENV_NAME_PATTERN.test(name);
}

export const ENV_NAME_HINT =
  'Use 1–31 characters: lowercase letters, digits, and hyphens (e.g. "demo", "api-test-1").';
