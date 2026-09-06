export type { ProviderAdapter, EnableResult } from "../types/index.js";

export const GCP_SERVICES: Record<string, string> = {
  compute: "compute.googleapis.com",
  storage: "storage.googleapis.com",
  cloudrun: "run.googleapis.com",
  iam: "iam.googleapis.com",
  pubsub: "pubsub.googleapis.com",
  container: "container.googleapis.com",
  artifactregistry: "artifactregistry.googleapis.com",
};

export const AWS_SERVICES: Record<string, string> = {
  ec2: "ec2",
  s3: "s3",
  lambda: "lambda",
  iam: "iam",
};

export const CLOUDFLARE_SERVICES: Record<string, string> = {
  workers: "workers",
  pages: "pages",
  r2: "r2",
  kv: "kv",
  d1: "d1",
  "durable-objects": "durable-objects",
};

export const VERCEL_SERVICES: Record<string, string> = {
  functions: "functions",
  edge: "edge",
  blob: "blob",
  postgres: "postgres",
};
