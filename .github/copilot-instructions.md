# Sandman — GitHub Copilot Instructions

This project is **Sandman**, a CLI tool that provisions disposable cloud environments in seconds. AWS and GCP are fully supported. Cloudflare and Vercel are experimental (auth + local registry only — check `sandman providers --json`).

## What Sandman Does

Sandman automates the creation of temporary sandbox infrastructure for development, testing, and demos. It handles authentication checks, resource provisioning, service enablement, credential management, and teardown.

## CLI Commands

```bash
# Install
npm install -g @itssergio91/sandman

# Core commands (all support --json for machine-readable output)
sandman init <provider> [--region <region>] [--billing-account <id>] [--json]
sandman create <name> [-p <provider>] [-r <region>] [--billing-account <id>] [--ttl <duration>] [--strict] [--dry-run] [--json]
sandman enable <service1> [service2...] [-e <env-name>] [--json]
sandman list [--json]
sandman status <name> [--json]
sandman connect <name> [--json]
sandman destroy <name> [-y] [--json]
sandman providers [--json]
sandman doctor [--reap] [--json]
```

## Supported Providers & Services

| Provider | Maturity | Services |
|---|---|---|
| **AWS** | supported | `ec2`, `s3`, `lambda`, `iam` |
| **GCP** | supported | `compute`, `storage`, `cloudrun`, `iam`, `pubsub`, `container`, `artifactregistry` |
| **Cloudflare** | experimental | `workers`, `pages`, `r2`, `kv`, `d1`, `durable-objects` |
| **Vercel** | experimental | `functions`, `edge`, `blob`, `postgres` |

## Authentication

- **AWS**: `aws configure` or env vars `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`
- **GCP**: `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS`
- **Cloudflare**: `CLOUDFLARE_API_TOKEN` (+ optional `CLOUDFLARE_ACCOUNT_ID`)
- **Vercel**: `VERCEL_TOKEN` (+ optional `VERCEL_TEAM_ID`)

## Standard Provisioning Workflow

When helping users provision infrastructure, follow this sequence:

```bash
# 0. Discover provider maturity (supported vs experimental)
sandman providers --json

# 1. Check existing environments (raw array; not init state)
sandman list --json

# 2. Initialize provider when create would return NO_PROVIDER
sandman init <provider> --json

# 3. Create environment (inspect environment.status, warnings, partial; use --strict)
sandman create <name> --provider <provider> --ttl 2h --strict --json

# 4. Enable required services (read mode/provisioned/localOnly)
sandman enable <service1> <service2> -e <name> --json

# 5. Get connection credentials (tokens are redacted)
sandman connect <name> --json
```

## Copilot Behavior Guidelines

When helping with Sandman tasks:

1. **Always use `--json`** so output can be parsed programmatically. Prefer `code`, `error`, `hint`, and `next` on failures. Create may also include `warnings[]` and `partial`. Pass `--strict` on create.
2. **Check before creating** — run `sandman list --json` to reuse *active* environments. A destroyed name can be recreated.
3. **Surface credentials cleanly** — after `sandman connect`, format non-secret values as a `.env` block. Do not request `--show-secrets` unless the user explicitly asks.
4. **Remind about teardown** — always mention `sandman destroy <name>` after provisioning. Prefer `--ttl 2h`.
5. **Don't treat list as init** — `sandman list --json` is environments only. Run `sandman init` when create returns `NO_PROVIDER`. Use `sandman doctor --json` on `AUTH_REQUIRED`.
6. **Confirm before destroy** — ask the user, then run `sandman destroy <name> -y --json`. `--json` without `-y` returns `CONFIRMATION_REQUIRED` and does not prompt. Successful destroy recycles the name.
7. **Honor experimental providers** — if `sandman providers --json` marks a provider `experimental`, tell the user it only writes a local registry.
8. **Azure is coming soon** — suggest AWS or GCP as alternatives.

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
