import { EnvironmentRecord, ServiceName } from '../types/index.js';

export interface ProviderAdapter {
  init(): Promise<void>;
  createEnvironment(name: string): Promise<EnvironmentRecord>;
  enableServices(env: EnvironmentRecord, services: ServiceName[]): Promise<void>;
  connect(env: EnvironmentRecord): Promise<Record<string, string>>;
  destroyEnvironment(env: EnvironmentRecord): Promise<void>;
  getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord>;
}

export const GCP_SERVICES: Record<string, string> = {
  compute: 'compute.googleapis.com',
  storage: 'storage.googleapis.com',
  cloudrun: 'run.googleapis.com',
  iam: 'iam.googleapis.com',
};

export const AWS_SERVICES: Record<string, string> = {
  ec2: 'ec2',
  s3: 's3',
  lambda: 'lambda',
  iam: 'iam',
};
