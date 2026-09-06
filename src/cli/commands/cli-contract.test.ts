import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import { StateStore } from "../../core/state-store.js";
import { createEnvironment } from "./create.js";
import { destroyEnvironment } from "./destroy.js";
import { enableServices } from "./enable.js";
import { statusEnvironment } from "./status.js";
import { listProviders } from "./providers.js";

const testConfigPath = "/tmp/sandman-cli-command-tests.json";

function mockExit() {
  return vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`EXIT:${code}`);
  }) as typeof process.exit);
}

describe("CLI commands", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await fs.unlink(testConfigPath);
    } catch {
      // ignore
    }
  });

  it("rejects unsafe environment names in JSON mode", async () => {
    const store = new StateStore(testConfigPath);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    mockExit();

    await expect(
      createEnvironment("Bad Name", { provider: "aws" }, store, {
        json: true,
        dryRun: true,
      }),
    ).rejects.toThrow(/EXIT:1/);

    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.success).toBe(false);
    expect(parsed.code).toBe("INVALID_NAME");
  });

  it("does not hang on destroy --json without -y", async () => {
    const store = new StateStore(testConfigPath);
    await store.saveEnvironment({
      name: "demo",
      provider: "aws",
      status: "active",
      services: [],
      resources: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    mockExit();

    await expect(
      destroyEnvironment("demo", store, { confirmed: false, json: true }),
    ).rejects.toThrow(/EXIT:1/);

    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.code).toBe("CONFIRMATION_REQUIRED");
    expect(parsed.next[0]).toContain("-y");
  });

  it("returns JSON for status when the environment is missing", async () => {
    const store = new StateStore(testConfigPath);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    mockExit();

    await expect(
      statusEnvironment("missing", store, { json: true }),
    ).rejects.toThrow(/EXIT:1/);

    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.success).toBe(false);
    expect(parsed.code).toBe("NOT_FOUND");
  });

  it("lists valid Cloudflare services instead of crashing", async () => {
    const store = new StateStore(testConfigPath);
    await store.saveEnvironment({
      name: "cf-demo",
      provider: "cloudflare",
      status: "active",
      services: [],
      resources: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    mockExit();

    await expect(
      enableServices(["not-a-service"], "cf-demo", store, { json: true }),
    ).rejects.toThrow(/EXIT:1/);

    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.code).toBe("INVALID_SERVICE");
    expect(parsed.validServices).toContain("workers");
  });

  it("exposes provider maturity for agents", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await listProviders({ json: true });
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.success).toBe(true);
    const cf = parsed.providers.find((p: { id: string }) => p.id === "cloudflare");
    expect(cf.maturity).toBe("experimental");
    const aws = parsed.providers.find((p: { id: string }) => p.id === "aws");
    expect(aws.maturity).toBe("supported");
  });
});
