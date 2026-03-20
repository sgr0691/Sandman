import { describe, it, expect, vi, beforeEach } from "vitest";
import { VercelAdapter } from "./adapter.js";
import { ServiceName } from "../../types/index.js";

global.fetch = vi.fn();

describe("VercelAdapter", () => {
  let adapter: VercelAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    adapter = new VercelAdapter();
    delete process.env.VERCEL_TEAM_ID;
  });

  describe("init", () => {
    it("should throw if VERCEL_TOKEN is missing", async () => {
      delete process.env.VERCEL_TOKEN;
      await expect(adapter.init()).rejects.toThrow(
        "VERCEL_TOKEN environment variable is required",
      );
    });

    it("should authenticate successfully", async () => {
      process.env.VERCEL_TOKEN = "test-token";

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: "user123" } }),
      });

      await expect(adapter.init()).resolves.not.toThrow();
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.vercel.com/v2/user",
        expect.any(Object),
      );
    });

    it("should throw on authentication failure", async () => {
      process.env.VERCEL_TOKEN = "bad-token";

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: "Invalid token" } }),
      });

      await expect(adapter.init()).rejects.toThrow(
        "Vercel authentication failed: Invalid token",
      );
    });

    it("should capture team ID from env", async () => {
      process.env.VERCEL_TOKEN = "test-token";
      process.env.VERCEL_TEAM_ID = "team_abc123";

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: "user123" } }),
      });

      await adapter.init();
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("createEnvironment", () => {
    it("should create an environment record with projectName", async () => {
      const env = await adapter.createEnvironment("test-env");

      expect(env.name).toBe("test-env");
      expect(env.provider).toBe("vercel");
      expect(env.status).toBe("active");
      expect(env.projectId).toMatch(/^sandman-test-env-/);
      expect(env.resources.projectName).toMatch(/^sandman-test-env-/);
    });
  });

  describe("enableServices", () => {
    it("should log services to enable", async () => {
      const env = {
        name: "test",
        provider: "vercel" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const consoleSpy = vi.spyOn(console, "log");
      await adapter.enableServices(env, ["functions", "edge", "blob"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Enabling Vercel services: functions, edge, blob",
      );
      consoleSpy.mockRestore();
    });

    it("should filter invalid services", async () => {
      const env = {
        name: "test",
        provider: "vercel" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const consoleSpy = vi.spyOn(console, "log");
      await adapter.enableServices(env, ["invalid-service" as ServiceName]);

      expect(consoleSpy).toHaveBeenCalledWith("Enabling Vercel services: ");
      consoleSpy.mockRestore();
    });
  });

  describe("connect", () => {
    it("should return environment variables", async () => {
      process.env.VERCEL_TOKEN = "my-token";
      process.env.VERCEL_TEAM_ID = "team_abc";

      const env = {
        name: "test",
        provider: "vercel" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { projectName: "my-project" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId: "my-project",
      };

      const creds = await adapter.connect(env);

      expect(creds.provider).toBe("vercel");
      expect(creds.VERCEL_TOKEN).toBe("my-token");
      expect(creds.VERCEL_PROJECT_NAME).toBe("my-project");
      expect(creds.VERCEL_TEAM_ID).toBe("team_abc");
    });

    it("should work without optional fields", async () => {
      const env = {
        name: "test",
        provider: "vercel" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const creds = await adapter.connect(env);

      expect(creds.provider).toBe("vercel");
      expect(creds.VERCEL_TEAM_ID).toBeUndefined();
    });
  });

  describe("destroyEnvironment", () => {
    it("should log cleanup message", async () => {
      const env = {
        name: "test",
        provider: "vercel" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { projectName: "my-project" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const consoleSpy = vi.spyOn(console, "log");
      await adapter.destroyEnvironment(env);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Cleaning up Vercel resources for environment: test",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getStatus", () => {
    it("should return environment as-is", async () => {
      const env = {
        name: "test",
        provider: "vercel" as const,
        status: "active" as const,
        services: ["functions", "blob"] as ServiceName[],
        resources: { projectName: "my-project" },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        projectId: "my-project",
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
