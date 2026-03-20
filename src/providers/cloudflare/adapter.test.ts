import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudflareAdapter } from "./adapter.js";
import { ServiceName } from "../../types/index.js";

global.fetch = vi.fn();

describe("CloudflareAdapter", () => {
  let adapter: CloudflareAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    adapter = new CloudflareAdapter();
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
  });

  describe("init", () => {
    it("should throw if CLOUDFLARE_API_TOKEN is missing", async () => {
      delete process.env.CLOUDFLARE_API_TOKEN;
      await expect(adapter.init()).rejects.toThrow(
        "CLOUDFLARE_API_TOKEN environment variable is required",
      );
    });

    it("should authenticate and fetch account ID", async () => {
      process.env.CLOUDFLARE_API_TOKEN = "test-token";
      process.env.CLOUDFLARE_ACCOUNT_ID = "abc123";

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { id: "user123" } }),
      });

      await adapter.init();
      // Would throw if auth failed
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/user",
        expect.any(Object),
      );
    });

    it("should throw on authentication failure", async () => {
      process.env.CLOUDFLARE_API_TOKEN = "bad-token";

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ errors: [{ message: "Invalid token" }] }),
      });

      await expect(adapter.init()).rejects.toThrow(
        "Cloudflare authentication failed: Invalid token",
      );
    });

    it("should fetch first account when ACCOUNT_ID not set", async () => {
      process.env.CLOUDFLARE_API_TOKEN = "test-token";
      delete process.env.CLOUDFLARE_ACCOUNT_ID;

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: { id: "user123" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: [{ id: "account123", name: "My Account" }],
          }),
        });

      await adapter.init();
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts",
        expect.any(Object),
      );
    });
  });

  describe("createEnvironment", () => {
    it("should create an environment record with namespaceId", async () => {
      const env = await adapter.createEnvironment("test-env");

      expect(env.name).toBe("test-env");
      expect(env.provider).toBe("cloudflare");
      expect(env.status).toBe("active");
      expect(env.resources.namespaceId).toMatch(/^sandman-test-env-/);
    });

    it("should include accountId from env", async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = "my-account";
      const env = await adapter.createEnvironment("prod");

      expect(env.accountId).toBe("my-account");
    });
  });

  describe("enableServices", () => {
    it("should log services to enable", async () => {
      const env = {
        name: "test",
        provider: "cloudflare" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const consoleSpy = vi.spyOn(console, "log");
      await adapter.enableServices(env, ["workers", "kv", "d1"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Enabling Cloudflare services: workers, kv, d1",
      );
      consoleSpy.mockRestore();
    });

    it("should filter invalid services", async () => {
      const env = {
        name: "test",
        provider: "cloudflare" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const consoleSpy = vi.spyOn(console, "log");
      await adapter.enableServices(env, ["invalid-service" as ServiceName]);

      expect(consoleSpy).toHaveBeenCalledWith("Enabling Cloudflare services: ");
      consoleSpy.mockRestore();
    });
  });

  describe("connect", () => {
    it("should return environment variables", async () => {
      process.env.CLOUDFLARE_API_TOKEN = "my-token";
      process.env.CLOUDFLARE_ACCOUNT_ID = "my-account";

      const env = {
        name: "test",
        provider: "cloudflare" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { namespaceId: "ns-123" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountId: "my-account",
      };

      const creds = await adapter.connect(env);

      expect(creds.provider).toBe("cloudflare");
      expect(creds.CLOUDFLARE_ACCOUNT_ID).toBe("my-account");
      expect(creds.CLOUDFLARE_API_TOKEN).toBe("my-token");
      expect(creds.CLOUDFLARE_NAMESPACE_ID).toBe("ns-123");
    });

    it("should work without optional fields", async () => {
      const env = {
        name: "test",
        provider: "cloudflare" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const creds = await adapter.connect(env);

      expect(creds.provider).toBe("cloudflare");
      expect(creds.CLOUDFLARE_ACCOUNT_ID).toBeUndefined();
    });
  });

  describe("destroyEnvironment", () => {
    it("should log cleanup message", async () => {
      const env = {
        name: "test",
        provider: "cloudflare" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { namespaceId: "ns-123" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const consoleSpy = vi.spyOn(console, "log");
      await adapter.destroyEnvironment(env);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Cleaning up Cloudflare resources for environment: test",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getStatus", () => {
    it("should return environment as-is", async () => {
      const env = {
        name: "test",
        provider: "cloudflare" as const,
        status: "active" as const,
        services: ["workers", "kv"] as ServiceName[],
        resources: { namespaceId: "ns-123" },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = await adapter.getStatus(env);
      expect(result).toEqual(env);
    });
  });

  describe("interface compliance", () => {
    it("should have all required methods", () => {
      expect(typeof adapter.init).toBe("function");
      expect(typeof adapter.createEnvironment).toBe("function");
      expect(typeof adapter.enableServices).toBe("function");
      expect(typeof adapter.connect).toBe("function");
      expect(typeof adapter.destroyEnvironment).toBe("function");
      expect(typeof adapter.getStatus).toBe("function");
    });
  });
});
