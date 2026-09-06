import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EnvironmentRecord } from "../../types/index.js";

const {
  named,
  s3Send,
  ec2Send,
  iamSend,
  stsSend,
  ssmSend,
} = vi.hoisted(() => {
  function named(name: string) {
    const Cmd = class {
      input?: unknown;
      constructor(input?: unknown) {
        this.input = input;
      }
    };
    Object.defineProperty(Cmd, "name", { value: name });
    return Cmd;
  }

  return {
    named,
    s3Send: vi.fn(),
    ec2Send: vi.fn(),
    iamSend: vi.fn(),
    stsSend: vi.fn(),
    ssmSend: vi.fn(),
  };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
  CreateBucketCommand: named("CreateBucketCommand"),
  DeleteBucketCommand: named("DeleteBucketCommand"),
  PutPublicAccessBlockCommand: named("PutPublicAccessBlockCommand"),
  PutBucketEncryptionCommand: named("PutBucketEncryptionCommand"),
  PutBucketTaggingCommand: named("PutBucketTaggingCommand"),
  GetBucketTaggingCommand: named("GetBucketTaggingCommand"),
  HeadBucketCommand: named("HeadBucketCommand"),
  ListObjectsV2Command: named("ListObjectsV2Command"),
  ListObjectVersionsCommand: named("ListObjectVersionsCommand"),
  DeleteObjectsCommand: named("DeleteObjectsCommand"),
}));

vi.mock("@aws-sdk/client-ec2", () => ({
  EC2Client: vi.fn().mockImplementation(() => ({ send: ec2Send })),
  RunInstancesCommand: named("RunInstancesCommand"),
  TerminateInstancesCommand: named("TerminateInstancesCommand"),
  CreateVpcCommand: named("CreateVpcCommand"),
  DeleteVpcCommand: named("DeleteVpcCommand"),
  CreateSubnetCommand: named("CreateSubnetCommand"),
  DeleteSubnetCommand: named("DeleteSubnetCommand"),
  CreateInternetGatewayCommand: named("CreateInternetGatewayCommand"),
  AttachInternetGatewayCommand: named("AttachInternetGatewayCommand"),
  DetachInternetGatewayCommand: named("DetachInternetGatewayCommand"),
  DeleteInternetGatewayCommand: named("DeleteInternetGatewayCommand"),
  CreateRouteTableCommand: named("CreateRouteTableCommand"),
  CreateRouteCommand: named("CreateRouteCommand"),
  AssociateRouteTableCommand: named("AssociateRouteTableCommand"),
  DeleteRouteTableCommand: named("DeleteRouteTableCommand"),
  CreateSecurityGroupCommand: named("CreateSecurityGroupCommand"),
  AuthorizeSecurityGroupIngressCommand: named(
    "AuthorizeSecurityGroupIngressCommand",
  ),
  DeleteSecurityGroupCommand: named("DeleteSecurityGroupCommand"),
  DescribeInstancesCommand: named("DescribeInstancesCommand"),
  DescribeVpcsCommand: named("DescribeVpcsCommand"),
  DescribeSecurityGroupsCommand: named("DescribeSecurityGroupsCommand"),
  DescribeSubnetsCommand: named("DescribeSubnetsCommand"),
  DescribeInternetGatewaysCommand: named("DescribeInternetGatewaysCommand"),
  DescribeRouteTablesCommand: named("DescribeRouteTablesCommand"),
  waitUntilInstanceTerminated: vi.fn(),
}));

vi.mock("@aws-sdk/client-iam", () => ({
  IAMClient: vi.fn().mockImplementation(() => ({ send: iamSend })),
  CreateRoleCommand: named("CreateRoleCommand"),
  DeleteRoleCommand: named("DeleteRoleCommand"),
  AttachRolePolicyCommand: named("AttachRolePolicyCommand"),
  DetachRolePolicyCommand: named("DetachRolePolicyCommand"),
  CreateInstanceProfileCommand: named("CreateInstanceProfileCommand"),
  AddRoleToInstanceProfileCommand: named("AddRoleToInstanceProfileCommand"),
  RemoveRoleFromInstanceProfileCommand: named(
    "RemoveRoleFromInstanceProfileCommand",
  ),
  DeleteInstanceProfileCommand: named("DeleteInstanceProfileCommand"),
}));

vi.mock("@aws-sdk/client-sts", () => ({
  STSClient: vi.fn().mockImplementation(() => ({ send: stsSend })),
  GetCallerIdentityCommand: named("GetCallerIdentityCommand"),
}));

vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: vi.fn().mockImplementation(() => ({ send: ssmSend })),
  GetParameterCommand: named("GetParameterCommand"),
}));

