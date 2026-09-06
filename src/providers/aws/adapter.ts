import { ProviderAdapter } from "../base.js";
import {
  EnableResult,
  EnvironmentRecord,
  ServiceName,
} from "../../types/index.js";
import { enableResult } from "../enable-result.js";
import { logger } from "../../utils/logger.js";

export class AwsAdapter implements ProviderAdapter {
  private accountId: string | null = null;
  private callerArn: string | null = null;
  private region: string = "us-east-1";
  private regionExplicit = false;

  async init(): Promise<void> {
    try {
      const { STSClient, GetCallerIdentityCommand } =
        await import("@aws-sdk/client-sts");
      const client = new STSClient({});

      const command = new GetCallerIdentityCommand({});
      const response = await client.send(command);

      this.accountId = response.Account || null;
      this.callerArn = response.Arn || null;
      if (!this.regionExplicit) {
        this.region = process.env.AWS_DEFAULT_REGION || "us-east-1";
      }
    } catch (error: any) {
      if (error.name === "CredentialsProviderError") {
        throw new Error(
          'AWS credentials required. Configure with "aws configure"',
        );
      }
      throw error;
    }
  }

  setRegion(region: string): void {
    this.region = region;
    this.regionExplicit = true;
  }

  async createEnvironment(name: string): Promise<EnvironmentRecord> {
    const bucketName = `sandman-${name}-${Date.now()}`;
    const resources: Record<string, string> = {};
    const warnings: string[] = [];

    try {
      const { S3Client, CreateBucketCommand } =
        await import("@aws-sdk/client-s3");
      const s3Client = new S3Client({ region: this.region });

      await s3Client.send(
        new CreateBucketCommand({
          Bucket: bucketName,
        }),
      );

      const {
        PutPublicAccessBlockCommand,
        PutBucketEncryptionCommand,
        PutBucketTaggingCommand,
      } = await import("@aws-sdk/client-s3");
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
      try {
        await s3Client.send(
          new PutBucketTaggingCommand({
            Bucket: bucketName,
            Tagging: {
              TagSet: [
                { Key: "CreatedBy", Value: "sandman" },
                { Key: "Name", Value: `sandman-${name}` },
              ],
            },
          }),
        );
      } catch (error: any) {
        logger.warn(`Could not tag bucket: ${error.message}`);
      }

      resources.bucketName = bucketName;
    } catch (error: any) {
      if (error.name === "BucketAlreadyOwnedByYou") {
        resources.bucketName = bucketName;
      } else {
        warnings.push(`bucket: ${error.message}`);
        logger.warn(`Could not create bucket: ${error.message}`);
      }
    }

    try {
      const vpcResources = await this.createVpcResources(name);
      for (const [key, value] of Object.entries(vpcResources)) {
        if (value) {
          resources[key] = value;
        }
      }
    } catch (error: any) {
      warnings.push(`vpc: ${error.message}`);
      logger.warn(`Could not create VPC: ${error.message}`);
    }

    try {
      const iamResources = await this.createIamResources(name);
      for (const [key, value] of Object.entries(iamResources)) {
        if (value) {
          resources[key] = value;
        }
      }
    } catch (error: any) {
      warnings.push(`iam: ${error.message}`);
      logger.warn(`Could not create IAM role: ${error.message}`);
    }

    try {
      if (resources.vpcId && resources.subnetId && resources.securityGroupId) {
        const instanceId = await this.createEc2Instance(
          name,
          resources.subnetId,
          resources.securityGroupId,
          resources.iamInstanceProfile,
        );
        if (instanceId) {
          resources.instanceId = instanceId;
        }
      }
    } catch (error: any) {
      warnings.push(`ec2: ${error.message}`);
      logger.warn(`Could not create EC2 instance: ${error.message}`);
    }

    const now = new Date().toISOString();
    const hasResources = Object.keys(resources).length > 0;
    if (!hasResources) {
      throw new Error(
        `Failed to create any AWS resources for "${name}"${warnings.length ? `: ${warnings.join("; ")}` : "."}`,
      );
    }

    const complete = Boolean(
      resources.bucketName &&
        resources.vpcId &&
        resources.subnetId &&
        resources.securityGroupId,
    );

    return {
      name,
      provider: "aws",
      accountId: this.accountId || undefined,
      region: this.region,
      status: complete ? "active" : "failed",
      services: [],
      resources,
      createdAt: now,
      updatedAt: now,
      error: complete ? undefined : warnings.join("; ") || "Partial AWS create",
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
      profileResponse.InstanceProfile?.InstanceProfileName ||
      instanceProfileName;

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
    const imageId = await this.resolveAmi();

    const instanceResponse = await ec2Client.send(
      new RunInstancesCommand({
        ImageId: imageId,
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

  private static readonly FALLBACK_AMI = "ami-0c7217cdde317cfec";

  private async resolveAmi(): Promise<string> {
    try {
      const { SSMClient, GetParameterCommand } =
        await import("@aws-sdk/client-ssm");
      const ssm = new SSMClient({ region: this.region });
      const response = await ssm.send(
        new GetParameterCommand({
          Name: "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64",
        }),
      );
      const ami = response.Parameter?.Value;
      if (ami) {
        return ami;
      }
    } catch (error: any) {
      logger.warn(
        `Could not resolve latest AL2023 AMI via SSM (${error.message}); falling back to ${AwsAdapter.FALLBACK_AMI}`,
      );
    }
    return AwsAdapter.FALLBACK_AMI;
  }

  async enableServices(
    env: EnvironmentRecord,
    services: ServiceName[],
  ): Promise<EnableResult> {
    const provisioned: ServiceName[] = [];
    const localOnly: ServiceName[] = [];
    const warnings: string[] = [];

    const alreadyInCloud: Record<string, boolean> = {
      s3: Boolean(env.resources.bucketName),
      ec2: Boolean(env.resources.instanceId),
      iam: Boolean(
        env.resources.iamRoleArn || env.resources.iamInstanceProfile,
      ),
    };

    for (const service of services) {
      if (alreadyInCloud[service]) {
        provisioned.push(service);
        continue;
      }
      localOnly.push(service);
      if (service === "lambda") {
        warnings.push(
          "lambda is not provisioned by sandman enable; recorded locally only.",
        );
      } else if (service === "s3" || service === "ec2" || service === "iam") {
        warnings.push(
          `${service} was not created by sandman create; recorded locally only.`,
        );
      } else {
        warnings.push(
          `${service} is recorded locally only and was not provisioned in AWS.`,
        );
      }
    }

    logger.info(
      `AWS enable recorded ${services.join(", ")} (cloud: ${provisioned.join(", ") || "none"}; local-only: ${localOnly.join(", ") || "none"})`,
    );

    return enableResult({
      recorded: services,
      provisioned,
      localOnly,
      warnings,
    });
  }

  async whoami(): Promise<Record<string, string | null | undefined>> {
    if (!this.accountId) {
      try {
        await this.init();
      } catch {
        // Leave identity empty; doctor will surface AUTH_REQUIRED.
      }
    }
    return {
      provider: "aws",
      accountId: this.accountId,
      region: this.region,
      callerArn: this.callerArn,
    };
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
    await this.assertCallerAccount(env);
    await this.assertSandmanOwnership(env);

    const { EC2Client } = await import("@aws-sdk/client-ec2");
    const ec2Client = new EC2Client({ region: env.region || this.region });
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

    if (env.resources.bucketName) {
      try {
        await this.emptyAndDeleteBucket(
          env.resources.bucketName as string,
          env.region,
        );
        logger.info(`Deleted S3 bucket: ${env.resources.bucketName}`);
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

  private async assertCallerAccount(env: EnvironmentRecord): Promise<void> {
    if (!env.accountId) {
      return;
    }
    const { STSClient, GetCallerIdentityCommand } =
      await import("@aws-sdk/client-sts");
    const sts = new STSClient({ region: env.region || this.region });
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    if (identity.Account && identity.Account !== env.accountId) {
      throw new Error(
        `Refusing to destroy "${env.name}": state account ${env.accountId} does not match caller ${identity.Account}.`,
      );
    }
  }

  private isSandmanOwned(
    tags: { Key?: string; Value?: string }[] | undefined,
    fallbackName?: string,
  ): boolean {
    if (tags?.some((t) => t.Key === "CreatedBy" && t.Value === "sandman")) {
      return true;
    }
    return Boolean(fallbackName?.startsWith("sandman-"));
  }

  private isMissingAwsResource(error: any): boolean {
    const name = error?.name || "";
    const message = error?.message || "";
    return (
      name === "NoSuchBucket" ||
      name === "NotFound" ||
      name === "NoSuchTagSet" ||
      name === "NoSuchEntity" ||
      name === "InvalidInstanceID.NotFound" ||
      name === "InvalidVpcID.NotFound" ||
      name === "InvalidGroup.NotFound" ||
      name === "InvalidSubnetID.NotFound" ||
      name === "InvalidInternetGatewayID.NotFound" ||
      error?.$metadata?.httpStatusCode === 404 ||
      /not found|does not exist/i.test(message)
    );
  }

  private async assertSandmanOwnership(env: EnvironmentRecord): Promise<void> {
    const region = env.region || this.region;
    const { EC2Client } = await import("@aws-sdk/client-ec2");
    const ec2Client = new EC2Client({ region });

    const refuse = (resource: string, id: string) => {
      throw new Error(
        `Refusing to destroy ${resource} ${id}: it is not tagged CreatedBy=sandman and does not use a sandman- name prefix.`,
      );
    };

    if (env.resources.instanceId) {
      try {
        const { DescribeInstancesCommand } = await import("@aws-sdk/client-ec2");
        const described = await ec2Client.send(
          new DescribeInstancesCommand({
            InstanceIds: [env.resources.instanceId as string],
          }),
        );
        const instance = described.Reservations?.[0]?.Instances?.[0];
        const nameTag = instance?.Tags?.find((t) => t.Key === "Name")?.Value;
        if (instance && !this.isSandmanOwned(instance.Tags, nameTag)) {
          refuse("instance", env.resources.instanceId as string);
        }
      } catch (error: any) {
        if (!this.isMissingAwsResource(error)) {
          throw error;
        }
      }
    }

    if (env.resources.vpcId) {
      try {
        const { DescribeVpcsCommand } = await import("@aws-sdk/client-ec2");
        const described = await ec2Client.send(
          new DescribeVpcsCommand({ VpcIds: [env.resources.vpcId as string] }),
        );
        const vpc = described.Vpcs?.[0];
        const nameTag = vpc?.Tags?.find((t) => t.Key === "Name")?.Value;
        if (vpc && !this.isSandmanOwned(vpc.Tags, nameTag)) {
          refuse("vpc", env.resources.vpcId as string);
        }
      } catch (error: any) {
        if (!this.isMissingAwsResource(error)) {
          throw error;
        }
      }
    }

    if (env.resources.bucketName) {
      const bucket = env.resources.bucketName as string;
      try {
        const { S3Client, GetBucketTaggingCommand } =
          await import("@aws-sdk/client-s3");
        const s3 = new S3Client({ region });
        const tagging = await s3.send(
          new GetBucketTaggingCommand({ Bucket: bucket }),
        );
        if (!this.isSandmanOwned(tagging.TagSet, bucket)) {
          refuse("bucket", bucket);
        }
      } catch (error: any) {
        if (error.name !== "NoSuchBucket" && !bucket.startsWith("sandman-")) {
          refuse("bucket", bucket);
        }
      }
    }

    if (env.resources.iamInstanceProfile) {
      const profile = String(env.resources.iamInstanceProfile);
      if (!profile.startsWith("sandman-")) {
        refuse("iam instance profile", profile);
      }
    }
  }

  private async emptyAndDeleteBucket(
    bucket: string,
    region?: string,
  ): Promise<void> {
    const {
      S3Client,
      DeleteBucketCommand,
      ListObjectsV2Command,
      ListObjectVersionsCommand,
      DeleteObjectsCommand,
    } = await import("@aws-sdk/client-s3");
    const s3Client = new S3Client({ region });

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

    let keyMarker: string | undefined;
    let versionIdMarker: string | undefined;
    do {
      const versions = await s3Client.send(
        new ListObjectVersionsCommand({
          Bucket: bucket,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
        }),
      );
      const objects = [
        ...(versions.Versions ?? []).map((v) => ({
          Key: v.Key!,
          VersionId: v.VersionId,
        })),
        ...(versions.DeleteMarkers ?? []).map((m) => ({
          Key: m.Key!,
          VersionId: m.VersionId,
        })),
      ];
      if (objects.length) {
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objects },
          }),
        );
      }
      keyMarker = versions.IsTruncated ? versions.NextKeyMarker : undefined;
      versionIdMarker = versions.IsTruncated
        ? versions.NextVersionIdMarker
        : undefined;
    } while (keyMarker);

    await s3Client.send(
      new DeleteBucketCommand({
        Bucket: bucket,
      }),
    );
  }

  async getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord> {
    const region = env.region || this.region;
    const missing: string[] = [];
    const unhealthy: string[] = [];

    if (env.resources.bucketName) {
      const bucket = env.resources.bucketName as string;
      try {
        const { S3Client, HeadBucketCommand } =
          await import("@aws-sdk/client-s3");
        const s3 = new S3Client({ region });
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch (error: any) {
        if (this.isMissingAwsResource(error)) {
          missing.push(`bucket ${bucket}`);
        } else {
          unhealthy.push(`bucket ${bucket}: ${error.message}`);
        }
      }
    }

    if (env.resources.instanceId) {
      const instanceId = env.resources.instanceId as string;
      try {
        const { EC2Client, DescribeInstancesCommand } =
          await import("@aws-sdk/client-ec2");
        const ec2 = new EC2Client({ region });
        const described = await ec2.send(
          new DescribeInstancesCommand({ InstanceIds: [instanceId] }),
        );
        const instance = described.Reservations?.[0]?.Instances?.[0];
        const state = instance?.State?.Name;
        if (!instance || state === "terminated" || state === "shutting-down") {
          missing.push(`instance ${instanceId}`);
        } else if (state && state !== "running" && state !== "pending") {
          unhealthy.push(`instance ${instanceId} is ${state}`);
        }
      } catch (error: any) {
        if (this.isMissingAwsResource(error)) {
          missing.push(`instance ${instanceId}`);
        } else {
          unhealthy.push(`instance ${instanceId}: ${error.message}`);
        }
      }
    }

    const tracked =
      Boolean(env.resources.bucketName) || Boolean(env.resources.instanceId);
    if (!tracked) {
      return env;
    }

    const now = new Date().toISOString();
    if (missing.length > 0 && unhealthy.length === 0) {
      const allGone =
        (!env.resources.bucketName ||
          missing.some((m) => m.startsWith("bucket "))) &&
        (!env.resources.instanceId ||
          missing.some((m) => m.startsWith("instance ")));
      return {
        ...env,
        status: allGone ? "destroyed" : "failed",
        error: `Cloud resources missing: ${missing.join("; ")}`,
        updatedAt: now,
      };
    }
    if (missing.length > 0 || unhealthy.length > 0) {
      return {
        ...env,
        status: "failed",
        error: [...missing.map((m) => `missing ${m}`), ...unhealthy].join("; "),
        updatedAt: now,
      };
    }

    return {
      ...env,
      status: "active",
      error: undefined,
      updatedAt: now,
    };
  }

  getAccountInfo(): { accountId: string | null; region: string } {
    return {
      accountId: this.accountId,
      region: this.region,
    };
  }
}
