import { describe, expect, it } from "vitest";
import { expiresAtFromTtl, isExpired, parseTtl } from "./ttl.js";

describe("ttl", () => {
  it("parses hour and minute durations", () => {
    expect(parseTtl("2h")).toEqual({ ms: 2 * 60 * 60 * 1000, label: "2h" });
    expect(parseTtl("30m")).toEqual({ ms: 30 * 60 * 1000, label: "30m" });
    expect(parseTtl("90s").ms).toBe(90_000);
    expect(parseTtl("1d").ms).toBe(24 * 60 * 60 * 1000);
  });

  it("rejects invalid TTL values", () => {
    expect(() => parseTtl("2 hours")).toThrow(/Invalid TTL/);
    expect(() => parseTtl("0h")).toThrow(/Invalid TTL/);
    expect(() => parseTtl("")).toThrow(/Invalid TTL/);
  });

  it("computes expiresAt from now", () => {
    const from = Date.parse("2026-01-01T00:00:00.000Z");
    const result = expiresAtFromTtl("2h", from);
    expect(result.ttl).toBe("2h");
    expect(result.expiresAt).toBe("2026-01-01T02:00:00.000Z");
  });

  it("detects expired environments", () => {
    expect(
      isExpired({ expiresAt: "2020-01-01T00:00:00.000Z" }, Date.parse("2026-01-01T00:00:00.000Z")),
    ).toBe(true);
    expect(
      isExpired({ expiresAt: "2027-01-01T00:00:00.000Z" }, Date.parse("2026-01-01T00:00:00.000Z")),
    ).toBe(false);
    expect(isExpired({})).toBe(false);
  });
});