vi.mock("@aws-sdk/credential-providers", () => ({
  fromIni: vi.fn().mockReturnValue({}),
}));

import { AwsAdapter } from "./adapter.js";

const sandmanTagSet = [{ Key: "CreatedBy", Value: "sandman" }];

function mockHappyPath(): void {
  s3Send.mockImplementation(async (command: { constructor: { name: string } }) => {
    switch (command.constructor.name) {
      case "CreateBucketCommand":
        return { Location: "/test-bucket" };
      case "ListObjectsV2Command":
        return { Contents: [], IsTruncated: false };
      case "ListObjectVersionsCommand":
        return { Versions: [], DeleteMarkers: [], IsTruncated: false };
      case "GetBucketTaggingCommand":
        return { TagSet: sandmanTagSet };
      default:
        return {};
    }
  });

  ec2Send.mockImplementation(async (command: { constructor: { name: string } }) => {
    switch (command.constructor.name) {
      case "CreateVpcCommand":
        return { Vpc: { VpcId: "vpc-1234" } };
      case "CreateSubnetCommand":
        return { Subnet: { SubnetId: "subnet-1234" } };
      case "CreateInternetGatewayCommand":
        return { InternetGateway: { InternetGatewayId: "igw-1234" } };
      case "CreateRouteTableCommand":
        return { RouteTable: { RouteTableId: "rtb-1234" } };
      case "CreateSecurityGroupCommand":
        return { GroupId: "sg-1234" };
      case "RunInstancesCommand":
        return { Instances: [{ InstanceId: "i-1234" }] };
      case "DescribeVpcsCommand":
        return { Vpcs: [{ Tags: sandmanTagSet }] };
      case "DescribeInstancesCommand":
        return {
          Reservations: [{ Instances: [{ Tags: sandmanTagSet }] }],
        };
      default:
        return {};
    }
  });

  iamSend.mockImplementation(
    async (command: { constructor: { name: string }; input?: { InstanceProfileName?: string } }) => {
      switch (command.constructor.name) {
        case "CreateRoleCommand":
          return { Role: { Arn: "arn:aws:iam::123456789012:role/test" } };
        case "CreateInstanceProfileCommand":
          return {
            InstanceProfile: {
              Arn: "arn:aws:iam::123456789012:instance-profile/test",
              InstanceProfileName:
                command.input?.InstanceProfileName || "sandman-profile",
            },
          };
        default:
          return {};
      }
    },
  );

  stsSend.mockResolvedValue({ Account: "123456789012" });
  ssmSend.mockResolvedValue({ Parameter: { Value: "ami-ssm-resolved" } });
}

