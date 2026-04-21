# Sandman — GitHub Copilot Instructions

This project is **Sandman**, a CLI tool that provisions disposable cloud environments in seconds. It supports AWS, GCP, Cloudflare, and Vercel.

## What Sandman Does

Sandman automates the creation of temporary sandbox infrastructure for development, testing, and demos. It handles authentication checks, resource provisioning, service enablement, credential management, and teardown.

## CLI Commands

```bash
# Install
npm install -g @itssergio91/sandman

# Core commands (all support --json for machine-readable output)
sandman init <provider> [--region <region>] [--json]
sandman create <name> [-p <provider>] [-r <region>] [--dry-run] [--json]
sandman enable <service1> [service2...] [-e <env-name>] [--json]
sandman list [--json]
sandman status <name> [--json]
sandman connect <name> [--json]
sandman destroy <name> [-y] [--json]
```

## Supported Providers & Services

| Provider | Services |
|---|---|
| **AWS** | `ec2`, `s3`, `lambda`, `iam` |
| **GCP** | `compute`, `storage`, `cloudrun`, `iam`, `pubsub`, `container`, `artifactregistry` |
| **Cloudflare** | `workers`, `pages`, `r2`, `kv`, `d1`, `durable-objects` |
| **Vercel** | `functions`, `edge`, `blob`, `postgres` |

## Authentication

- **AWS**: `aws configure` or env vars `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`
- **GCP**: `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS`
- **Cloudflare**: `CLOUDFLARE_API_TOKEN` (+ optional `CLOUDFLARE_ACCOUNT_ID`)
- **Vercel**: `VERCEL_TOKEN` (+ optional `VERCEL_TEAM_ID`)

## Standard Provisioning Workflow

When helping users provision infrastructure, follow this sequence:

```bash
# 1. Check existing environments (avoid duplicates)
sandman list --json

# 2. Initialize provider if not already done
sandman init <provider> --json

# 3. Create environment
sandman create <name> --provider <provider> --json

# 4. Enable required services
sandman enable <service1> <service2> -e <name> --json

# 5. Get connection credentials
sandman connect <name> --json
```

## Copilot Behavior Guidelines

When helping with Sandman tasks:

1. **Always use `--json`** so output can be parsed programmatically.
2. **Check before creating** — run `sandman list --json` to avoid duplicate environments.
3. **Surface credentials cleanly** — after `sandman connect`, format the output as a `.env` block.
4. **Remind about teardown** — always mention `sandman destroy <name>` after provisioning to avoid cloud charges.
5. **Don't re-initialize** — skip `sandman init` if the provider is already listed in `sandman list --json`.
6. **Confirm before destroy** — ask for confirmation before running `sandman destroy` unless the user explicitly said to skip it.
7. **Azure is coming soon** — suggest AWS, GCP, Cloudflare, or Vercel as alternatives.

## Project Structure

```
src/
  cli/commands/     # Individual command implementations (init, create, enable, etc.)
  providers/        # Cloud provider adapters (aws/, gcp/, cloudflare/, vercel/)
  core/             # State management (state-store.ts)
  types/            # Zod schemas and TypeScript types
  utils/            # Cost estimator and helpers
```

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run Vitest test suite
npm run lint         # ESLint
```

The provider adapter pattern in `src/providers/base.ts` defines the `ProviderAdapter` interface. Each provider implements `init()`, `create()`, `enable()`, `connect()`, and `destroy()`.
