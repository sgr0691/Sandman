import { ProviderAdapter } from "../base.js";
import { EnvironmentRecord, ServiceName } from "../../types/index.js";
import { logger } from "../../utils/logger.js";

export class AwsAdapter implements ProviderAdapter {
  private accountId: string | null = null;
  private region: string = "us-east-1";

  async init(): Promise<void> {
    try {
      const { STSClient, GetCallerIdentityCommand } =
        await import("@aws-sdk/client-sts");
      const client = new STSClient({});

      const command = new GetCallerIdentityCommand({});
      const response = await client.send(command);

      this.accountId = response.Account || null;
      this.region = process.env.AWS_DEFAULT_REGION || "us-east-1";
    } catch (error: any) {
      if (error.name === "CredentialsProviderError") {
        throw new Error(
          'AWS credentials required. Configure with "aws configure"',
        );
      }
      throw error;
    }
  }

  async createEnvironment(name: string): Promise<EnvironmentRecord> {
    const bucketName = `sandman-${name}-${Date.now()}`;
    const resources: Record<string, string> = {};

    try {
      // Create S3 bucket
      const { S3Client, CreateBucketCommand } =
        await import("@aws-sdk/client-s3");
      const s3Client = new S3Client({ region: this.region });

      await s3Client.send(
        new CreateBucketCommand({
          Bucket: bucketName,
        }),
      );

      const { PutPublicAccessBlockCommand, PutBucketEncryptionCommand } =
        await import("@aws-sdk/client-s3");
      await s3Client.send(
        new PutPublicAccessBlockCommand({
          Bucket: bucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        }),
      );
      await s3Client.send(
        new PutBucketEncryptionCommand({
          Bucket: bucketName,
          ServerSideEncryptionConfiguration: {
            Rules: [
              {
                ApplyServerSideEncryptionByDefault: {
                  SSEAlgorithm: "AES256",
                },
                BucketKeyEnabled: true,
              },
            ],
          },
        }),
      );

      resources.bucketName = bucketName;
    } catch (error: any) {
      if (error.name !== "BucketAlreadyOwnedByYou") {
        logger.warn(`Could not create bucket: ${error.message}`);
      }
    }

    // Create VPC and networking
    try {
      const vpcResources = await this.createVpcResources(name);
      Object.assign(resources, vpcResources);
    } catch (error: any) {
      logger.warn(`Could not create VPC: ${error.message}`);
    }

    // Create IAM role
    try {
      const iamResources = await this.createIamResources(name);
      Object.assign(resources, iamResources);
    } catch (error: any) {
      logger.warn(`Could not create IAM role: ${error.message}`);
    }

    // Create EC2 instance
    try {
      if (resources.vpcId && resources.subnetId && resources.securityGroupId) {
        const instanceId = await this.createEc2Instance(
          name,
          resources.subnetId,
          resources.securityGroupId,
          resources.iamInstanceProfile,
        );
        resources.instanceId = instanceId;
      }
    } catch (error: any) {
      logger.warn(`Could not create EC2 instance: ${error.message}`);
    }

    const now = new Date().toISOString();
    return {
      name,
      provider: "aws",
      accountId: this.accountId || undefined,
      region: this.region,
      status: "active",
      services: [],
      resources,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async createVpcResources(
    name: string,
  ): Promise<Record<string, string>> {
    const { EC2Client } = await import("@aws-sdk/client-ec2");
    const ec2Client = new EC2Client({ region: this.region });

    const resources: Record<string, string> = {};

    // Create VPC
    const { CreateVpcCommand } = await import("@aws-sdk/client-ec2");
    const vpcResponse = await ec2Client.send(
      new CreateVpcCommand({
        CidrBlock: "10.0.0.0/16",
        TagSpecifications: [
          {
            ResourceType: "vpc",
            Tags: [
              { Key: "Name", Value: `sandman-${name}` },
              { Key: "CreatedBy", Value: "sandman" },
            ],
          },
        ],
      }),
    );
    resources.vpcId = vpcResponse.Vpc?.VpcId || "";

    // Create Internet Gateway
    const { CreateInternetGatewayCommand, AttachInternetGatewayCommand } =
      await import("@aws-sdk/client-ec2");
    const igwResponse = await ec2Client.send(
      new CreateInternetGatewayCommand({
        TagSpecifications: [
          {
            ResourceType: "internet-gateway",
            Tags: [
              { Key: "Name", Value: `sandman-${name}` },
              { Key: "CreatedBy", Value: "sandman" },
            ],
          },
        ],
      }),
    );
    resources.internetGatewayId =
      igwResponse.InternetGateway?.InternetGatewayId || "";

    // Attach Internet Gateway to VPC
    await ec2Client.send(
      new AttachInternetGatewayCommand({
        InternetGatewayId: resources.internetGatewayId,
        VpcId: resources.vpcId,
      }),
    );

    // Create Subnet
    const { CreateSubnetCommand } = await import("@aws-sdk/client-ec2");
    const subnetResponse = await ec2Client.send(
      new CreateSubnetCommand({
        VpcId: resources.vpcId,
        CidrBlock: "10.0.1.0/24",
        TagSpecifications: [
          {
            ResourceType: "subnet",
            Tags: [
              { Key: "Name", Value: `sandman-${name}` },
              { Key: "CreatedBy", Value: "sandman" },
            ],
          },
        ],
      }),
    );
    resources.subnetId = subnetResponse.Subnet?.SubnetId || "";

    // Create Route Table
    const {
      CreateRouteTableCommand,
      CreateRouteCommand,
      AssociateRouteTableCommand,
    } = await import("@aws-sdk/client-ec2");
    const rtResponse = await ec2Client.send(
      new CreateRouteTableCommand({
        VpcId: resources.vpcId,
        TagSpecifications: [
          {
            ResourceType: "route-table",
            Tags: [
              { Key: "Name", Value: `sandman-${name}` },
              { Key: "CreatedBy", Value: "sandman" },
            ],
          },
        ],
      }),
    );
    resources.routeTableId = rtResponse.RouteTable?.RouteTableId || "";

    // Create route to Internet Gateway
    await ec2Client.send(
      new CreateRouteCommand({
        RouteTableId: resources.routeTableId,
        DestinationCidrBlock: "0.0.0.0/0",
        GatewayId: resources.internetGatewayId,
      }),
    );

    // Associate Route Table with Subnet
    await ec2Client.send(
      new AssociateRouteTableCommand({
        RouteTableId: resources.routeTableId,
        SubnetId: resources.subnetId,
      }),
    );

    // Create Security Group
    const { CreateSecurityGroupCommand, AuthorizeSecurityGroupIngressCommand } =
      await import("@aws-sdk/client-ec2");
    const sgResponse = await ec2Client.send(
      new CreateSecurityGroupCommand({
        GroupName: `sandman-${name}-sg`,
        Description: "Security group for Sandman environment",
        VpcId: resources.vpcId,
        TagSpecifications: [
          {
            ResourceType: "security-group",
            Tags: [
              { Key: "Name", Value: `sandman-${name}` },
              { Key: "CreatedBy", Value: "sandman" },
            ],
          },
        ],
      }),
    );
    resources.securityGroupId = sgResponse.GroupId || "";

    // HTTP/HTTPS for demos. SSH is not opened to the internet; use SSM
    // (AmazonSSMManagedInstanceCore is attached to the instance role).
    await ec2Client.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: resources.securityGroupId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 80,
            ToPort: 80,
            IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "HTTP" }],
          },
          {
            IpProtocol: "tcp",
            FromPort: 443,
            ToPort: 443,
            IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "HTTPS" }],
          },
        ],
      }),
    );

    return resources;
  }

  private async createIamResources(
    name: string,
  ): Promise<Record<string, string>> {
    const { IAMClient } = await import("@aws-sdk/client-iam");
    const iamClient = new IAMClient({ region: this.region });

    const resources: Record<string, string> = {};

    // Create IAM Role
    const {
      CreateRoleCommand,
      AttachRolePolicyCommand,
      CreateInstanceProfileCommand,
      AddRoleToInstanceProfileCommand,
    } = await import("@aws-sdk/client-iam");

    const roleName = `sandman-${name}-role`;
    const trustPolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Service: "ec2.amazonaws.com",
          },
          Action: "sts:AssumeRole",
        },
      ],
    };

    const roleResponse = await iamClient.send(
      new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        Tags: [
          { Key: "Name", Value: `sandman-${name}` },
          { Key: "CreatedBy", Value: "sandman" },
        ],
      }),
    );
    resources.iamRoleArn = roleResponse.Role?.Arn || "";

    // Attach AmazonSSMManagedInstanceCore policy
    await iamClient.send(
      new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
      }),
    );

    // Create Instance Profile
    const instanceProfileName = `sandman-${name}-profile`;
    const profileResponse = await iamClient.send(
      new CreateInstanceProfileCommand({
        InstanceProfileName: instanceProfileName,
      }),
    );
    resources.iamInstanceProfile =
      profileResponse.InstanceProfile?.InstanceProfileName || "";

    // Add role to instance profile
    await iamClient.send(
      new AddRoleToInstanceProfileCommand({
        InstanceProfileName: instanceProfileName,
        RoleName: roleName,
      }),
    );

    return resources;
  }

  private async createEc2Instance(
    name: string,
    subnetId: string,
    securityGroupId: string,
    iamInstanceProfile?: string,
  ): Promise<string> {
    const { EC2Client, RunInstancesCommand } =
      await import("@aws-sdk/client-ec2");
    const ec2Client = new EC2Client({ region: this.region });

    const instanceResponse = await ec2Client.send(
      new RunInstancesCommand({
        ImageId: "ami-0c7217cdde317cfec", // Amazon Linux 2023
        InstanceType: "t2.micro",
        MinCount: 1,
        MaxCount: 1,
        SubnetId: subnetId,
        SecurityGroupIds: [securityGroupId],
        IamInstanceProfile: iamInstanceProfile
          ? { Name: iamInstanceProfile }
          : undefined,
        TagSpecifications: [
          {
            ResourceType: "instance",
            Tags: [
              { Key: "Name", Value: `sandman-${name}` },
              { Key: "CreatedBy", Value: "sandman" },
            ],
          },
        ],
      }),
    );

    return instanceResponse.Instances?.[0]?.InstanceId || "";
  }

  async enableServices(
    env: EnvironmentRecord,
    services: ServiceName[],
  ): Promise<void> {
    logger.info(`Enabling AWS services: ${services.join(", ")}`);
  }

  async connect(env: EnvironmentRecord): Promise<Record<string, string>> {
    const result: Record<string, string> = {
      provider: "aws",
    };

    if (env.accountId) {
      result.AWS_ACCOUNT_ID = env.accountId;
    }
    if (env.region) {
      result.AWS_REGION = env.region;
    }
    if (env.resources.bucketName) {
      result.AWS_S3_BUCKET = env.resources.bucketName as string;
    }
    if (env.resources.vpcId) {
      result.AWS_VPC_ID = env.resources.vpcId as string;
    }
    if (env.resources.instanceId) {
      result.AWS_INSTANCE_ID = env.resources.instanceId as string;
    }
    if (env.resources.iamRoleArn) {
      result.AWS_IAM_ROLE_ARN = env.resources.iamRoleArn as string;
    }

    return result;
  }

  async destroyEnvironment(env: EnvironmentRecord): Promise<void> {
    const { EC2Client } = await import("@aws-sdk/client-ec2");
    const ec2Client = new EC2Client({ region: env.region });
    const failures: string[] = [];

    // Terminate EC2 instance
    if (env.resources.instanceId) {
      try {
        const { TerminateInstancesCommand, waitUntilInstanceTerminated } =
          await import("@aws-sdk/client-ec2");
        await ec2Client.send(
          new TerminateInstancesCommand({
            InstanceIds: [env.resources.instanceId as string],
          }),
        );
        if (typeof waitUntilInstanceTerminated === "function") {
          await waitUntilInstanceTerminated(
            { client: ec2Client, maxWaitTime: 60 },
            { InstanceIds: [env.resources.instanceId as string] },
          );
        }
        logger.info(`Terminated EC2 instance: ${env.resources.instanceId}`);
      } catch (error: any) {
        failures.push(`instance: ${error.message}`);
      }
    }

    // Delete S3 bucket (paginate so leftover objects cannot block delete)
    if (env.resources.bucketName) {
      try {
        const {
          S3Client,
          DeleteBucketCommand,
          ListObjectsV2Command,
          DeleteObjectsCommand,
        } = await import("@aws-sdk/client-s3");
        const s3Client = new S3Client({ region: env.region });
        const bucket = env.resources.bucketName as string;

        let token: string | undefined;
        do {
          const listResponse = await s3Client.send(
            new ListObjectsV2Command({
              Bucket: bucket,
              ContinuationToken: token,
            }),
          );

          if (listResponse.Contents?.length) {
            await s3Client.send(
              new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: {
                  Objects: listResponse.Contents.map((obj) => ({
                    Key: obj.Key!,
                  })),
                },
              }),
            );
          }

          token = listResponse.IsTruncated
            ? listResponse.NextContinuationToken
            : undefined;
        } while (token);

        await s3Client.send(
          new DeleteBucketCommand({
            Bucket: bucket,
          }),
        );
        logger.info(`Deleted S3 bucket: ${bucket}`);
      } catch (error: any) {
        if (error.name !== "NoSuchBucket") {
          failures.push(`bucket: ${error.message}`);
        }
      }
    }

    // Delete IAM resources
    if (env.resources.iamInstanceProfile) {
      try {
        const {
          IAMClient,
          RemoveRoleFromInstanceProfileCommand,
          DeleteInstanceProfileCommand,
          DetachRolePolicyCommand,
          DeleteRoleCommand,
        } = await import("@aws-sdk/client-iam");
        const iamClient = new IAMClient({ region: env.region });

        const roleName = `sandman-${env.name}-role`;
        const instanceProfileName = env.resources.iamInstanceProfile as string;

        await iamClient.send(
          new RemoveRoleFromInstanceProfileCommand({
            InstanceProfileName: instanceProfileName,
            RoleName: roleName,
          }),
        );

        await iamClient.send(
          new DeleteInstanceProfileCommand({
            InstanceProfileName: instanceProfileName,
          }),
        );

        await iamClient.send(
          new DetachRolePolicyCommand({
            RoleName: roleName,
            PolicyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
          }),
        );

        await iamClient.send(
          new DeleteRoleCommand({
            RoleName: roleName,
          }),
        );
        logger.info(`Deleted IAM role and instance profile for: ${env.name}`);
      } catch (error: any) {
        failures.push(`iam: ${error.message}`);
      }
    }

    // Delete VPC resources
    if (env.resources.vpcId) {
      try {
        const {
          DeleteSecurityGroupCommand,
          DeleteRouteTableCommand,
          DeleteSubnetCommand,
          DetachInternetGatewayCommand,
          DeleteInternetGatewayCommand,
          DeleteVpcCommand,
        } = await import("@aws-sdk/client-ec2");

        if (env.resources.securityGroupId) {
          await ec2Client.send(
            new DeleteSecurityGroupCommand({
              GroupId: env.resources.securityGroupId as string,
            }),
          );
        }

        if (env.resources.routeTableId) {
          await ec2Client.send(
            new DeleteRouteTableCommand({
              RouteTableId: env.resources.routeTableId as string,
            }),
          );
        }

        if (env.resources.subnetId) {
          await ec2Client.send(
            new DeleteSubnetCommand({
              SubnetId: env.resources.subnetId as string,
            }),
          );
        }

        if (env.resources.internetGatewayId) {
          await ec2Client.send(
            new DetachInternetGatewayCommand({
              InternetGatewayId: env.resources.internetGatewayId as string,
              VpcId: env.resources.vpcId as string,
            }),
          );
          await ec2Client.send(
            new DeleteInternetGatewayCommand({
              InternetGatewayId: env.resources.internetGatewayId as string,
            }),
          );
        }

        await ec2Client.send(
          new DeleteVpcCommand({
            VpcId: env.resources.vpcId as string,
          }),
        );
        logger.info(`Deleted VPC and associated resources for: ${env.name}`);
      } catch (error: any) {
        failures.push(`vpc: ${error.message}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Failed to fully destroy environment "${env.name}": ${failures.join("; ")}. Local state was not updated — retry destroy after resolving these errors.`,
      );
    }
  }

  async getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord> {
    return env;
  }

  getAccountInfo(): { accountId: string | null; region: string } {
    return {
      accountId: this.accountId,
      region: this.region,
    };
  }
}