describe("AwsAdapter", () => {
  let adapter: AwsAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHappyPath();
    adapter = new AwsAdapter();
  });

  describe("init", () => {
    it("should detect AWS account ID", async () => {
      await adapter.init();
      expect(stsSend).toHaveBeenCalled();
    });

    it("should keep an explicit CLI region after init", async () => {
      adapter.setRegion("eu-west-1");
      await adapter.init();
      const env = await adapter.createEnvironment("keep-region");
      expect(env.region).toBe("eu-west-1");
    });
  });

  describe("createEnvironment", () => {
    it("should create environment with S3, EC2, VPC, and IAM resources", async () => {
      const env = await adapter.createEnvironment("test-env");

      expect(env.name).toBe("test-env");
      expect(env.provider).toBe("aws");
      expect(env.status).toBe("active");
      expect(Object.keys(env.resources).length).toBeGreaterThan(0);
      expect(env.resources.vpcId).toBe("vpc-1234");
      expect(env.resources.instanceId).toBe("i-1234");
      expect(env.resources.iamInstanceProfile).toMatch(/^sandman-test-env-/);
    });

    it("should include S3 bucket in resources", async () => {
      const env = await adapter.createEnvironment("test-env");
      expect(env.resources.bucketName).toMatch(/^sandman-test-env-/);
    });

    it("should resolve AMI from SSM", async () => {
      await adapter.createEnvironment("ami-env");
      expect(ssmSend).toHaveBeenCalled();
      const runCall = ec2Send.mock.calls.find(
        (c) =>
          (c[0] as { constructor: { name: string } }).constructor.name ===
          "RunInstancesCommand",
      );
      expect(
        (runCall?.[0] as { input?: { ImageId?: string } }).input?.ImageId,
      ).toBe("ami-ssm-resolved");
    });

    it("should fall back to a hardcoded AMI when SSM fails", async () => {
      ssmSend.mockRejectedValue(new Error("Parameter not found"));
      await adapter.createEnvironment("ami-fallback");
      const runCall = ec2Send.mock.calls.find(
        (c) =>
          (c[0] as { constructor: { name: string } }).constructor.name ===
          "RunInstancesCommand",
      );
      expect(
        (runCall?.[0] as { input?: { ImageId?: string } }).input?.ImageId,
      ).toBe("ami-0c7217cdde317cfec");
    });

    it("should return failed and keep partial IDs when VPC create fails", async () => {
      ec2Send.mockImplementation(
        async (command: { constructor: { name: string } }) => {
          if (command.constructor.name === "CreateVpcCommand") {
            throw new Error("VpcLimitExceeded");
          }
          return {};
        },
      );

      const env = await adapter.createEnvironment("partial-env");
      expect(env.status).toBe("failed");
      expect(env.error).toMatch(/vpc:/i);
      expect(env.resources.bucketName).toMatch(/^sandman-partial-env-/);
      expect(env.resources.vpcId).toBeUndefined();
    });

    it("should throw when no cloud resources were created", async () => {
      s3Send.mockRejectedValue(new Error("AccessDenied"));
      ec2Send.mockRejectedValue(new Error("Unauthorized"));
      iamSend.mockRejectedValue(new Error("AccessDenied"));

      await expect(adapter.createEnvironment("empty-env")).rejects.toThrow(
        /any AWS resources/,
      );
    });
  });

  describe("destroyEnvironment", () => {
    function makeEnv(overrides: Partial<EnvironmentRecord> = {}): EnvironmentRecord {
      return {
        name: "test-env",
        provider: "aws",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        region: "us-east-1",
        services: [],
        resources: {
          bucketName: "sandman-test-env-123",
          instanceId: "i-1234",
          vpcId: "vpc-1234",
          subnetId: "subnet-1234",
          internetGatewayId: "igw-1234",
          routeTableId: "rtb-1234",
          securityGroupId: "sg-1234",
          iamInstanceProfile: "sandman-test-env-profile",
        },
        accountId: "123456789012",
        ...overrides,
      };
    }

    it("should destroy all resources without throwing", async () => {
      await expect(adapter.destroyEnvironment(makeEnv())).resolves.not.toThrow();
    });

    it("should refuse destroy when STS account does not match", async () => {
      await expect(
        adapter.destroyEnvironment(makeEnv({ accountId: "999999999999" })),
      ).rejects.toThrow(/does not match caller/);
    });

    it("should refuse destroy of untagged resources that are not sandman-prefixed", async () => {
      ec2Send.mockImplementation(
        async (command: { constructor: { name: string } }) => {
          if (command.constructor.name === "DescribeInstancesCommand") {
            return {
              Reservations: [
                {
                  Instances: [
                    { Tags: [{ Key: "CreatedBy", Value: "someone-else" }] },
                  ],
                },
              ],
            };
          }
          return {};
        },
      );

      await expect(
        adapter.destroyEnvironment(
          makeEnv({
            resources: { instanceId: "i-foreign" },
            accountId: undefined,
          }),
        ),
      ).rejects.toThrow(/Refusing to destroy/);
    });

    it("should delete object versions and delete markers before removing a bucket", async () => {
      s3Send.mockImplementation(
        async (command: { constructor: { name: string } }) => {
          switch (command.constructor.name) {
            case "GetBucketTaggingCommand":
              return { TagSet: sandmanTagSet };
            case "ListObjectsV2Command":
              return { Contents: [], IsTruncated: false };
            case "ListObjectVersionsCommand":
              return {
                Versions: [{ Key: "a.txt", VersionId: "v1" }],
                DeleteMarkers: [{ Key: "b.txt", VersionId: "d1" }],
                IsTruncated: false,
              };
            default:
              return {};
          }
        },
      );

      await adapter.destroyEnvironment(
        makeEnv({
          resources: { bucketName: "sandman-test-env-123" },
        }),
      );

      const deleteObjects = s3Send.mock.calls.find(
        (c) =>
          (c[0] as { constructor: { name: string } }).constructor.name ===
          "DeleteObjectsCommand",
      );
      expect(deleteObjects).toBeDefined();
      const input = (
        deleteObjects?.[0] as {
          input?: { Delete?: { Objects?: unknown[] } };
        }
      ).input;
      expect(input?.Delete?.Objects).toHaveLength(2);
      expect(
        s3Send.mock.calls.some(
          (c) =>
            (c[0] as { constructor: { name: string } }).constructor.name ===
            "DeleteBucketCommand",
        ),
      ).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("should return the environment as-is", async () => {
      const env: EnvironmentRecord = {
        name: "test",
        provider: "aws",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        region: "us-east-1",
        services: [],
        resources: {},
      };
      const result = await adapter.getStatus(env);
      expect(result).toEqual(env);
    });
  });
});
