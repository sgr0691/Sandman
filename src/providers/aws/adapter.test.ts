import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AwsAdapter } from "./adapter.js";
import { ServiceName } from "../../types/index.js";

// Mock IDs for AWS resources
const MOCK_VPC_ID = "vpc-1234567890abcdef0";
const MOCK_SUBNET_ID = "subnet-1234567890abcdef0";
const MOCK_IGW_ID = "igw-1234567890abcdef0";
const MOCK_RT_ID = "rtb-1234567890abcdef0";
const MOCK_INSTANCE_ID = "i-1234567890abcdef0";
const MOCK_ROLE_NAME = "sandman-test-role";
const MOCK_INSTANCE_PROFILE_NAME = "sandman-test-profile";
const MOCK_SG_ID = "sg-1234567890abcdef0";

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

vi.mock("@aws-sdk/client-ec2", () => ({
  EC2Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockImplementation((command: any) => {
      const commandName = command.constructor.name;
      switch (commandName) {
        case "CreateVpcCommand":
          return Promise.resolve({ Vpc: { VpcId: MOCK_VPC_ID } });
        case "CreateSubnetCommand":
          return Promise.resolve({ Subnet: { SubnetId: MOCK_SUBNET_ID } });
        case "CreateInternetGatewayCommand":
          return Promise.resolve({
            InternetGateway: { InternetGatewayId: MOCK_IGW_ID },
          });
        case "AttachInternetGatewayCommand":
          return Promise.resolve({});
        case "CreateRouteTableCommand":
          return Promise.resolve({ RouteTable: { RouteTableId: MOCK_RT_ID } });
        case "CreateRouteCommand":
          return Promise.resolve({});
        case "AssociateRouteTableCommand":
          return Promise.resolve({});
        case "CreateSecurityGroupCommand":
          return Promise.resolve({ GroupId: MOCK_SG_ID });
        case "AuthorizeSecurityGroupIngressCommand":
          return Promise.resolve({});
        case "RunInstancesCommand":
          return Promise.resolve({
            Instances: [{ InstanceId: MOCK_INSTANCE_ID }],
          });
        case "DeleteVpcCommand":
        case "DeleteSubnetCommand":
        case "DeleteInternetGatewayCommand":
        case "DetachInternetGatewayCommand":
        case "DeleteRouteTableCommand":
        case "DeleteSecurityGroupCommand":
        case "TerminateInstancesCommand":
          return Promise.resolve({});
        default:
          return Promise.resolve({});
      }
    }),
  })),
  CreateVpcCommand: vi.fn().mockImplementation(() => ({})),
  CreateSubnetCommand: vi.fn().mockImplementation(() => ({})),
  CreateInternetGatewayCommand: vi.fn().mockImplementation(() => ({})),
  AttachInternetGatewayCommand: vi.fn().mockImplementation(() => ({})),
  CreateRouteTableCommand: vi.fn().mockImplementation(() => ({})),
  CreateRouteCommand: vi.fn().mockImplementation(() => ({})),
  AssociateRouteTableCommand: vi.fn().mockImplementation(() => ({})),
  CreateSecurityGroupCommand: vi.fn().mockImplementation(() => ({})),
  AuthorizeSecurityGroupIngressCommand: vi.fn().mockImplementation(() => ({})),
  RunInstancesCommand: vi.fn().mockImplementation(() => ({})),
  DeleteVpcCommand: vi.fn().mockImplementation(() => ({})),
  DeleteSubnetCommand: vi.fn().mockImplementation(() => ({})),
  DeleteInternetGatewayCommand: vi.fn().mockImplementation(() => ({})),
  DetachInternetGatewayCommand: vi.fn().mockImplementation(() => ({})),
  DeleteRouteTableCommand: vi.fn().mockImplementation(() => ({})),
  DeleteSecurityGroupCommand: vi.fn().mockImplementation(() => ({})),
  TerminateInstancesCommand: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@aws-sdk/client-iam", () => ({
  IAMClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockImplementation((command: any) => {
      const commandName = command.constructor.name;
      switch (commandName) {
        case "CreateRoleCommand":
          return Promise.resolve({
            Role: { Arn: `arn:aws:iam::123456789012:role/${MOCK_ROLE_NAME}` },
          });
        case "AttachRolePolicyCommand":
          return Promise.resolve({});
        case "CreateInstanceProfileCommand":
          return Promise.resolve({
            InstanceProfile: {
              Arn: `arn:aws:iam::123456789012:instance-profile/${MOCK_INSTANCE_PROFILE_NAME}`,
            },
          });
        case "AddRoleToInstanceProfileCommand":
          return Promise.resolve({});
        case "DeleteRoleCommand":
        case "DetachRolePolicyCommand":
        case "DeleteInstanceProfileCommand":
        case "RemoveRoleFromInstanceProfileCommand":
          return Promise.resolve({});
        default:
          return Promise.resolve({});
      }
    }),
  })),
  CreateRoleCommand: vi.fn().mockImplementation(() => ({})),
  AttachRolePolicyCommand: vi.fn().mockImplementation(() => ({})),
  CreateInstanceProfileCommand: vi.fn().mockImplementation(() => ({})),
  AddRoleToInstanceProfileCommand: vi.fn().mockImplementation(() => ({})),
  DeleteRoleCommand: vi.fn().mockImplementation(() => ({})),
  DetachRolePolicyCommand: vi.fn().mockImplementation(() => ({})),
  DeleteInstanceProfileCommand: vi.fn().mockImplementation(() => ({})),
  RemoveRoleFromInstanceProfileCommand: vi.fn().mockImplementation(() => ({})),
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
