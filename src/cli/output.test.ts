import { describe, it, expect, vi, afterEach } from "vitest";
import {
  emitErr,
  emitOk,
  errPayload,
  mapThrownError,
  okPayload,
} from "./output.js";
import { StateError } from "../core/state-store.js";

describe("CLI output contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("okPayload is additive and parseable", () => {
    const payload = okPayload({ name: "demo", provider: "aws" });
    expect(payload).toEqual({
      success: true,
      code: "OK",
      name: "demo",
      provider: "aws",
    });
    expect(() => JSON.parse(JSON.stringify(payload))).not.toThrow();
  });

  it("errPayload keeps the error key agents already parse", () => {
    const payload = errPayload("NOT_FOUND", 'Environment "demo" not found.', {
      hint: "Run sandman list",
      next: ["sandman list --json"],
    });
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("NOT_FOUND");
    expect(payload.error).toContain("demo");
    expect(payload.next).toEqual(["sandman list --json"]);
  });

  it("emitOk writes a single JSON line to stdout", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    emitOk(true, { name: "demo" }, () => {
      throw new Error("human renderer should not run");
    });
    expect(log).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed).toEqual({ success: true, code: "OK", name: "demo" });
  });

  it("emitErr writes JSON then exits", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`EXIT:${code}`);
    }) as typeof process.exit);

    expect(() =>
      emitErr(true, {
        code: "CONFIRMATION_REQUIRED",
        error: "pass -y",
        next: ["sandman destroy demo -y --json"],
      }),
    ).toThrow(/EXIT:1/);

    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.success).toBe(false);
    expect(parsed.code).toBe("CONFIRMATION_REQUIRED");
    expect(parsed.next[0]).toContain("-y");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("maps StateError to STATE_CORRUPT", () => {
    expect(mapThrownError(new StateError("broken"))).toEqual({
      code: "STATE_CORRUPT",
      error: "broken",
    });
  });

  it("maps auth failures to AUTH_REQUIRED", () => {
    expect(mapThrownError(new Error("AWS credentials required. Configure with aws configure")).code).toBe(
      "AUTH_REQUIRED",
    );
  });
});
