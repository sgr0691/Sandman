import { describe, it, expect, vi, beforeEach } from "vitest";
import { GcpAdapter } from "./adapter.js";

vi.mock("@google-cloud/resource-manager", () => ({
  ProjectsClient: vi.fn().mockImplementation(() => ({
    searchProjects: vi
      .fn()
      .mockResolvedValue([
        [{ projectId: "test-project", name: "Test Project" }],
      ]),
    getProject: vi
      .fn()
      .mockResolvedValue([{ projectId: "test-project", name: "Test" }]),
  })),
}));

describe("GcpAdapter", () => {
  let adapter: GcpAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GcpAdapter();
  });

  describe("init", () => {
    it("should authenticate successfully", async () => {
      await expect(adapter.init()).resolves.not.toThrow();
    });

    it("should set projectId from environment variable", async () => {
      process.env.GCP_PROJECT = "my-project";
      const newAdapter = new GcpAdapter();
      await newAdapter.init();
      expect(newAdapter.getProjectId()).toBe("my-project");
      delete process.env.GCP_PROJECT;
    });

    it("should set projectId from found projects", async () => {
      delete process.env.GCP_PROJECT;
      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.CLOUDSDK_CORE_PROJECT;

      await adapter.init();
      expect(adapter.getProjectId()).toBe("test-project");
    });
  });

  describe("createEnvironment", () => {
    it("should create an environment record", async () => {
      const env = await adapter.createEnvironment("test-env");

      expect(env.name).toBe("test-env");
      expect(env.provider).toBe("gcp");
      expect(env.status).toBe("active");
      expect(env.projectId).toMatch(/^sandman-test-env-/);
    });
  });

  describe("enableServices", () => {
    it("should log services to enable", async () => {
      const env = {
        name: "test",
        provider: "gcp" as const,
        status: "active" as const,
        services: [],
        resources: {},
        projectId: "test-project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const consoleSpy = vi.spyOn(console, "log");
      await adapter.enableServices(env, ["compute", "storage"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Enabling GCP services: compute.googleapis.com, storage.googleapis.com",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("connect", () => {
    it("should return environment variables", async () => {
      const env = {
        name: "test",
        provider: "gcp" as const,
        status: "active" as const,
        services: [],
        resources: {},
        projectId: "my-gcp-project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const creds = await adapter.connect(env);

      expect(creds.provider).toBe("gcp");
      expect(creds.GCP_PROJECT).toBe("my-gcp-project");
    });
  });

  describe("destroyEnvironment", () => {
    it("should log project deletion", async () => {
      const env = {
        name: "test",
        provider: "gcp" as const,
        status: "active" as const,
        services: [],
        resources: {},
        projectId: "test-project",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const consoleSpy = vi.spyOn(console, "log");
      await adapter.destroyEnvironment(env);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Would delete GCP project: test-project",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getStatus", () => {
    it("should return environment as-is", async () => {
      const env = {
        name: "test",
        provider: "gcp" as const,
        status: "active" as const,
        services: ["compute"] as any[],
        resources: {},
        projectId: "test-project",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = await adapter.getStatus(env);
      expect(result).toEqual(env);
    });
  });

  describe("setBillingAccount", () => {
    it("should set billing account", () => {
      adapter.setBillingAccount("123456-ABCDEF");
      // Internal state, just verify it doesn't throw
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
