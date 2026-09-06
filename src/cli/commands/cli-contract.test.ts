import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import { StateStore } from "../../core/state-store.js";
import { createEnvironment } from "./create.js";
import { destroyEnvironment } from "./destroy.js";
import { enableServices } from "./enable.js";
import { statusEnvironment } from "./status.js";
import { listProviders } from "./providers.js";
import { doctor } from "./doctor.js";

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
    try {
      await fs.unlink(`${testConfigPath}.lock`);
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

  it("allows recreate after destroy via dry-run", async () => {
    const store = new StateStore(testConfigPath);
    await store.saveEnvironment({
      name: "demo",
      provider: "aws",
      status: "destroyed",
      services: [],
      resources: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await createEnvironment("demo", { provider: "aws" }, store, {
      json: true,
      dryRun: true,
    });

    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.success).toBe(true);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.name).toBe("demo");
  });

  it("rejects recreate when the existing record is still active", async () => {
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
      createEnvironment("demo", { provider: "aws" }, store, {
        json: true,
        dryRun: true,
      }),
    ).rejects.toThrow(/EXIT:1/);

    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.code).toBe("ALREADY_EXISTS");
  });

  it("passes the requested region through dry-run create", async () => {
    const store = new StateStore(testConfigPath);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await createEnvironment(
      "demo",
      { provider: "aws", region: "eu-west-1" },
      store,
      { json: true, dryRun: true },
    );

    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.success).toBe(true);
    expect(parsed.region).toBe("eu-west-1");
  });

  it("rejects an invalid create TTL", async () => {
    const store = new StateStore(testConfigPath);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    mockExit();

    await expect(
      createEnvironment(
        "demo",
        { provider: "aws", ttl: "two-hours" },
        store,
        { json: true, dryRun: true },
      ),
    ).rejects.toThrow(/EXIT:1/);

    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.code).toBe("INVALID_TTL");
  });

  it("passes ttl, billing, and strict through dry-run create", async () => {
    const store = new StateStore(testConfigPath);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await createEnvironment(
      "demo",
      { provider: "gcp", region: "us-central1", billingAccount: "AAAAAA-BBBBBB-CCCCCC", ttl: "2h" },
      store,
      { json: true, dryRun: true, strict: true },
    );

    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.success).toBe(true);
    expect(parsed.ttl).toBe("2h");
    expect(parsed.expiresAt).toBeDefined();
    expect(parsed.billingAccount).toBe("AAAAAA-BBBBBB-CCCCCC");
    expect(parsed.strict).toBe(true);
  });

  it("reports local-only when enabling lambda on AWS", async () => {
    const store = new StateStore(testConfigPath);
    await store.saveEnvironment({
      name: "demo",
      provider: "aws",
      status: "active",
      services: [],
      resources: { bucketName: "sandman-demo-1", instanceId: "i-1" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await enableServices(["lambda", "s3"], "demo", store, { json: true });
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.success).toBe(true);
    expect(parsed.mode).toBe("mixed");
    expect(parsed.localOnly).toContain("lambda");
    expect(parsed.provisioned).toContain("s3");
  });

  it("reaps an expired environment on status", async () => {
    const store = new StateStore(testConfigPath);
    await store.saveEnvironment({
      name: "old",
      provider: "cloudflare",
      status: "active",
      services: [],
      resources: {},
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
      expiresAt: "2020-01-02T00:00:00.000Z",
      ttl: "1h",
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await statusEnvironment("old", store, { json: true });
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.reaped).toBe(true);
    expect(parsed.status).toBe("destroyed");
    expect(await store.getEnvironment("old")).toBeUndefined();
  });

  it("prints doctor JSON without requiring cloud auth", async () => {
    const store = new StateStore(testConfigPath);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await doctor(store, { json: true });
    const parsed = JSON.parse(String(log.mock.calls[0][0]));
    expect(parsed.success).toBe(true);
    expect(parsed.initialized).toBe(false);
    expect(parsed.configPath).toBe(testConfigPath);
    expect(parsed.auth.VERCEL_TOKEN).toMatch(/set|missing/);
  });
});
