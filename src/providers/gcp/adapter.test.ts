import { describe, it, expect, vi, beforeEach } from "vitest";
import { GcpAdapter } from "./adapter.js";

const mockEnableService = vi.fn();
const mockCreateProject = vi.fn();
const mockGetProject = vi.fn();
const mockDeleteProject = vi.fn();
const mockGetOperation = vi.fn();

vi.mock("@google-cloud/resource-manager", () => ({
  ProjectsClient: vi.fn().mockImplementation(() => ({
    searchProjects: vi
      .fn()
      .mockResolvedValue([
        [{ projectId: "test-project", name: "Test Project" }],
      ]),
    getProject: mockGetProject,
    createProject: mockCreateProject,
    deleteProject: mockDeleteProject,
  })),
}));

vi.mock("@google-cloud/service-usage", () => ({
  ServiceUsageClient: vi.fn().mockImplementation(() => ({
    enableService: mockEnableService,
  })),
}));

describe("GcpAdapter", () => {
  let adapter: GcpAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnableService.mockResolvedValue([{}]);
    // Mock successful project creation
    const mockOperation = {
      promise: vi
        .fn()
        .mockResolvedValue([{ name: "projects/sandman-test-env-123456789" }]),
    };
    mockCreateProject.mockResolvedValue([mockOperation]);
    mockGetProject.mockResolvedValue([
      { projectId: "sandman-test-env-123456789", projectNumber: "1234567890" },
    ]);
    mockDeleteProject.mockResolvedValue([mockOperation]);
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
      await adapter.init(); // Initialize first
      const env = await adapter.createEnvironment("test-env");

      expect(env.name).toBe("test-env");
      expect(env.provider).toBe("gcp");
      expect(env.status).toBe("active");
      expect(env.projectId).toMatch(/^sandman-test-env-/);
    });

    it("should create actual GCP project via Resource Manager API", async () => {
      await adapter.init(); // Initialize first
      await adapter.createEnvironment("test-env");

      expect(mockCreateProject).toHaveBeenCalledWith({
        project: expect.objectContaining({
          projectId: expect.stringMatching(/^sandman-test-env-/),
          name: "Sandman Environment: test-env",
        }),
      });
    });

    it("should throw error when no project configured", async () => {
      // Create a mock that returns no projects
      const { ProjectsClient } = await import("@google-cloud/resource-manager");
      (ProjectsClient as any).mockImplementationOnce(() => ({
        searchProjects: vi.fn().mockResolvedValue([[]]), // Empty projects array
      }));

      const freshAdapter = new GcpAdapter();
      await freshAdapter.init();

      await expect(freshAdapter.createEnvironment("test-env")).rejects.toThrow(
        "No GCP project configured",
      );
    });
  });

  describe("enableServices", () => {
    it("should call Service Usage API to enable services", async () => {
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

      await adapter.enableServices(env, ["compute", "storage"]);

      // Verify Service Usage API was called for each service
      expect(mockEnableService).toHaveBeenCalledTimes(2);
      expect(mockEnableService).toHaveBeenCalledWith({
        name: "projects/test-project/services/compute.googleapis.com",
      });
      expect(mockEnableService).toHaveBeenCalledWith({
        name: "projects/test-project/services/storage.googleapis.com",
      });
    });

    it("should throw error when projectId is missing", async () => {
      const env = {
        name: "test",
        provider: "gcp" as const,
        status: "active" as const,
        services: [],
        resources: {},
        projectId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(
        adapter.enableServices(env as any, ["compute"]),
      ).rejects.toThrow("Project ID is required to enable services");
    });

    it("should handle API errors gracefully", async () => {
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

      mockEnableService.mockRejectedValueOnce(new Error("API Error"));

      await expect(adapter.enableServices(env, ["compute"])).rejects.toThrow(
        "Failed to enable GCP services",
      );
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
    it("should delete GCP project via Resource Manager API", async () => {
      const env = {
        name: "test",
        provider: "gcp" as const,
        status: "active" as const,
        services: [],
        resources: {},
        projectId: "sandman-test-env-123456789",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adapter.destroyEnvironment(env);

      expect(mockDeleteProject).toHaveBeenCalledWith({
        name: "projects/sandman-test-env-123456789",
      });
    });

    it("should throw error when projectId is missing", async () => {
      const env = {
        name: "test",
        provider: "gcp" as const,
        status: "active" as const,
        services: [],
        resources: {},
        projectId: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(adapter.destroyEnvironment(env)).rejects.toThrow(
        "Project ID is required to destroy environment",
      );
    });
  });

  describe("getStatus", () => {
    it("should return active status when project is ACTIVE", async () => {
      mockGetProject.mockResolvedValueOnce([
        { projectId: "test-project", lifecycleState: "ACTIVE" },
      ]);

      const env = {
        name: "test",
        provider: "gcp" as const,
        status: "pending" as const,
        services: ["compute"] as any[],
        resources: {},
        projectId: "test-project",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = await adapter.getStatus(env);
      expect(result.status).toBe("active");
      expect(result.projectId).toBe("test-project");
    });

    it("should return destroyed status when project is deleted", async () => {
      mockGetProject.mockRejectedValueOnce(new Error("Project not found"));

      const env = {
        name: "test",
        provider: "gcp" as const,
        status: "active" as const,
        services: [],
        resources: {},
        projectId: "test-project",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = await adapter.getStatus(env);
      expect(result.status).toBe("destroyed");
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
