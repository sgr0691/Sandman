import chalk from "chalk";

export type ResultCode =
  | "OK"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "NO_PROVIDER"
  | "INVALID_PROVIDER"
  | "INVALID_NAME"
  | "INVALID_SERVICE"
  | "AMBIGUOUS"
  | "AUTH_REQUIRED"
  | "CONFIRMATION_REQUIRED"
  | "PROVIDER_ERROR"
  | "STATE_CORRUPT"
  | "INTERNAL";

export interface OkPayload extends Record<string, unknown> {
  success: true;
  code: "OK";
}

export interface ErrPayload extends Record<string, unknown> {
  success: false;
  code: ResultCode;
  error: string;
  hint?: string;
  next?: string[];
}

export function okPayload(data: Record<string, unknown> = {}): OkPayload {
  return { success: true, code: "OK", ...data };
}

export function errPayload(
  code: ResultCode,
  error: string,
  extra: Record<string, unknown> = {},
): ErrPayload {
  return { success: false, code, error, ...extra };
}

export function emitOk(
  json: boolean | undefined,
  data: Record<string, unknown>,
  human: () => void,
): void {
  if (json) {
    console.log(JSON.stringify(okPayload(data)));
    return;
  }
  human();
}

export function emitErr(
  json: boolean | undefined,
  payload: {
    code: ResultCode;
    error: string;
    hint?: string;
    next?: string[];
    [key: string]: unknown;
  },
  human?: () => void,
): never {
  const { code, error, hint, next, ...rest } = payload;
  if (json) {
    const extra: Record<string, unknown> = { ...rest };
    if (hint) extra.hint = hint;
    if (next) extra.next = next;
    console.log(JSON.stringify(errPayload(code, error, extra)));
  } else if (human) {
    human();
  } else {
    console.error(chalk.red(`Error: ${error}`));
    if (hint) {
      console.error(chalk.gray(hint));
    }
    if (next) {
      for (const step of next) {
        console.error(chalk.cyan(`→ ${step}`));
      }
    }
  }
  process.exit(1);
}

export function mapThrownError(error: unknown): {
  code: ResultCode;
  error: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const maybeCode = (error as { code?: string } | undefined)?.code;

  if (maybeCode === "STATE_CORRUPT") {
    return { code: "STATE_CORRUPT", error: message };
  }
  if (/credentials required|authentication required|unauthenticated/i.test(message)) {
    return { code: "AUTH_REQUIRED", error: message };
  }
  return { code: "PROVIDER_ERROR", error: message };
}

export async function runCommand(
  json: boolean | undefined,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    emitErr(json, mapThrownError(error));
  }
}
