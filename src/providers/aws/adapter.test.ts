import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AwsAdapter } from "./adapter.js";
import { ServiceName } from "../../types/index.js";

vi.mock("@aws-sdk/client-sts", () => ({
  STSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({
      Account: "123456789012",
      Arn: "arn:aws:sts::123456789012:assumed-role/test",
    }),
  })),
  GetCallerIdentityCommand: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  CreateBucketCommand: vi.fn().mockImplementation(() => ({})),
  DeleteBucketCommand: vi.fn().mockImplementation(() => ({})),
  ListObjectsV2Command: vi.fn().mockImplementation(() => ({ Contents: [] })),
  DeleteObjectsCommand: vi.fn().mockImplementation(() => ({})),
}));

describe("AwsAdapter", () => {
  let adapter: AwsAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AwsAdapter();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("init", () => {
    it("should verify credentials and detect account ID", async () => {
      await adapter.init();
      const info = adapter.getAccountInfo();
      expect(info.accountId).toBe("123456789012");
      expect(info.region).toBe("us-east-1");
    });

    it("should respect AWS_DEFAULT_REGION env var", async () => {
      process.env.AWS_DEFAULT_REGION = "eu-west-1";
      const newAdapter = new AwsAdapter();
      await newAdapter.init();
      const info = newAdapter.getAccountInfo();
      expect(info.region).toBe("eu-west-1");
      delete process.env.AWS_DEFAULT_REGION;
    });
  });

  describe("createEnvironment", () => {
    it("should create an environment with S3 bucket", async () => {
      const env = await adapter.createEnvironment("test-env");

      expect(env.name).toBe("test-env");
      expect(env.provider).toBe("aws");
      expect(env.status).toBe("active");
      expect(env.resources.bucketName).toMatch(/^sandman-test-env-/);
    });

    it("should use account ID from init", async () => {
      await adapter.init();
      const env = await adapter.createEnvironment("my-env");
      expect(env.accountId).toBe("123456789012");
    });
  });

  describe("connect", () => {
    it("should return environment variables", async () => {
      const env = {
        name: "test",
        provider: "aws" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { bucketName: "test-bucket" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountId: "123456789012",
        region: "us-east-1",
      };

      const creds = await adapter.connect(env);

      expect(creds.provider).toBe("aws");
      expect(creds.AWS_ACCOUNT_ID).toBe("123456789012");
      expect(creds.AWS_REGION).toBe("us-east-1");
      expect(creds.AWS_S3_BUCKET).toBe("test-bucket");
    });

    it("should work without optional fields", async () => {
      const env = {
        name: "test",
        provider: "aws" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const creds = await adapter.connect(env);

      expect(creds.provider).toBe("aws");
      expect(creds.AWS_ACCOUNT_ID).toBeUndefined();
    });
  });

  describe("destroyEnvironment", () => {
    it("should delete bucket and clean up resources", async () => {
      const env = {
        name: "test",
        provider: "aws" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: { bucketName: "test-bucket" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        region: "us-east-1",
      };

      await expect(adapter.destroyEnvironment(env)).resolves.not.toThrow();
    });

    it("should handle missing bucket gracefully", async () => {
      const env = {
        name: "test",
        provider: "aws" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(adapter.destroyEnvironment(env)).resolves.not.toThrow();
    });
  });

  describe("enableServices", () => {
    it("should log services to enable", async () => {
      const env = {
        name: "test",
        provider: "aws" as const,
        status: "active" as const,
        services: [] as ServiceName[],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const consoleSpy = vi.spyOn(console, "log");
      await adapter.enableServices(env, ["s3", "lambda"] as ServiceName[]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Enabling AWS services: s3, lambda",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getStatus", () => {
    it("should return environment as-is", async () => {
      const env = {
        name: "test",
        provider: "aws" as const,
        status: "active" as const,
        services: ["s3"] as ServiceName[],
        resources: { bucketName: "my-bucket" },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = await adapter.getStatus(env);
      expect(result).toEqual(env);
    });
  });
});
