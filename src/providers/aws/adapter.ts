import { ProviderAdapter, AWS_SERVICES } from '../base.js';
import { EnvironmentRecord, ServiceName } from '../../types/index.js';

export class AwsAdapter implements ProviderAdapter {
  private accountId: string | null = null;
  private region: string = 'us-east-1';

  async init(): Promise<void> {
    try {
      const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
      const client = new STSClient({});
      
      const command = new GetCallerIdentityCommand({});
      const response = await client.send(command);
      
      this.accountId = response.Account || null;
      this.region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
    } catch (error: any) {
      if (error.name === 'CredentialsProviderError') {
        throw new Error('AWS credentials required. Configure with "aws configure"');
      }
      throw error;
    }
  }

  async createEnvironment(name: string): Promise<EnvironmentRecord> {
    const bucketName = `sandman-${name}-${Date.now()}`;
    
    try {
      const { S3Client, CreateBucketCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({ region: this.region });
      
        await client.send(new CreateBucketCommand({
        Bucket: bucketName,
      }));
    } catch (error: any) {
      if (error.name !== 'BucketAlreadyOwnedByYou') {
        console.warn('Could not create bucket:', error.message);
      }
    }

    const now = new Date().toISOString();
    return {
      name,
      provider: 'aws',
      accountId: this.accountId || undefined,
      region: this.region,
      status: 'active',
      services: [],
      resources: {
        bucketName,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  async enableServices(env: EnvironmentRecord, services: ServiceName[]): Promise<void> {
    console.log(`Enabling AWS services: ${services.join(', ')}`);
  }

  async connect(env: EnvironmentRecord): Promise<Record<string, string>> {
    const result: Record<string, string> = {
      provider: 'aws',
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

    return result;
  }

  async destroyEnvironment(env: EnvironmentRecord): Promise<void> {
    if (env.resources.bucketName) {
      try {
        const { S3Client, DeleteBucketCommand, ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
        const client = new S3Client({ region: env.region });
        
        const listResponse = await client.send(new ListObjectsV2Command({
          Bucket: env.resources.bucketName as string,
        }));
        
        if (listResponse.Contents?.length) {
          await client.send(new DeleteObjectsCommand({
            Bucket: env.resources.bucketName as string,
            Delete: {
              Objects: listResponse.Contents.map((obj) => ({ Key: obj.Key! })),
            },
          }));
        }
        
        await client.send(new DeleteBucketCommand({
          Bucket: env.resources.bucketName as string,
        }));
      } catch (error: any) {
        if (error.name !== 'NoSuchBucket') {
          console.warn('Could not delete bucket:', error.message);
        }
      }
    }
  }

  async getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord> {
    return env;
  }
}
