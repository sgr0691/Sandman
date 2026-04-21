---
trigger: model_decision
description: Apply when the user wants to provision, create, set up, manage, connect to, list, check status of, or destroy cloud environments and sandboxes using Sandman. Use for any request involving disposable cloud infrastructure, AWS (EC2, S3, Lambda, IAM), GCP (Compute, Cloud Run, GCS, Artifact Registry, Pub/Sub), Cloudflare (Workers, Pages, R2, KV, D1, Durable Objects), or Vercel (Functions, Edge, Blob, Postgres). Also apply for phrases like "spin up an environment", "tear down my sandbox", "get cloud credentials", "set up cloud services for testing", or "demo infrastructure".
---

# Sandman — Disposable Cloud Environments

**Sandman** is a CLI that provisions disposable cloud environments in seconds. Use it to create, manage, and destroy sandbox infrastructure for development, testing, and demos.

## Supported Providers

| Provider | Auth |
|---|---|
| **AWS** | `aws configure` or `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` |
| **GCP** | `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS` |
| **Cloudflare** | `CLOUDFLARE_API_TOKEN` (+ optional `CLOUDFLARE_ACCOUNT_ID`) |
| **Vercel** | `VERCEL_TOKEN` (+ optional `VERCEL_TEAM_ID`) |

## Available Services

- **AWS**: `ec2` · `s3` · `lambda` · `iam`
- **GCP**: `compute` · `storage` · `cloudrun` · `iam` · `pubsub` · `container` · `artifactregistry`
- **Cloudflare**: `workers` · `pages` · `r2` · `kv` · `d1` · `durable-objects`
- **Vercel**: `functions` · `edge` · `blob` · `postgres`

## CLI Commands

```bash
# Install
npm install -g @itssergio91/sandman

# Core workflow (all commands support --json)
sandman init <provider> [--region <region>] [--json]
sandman create <name> [-p <provider>] [-r <region>] [--dry-run] [--json]
sandman enable <service1> [service2...] [-e <env-name>] [--json]
sandman list [--json]
sandman status <name> [--json]
sandman connect <name> [--json]
sandman destroy <name> [-y] [--json]
```

## Provisioning Workflow

When a user asks to set up cloud infrastructure:

1. **Check if Sandman is installed**: `which sandman || npx @itssergio91/sandman --version`
2. **List existing environments**: `sandman list --json` — reuse active ones, avoid duplicates
3. **Initialize the provider** (only if not already done): `sandman init <provider> --json`
4. **Create the environment**: `sandman create <name> --provider <provider> --json`
5. **Enable services**: `sandman enable <services...> -e <name> --json`
6. **Get credentials**: `sandman connect <name> --json` — present as a copyable `.env` block

## Example Flows

### AWS with S3 + Lambda
```bash
sandman list --json
sandman init aws --json
sandman create my-env --provider aws --json
sandman enable s3 lambda -e my-env --json
sandman connect my-env --json
```

### Cloudflare Workers + KV
```bash
sandman list --json
sandman init cloudflare --json
sandman create cf-sandbox --provider cloudflare --json
sandman enable workers kv -e cf-sandbox --json
sandman connect cf-sandbox --json
```

### GCP Cloud Run + Artifact Registry
```bash
sandman list --json
sandman init gcp --json
sandman create gcp-demo --provider gcp --json
sandman enable cloudrun artifactregistry -e gcp-demo --json
sandman connect gcp-demo --json
```

### Vercel with Postgres + Blob
```bash
sandman list --json
sandman init vercel --json
sandman create vercel-demo --provider vercel --json
sandman enable postgres blob -e vercel-demo --json
sandman connect vercel-demo --json
```

## Rules

- Always use `--json` flag for machine-readable output
- After creating any environment, remind the user: **run `sandman destroy <name>` when done** to avoid cloud charges
- Before destroying an environment, confirm with the user unless they explicitly said to skip it
- If credentials are missing, tell the user exactly what env vars to set or CLI auth commands to run
- Do not re-initialize a provider if it already appears in `sandman list --json`
- If Azure is requested, explain it's coming soon and suggest an alternative provider
- For dry-run previews, use `sandman create <name> --provider <provider> --dry-run --json`
