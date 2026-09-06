/**
 * Adapter and CLI diagnostics go to stderr so `--json` stdout stays parseable.
 */
export const logger = {
  info(message: string): void {
    console.error(message);
  },
  warn(message: string): void {
    console.error(message);
  },
};
