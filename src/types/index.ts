import { z } from 'zod';

export const ProviderType = z.enum(['aws', 'gcp']);

export type ProviderType = z.infer<typeof ProviderType>;

export const EnvironmentStatus = z.enum([
  'pending',
  'active',
  'failed',
  'destroyed',
]);

export type EnvironmentStatus = z.infer<typeof EnvironmentStatus>;

export const ServiceName = z.enum([
  'compute',
  'storage',
  'cloudrun',
  'lambda',
  'ec2',
  's3',
  'iam',
]);

export type ServiceName = z.infer<typeof ServiceName>;

export const EnvironmentRecordSchema = z.object({
  name: z.string().min(1),
  provider: ProviderType,
  projectId: z.string().optional(),
  accountId: z.string().optional(),
  region: z.string().optional(),
  status: EnvironmentStatus,
  services: z.array(ServiceName).default([]),
  resources: z.record(z.string(), z.any()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  error: z.string().optional(),
});

export type EnvironmentRecord = z.infer<typeof EnvironmentRecordSchema>;

export const ConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  provider: ProviderType.optional(),
  defaultRegion: z.string().optional(),
  environments: z.record(z.string(), EnvironmentRecordSchema).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface ProviderAdapter {
  init(): Promise<void>;
  createEnvironment(name: string): Promise<EnvironmentRecord>;
  enableServices(env: EnvironmentRecord, services: ServiceName[]): Promise<void>;
  connect(env: EnvironmentRecord): Promise<Record<string, string>>;
  destroyEnvironment(env: EnvironmentRecord): Promise<void>;
  getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord>;
}

export interface CreateOptions {
  provider?: ProviderType;
  region?: string;
  services?: ServiceName[];
}

export interface EnableOptions {
  services: ServiceName[];
}
