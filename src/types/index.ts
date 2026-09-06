import { z } from "zod";

export const ProviderType = z.enum(["aws", "gcp", "cloudflare", "vercel"]);

export type ProviderType = z.infer<typeof ProviderType>;

export const EnvironmentStatus = z.enum([
  "pending",
  "active",
  "failed",
  "destroyed",
]);

export type EnvironmentStatus = z.infer<typeof EnvironmentStatus>;

export const ServiceName = z.enum([
  // GCP
  "compute",
  "storage",
  "cloudrun",
  "iam",
  "pubsub",
  "container",
  "artifactregistry",
  // AWS
  "lambda",
  "ec2",
  "s3",
  // Cloudflare
  "workers",
  "pages",
  "r2",
  "kv",
  "d1",
  "durable-objects",
  // Vercel
  "functions",
  "edge",
  "blob",
  "postgres",
]);

export type ServiceName = z.infer<typeof ServiceName>;

export const EnvironmentRecordSchema = z.object({
  name: z.string().min(1),
  provider: ProviderType,
  projectId: z.string().optional(),
  accountId: z.string().optional(),
  region: z.string().optional(),
  billingAccount: z.string().optional(),
  status: EnvironmentStatus,
  services: z.array(ServiceName).default([]),
  resources: z.record(z.string(), z.any()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  ttl: z.string().optional(),
  error: z.string().optional(),
});

export type EnvironmentRecord = z.infer<typeof EnvironmentRecordSchema>;

export const ConfigSchema = z.object({
  version: z.string().default("1.0.0"),
  provider: ProviderType.optional(),
  defaultRegion: z.string().optional(),
  defaultBillingAccount: z.string().optional(),
  environments: z.record(z.string(), EnvironmentRecordSchema).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export type EnableMode = "cloud" | "local-only" | "mixed";

export interface EnableResult {
  mode: EnableMode;
  recorded: ServiceName[];
  provisioned: ServiceName[];
  localOnly: ServiceName[];
  warnings?: string[];
}

export interface ProviderAdapter {
  init(): Promise<void>;
  setRegion?(region: string): void;
  setBillingAccount?(accountId: string): void;
  discoverBillingAccount?(): Promise<string | null>;
  whoami?(): Promise<Record<string, string | null | undefined>>;
  createEnvironment(name: string): Promise<EnvironmentRecord>;
  enableServices(
    env: EnvironmentRecord,
    services: ServiceName[],
  ): Promise<EnableResult>;
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
