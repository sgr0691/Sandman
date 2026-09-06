import { describe, it, expect } from "vitest";
import { isValidEnvName } from "./env-name.js";
import { quoteEnvValue, redactSecrets } from "./secrets.js";

describe("environment names", () => {
  it("accepts DNS-safe names", () => {
    expect(isValidEnvName("demo")).toBe(true);
    expect(isValidEnvName("api-test-1")).toBe(true);
  });

  it("rejects names that would break shell or cloud IDs", () => {
    expect(isValidEnvName("Demo")).toBe(false);
    expect(isValidEnvName("-leading")).toBe(false);
    expect(isValidEnvName("has space")).toBe(false);
    expect(isValidEnvName("rm;pwd")).toBe(false);
    expect(isValidEnvName("`curl`")).toBe(false);
  });
});

describe("secret redaction", () => {
  it("redacts token values by default", () => {
    const { values, secretsRedacted } = redactSecrets({
      CLOUDFLARE_ACCOUNT_ID: "abc",
      CLOUDFLARE_API_TOKEN: "super-secret",
    });
    expect(values.CLOUDFLARE_ACCOUNT_ID).toBe("abc");
    expect(values.CLOUDFLARE_API_TOKEN).toBe("<set in environment>");
    expect(secretsRedacted).toBe(true);
  });

  it("keeps secrets when explicitly requested", () => {
    const { values, secretsRedacted } = redactSecrets(
      { VERCEL_TOKEN: "tok" },
      true,
    );
    expect(values.VERCEL_TOKEN).toBe("tok");
    expect(secretsRedacted).toBe(false);
  });

  it("quotes unsafe env values", () => {
    expect(quoteEnvValue("plain")).toBe("plain");
    expect(quoteEnvValue("a b")).toBe('"a b"');
    expect(quoteEnvValue('say "hi"')).toBe('"say \\"hi\\""');
  });
});
