# Sandman

```text
  ____                  _
 / ___|  __ _ _ __   __| |_ __ ___   __ _ _ __
 \___ \ / _` | '_ \ / _` | '_ ` _ \ / _` | '_ \
  ___) | (_| | | | | (_| | | | | | | (_| | | | |
 |____/ \__,_|_| |_|\__,_|_| |_| |_|\__,_|_| |_|
```

Provision disposable cloud environments in seconds.

Sandman is an open-source CLI that creates disposable cloud environments for AWS and GCP in seconds.

Perfect for:

- DevTool demos
- AI builders testing infrastructure
- Rapid prototyping
- Disposable sandbox environments
- Infrastructure experimentation

Instead of manually configuring billing, IAM, APIs, and services, Sandman spins up a working environment instantly.

---

## Why Sandman?

Creating cloud infrastructure manually is slow.

Even experienced engineers must:

### AWS

• configure IAM  
• create VPCs  
• provision compute  
• configure credentials

### GCP

• create a project  
• connect billing  
• enable APIs  
• configure service accounts

This can take **30–90 minutes**.

Sandman reduces that to **seconds**.

---

## Features

• Create disposable cloud environments  
• Automatic project provisioning  
• Billing configuration helpers  
• Enable common cloud services  
• Credential management  
• Environment teardown  
• Machine-readable `--json` output for humans and agents  

Supported providers:

- AWS (supported)
- GCP (supported)

Experimental (auth + local registry only):

- Cloudflare
- Vercel

Run `sandman providers` to see the live capability matrix.

---

## Installation

### Using npm

```bash
npm install -g @itssergio91/sandman
```

Or run without installing:

```bash
npx @itssergio91/sandman
```

---

## Quick Start

Initialize a cloud provider.

```bash
sandman init gcp
```

Create a sandbox environment.

```bash
sandman create demo
```

Enable services.

```bash
sandman enable compute storage cloudrun
```

Check status and connect.

```bash
sandman status demo
sandman connect demo
```

Destroy the environment when finished.

```bash
sandman destroy demo
```

---

## Example Workflow

Create a sandbox for testing.

```bash
sandman init gcp
sandman create demo-env
sandman enable compute storage cloudrun
sandman connect demo-env
```

Run your application or tests against the environment.

Then destroy it when finished.

```bash
sandman destroy demo-env
```

---

## Commands

All commands accept `--json` for machine-readable output. JSON errors use `{ success: false, code, error, hint?, next? }`.

### List providers

```bash
sandman providers
sandman providers --json
```

Shows which providers are fully supported vs experimental.

### Initialize provider

```bash
sandman init aws
sandman init gcp
sandman init aws --region us-west-2 --json
```

Authenticates and configures credentials.

---

### Create environment

```bash
sandman create <environment-name>
sandman create demo --provider aws --dry-run
sandman create demo -p gcp -r us-central1 --json
```

Names must be lowercase letters, digits, and hyphens (max 31 characters).

AWS create persists whatever IDs were provisioned. If some steps fail, JSON includes `partial: true` and `warnings`; `environment.status` is `failed`. Destroy those leftovers, then recreate.

The `-r` / stored default region is passed to the provider (AWS honors it).

---

### Enable services

AWS example:

```bash
sandman enable ec2 s3 lambda -e demo
```

GCP example:

```bash
sandman enable compute storage cloudrun -e demo
```

---

### List environments

```bash
sandman list
sandman list --json
```

`--json` is a raw array of environments (not wrapped, not init state). `sandman init` is separate.

---

### Environment status

```bash
sandman status demo
sandman status demo --json
```

Shows provider, status, age, resources, and estimated cost. Status refreshes from the cloud when the adapter supports it (GCP project lifecycle) and saves if it changed.

---

### Connect environment

```bash
sandman connect demo
sandman connect demo --json
```

Outputs environment variables. Secret values (API tokens) are redacted by default. Pass `--show-secrets` only when you intentionally need the raw token.

---

### Destroy environment

```bash
sandman destroy demo
sandman destroy demo -y --json
```

Deletes associated cloud resources, then removes the local record so the name can be reused. `--json` never prompts; pass `-y` to confirm.

---

## Architecture

Sandman consists of three layers.

CLI  
↓  
Provisioning Engine  
↓  
Cloud Provider APIs

Components:

- CLI layer
- Provisioning engine
- Provider adapters

---

## Providers

### AWS

Uses AWS SDK to provision:

- VPC
- EC2
- S3 (public access blocked, SSE-S3 encryption)
- IAM roles (SSM, no public SSH)

### GCP

Uses Google Cloud APIs to provision:

- projects
- billing connections
- API enablement
- service accounts (planned)
- storage buckets (planned)

---

## Use Cases

### DevTool demos

Create disposable environments for product demos.

### Rapid experimentation

Spin up temporary environments to test infrastructure or integrations.

### Learning cloud infrastructure

Practice working with cloud services without maintaining long-lived infrastructure.

---

## Project Structure

```
sandman/

src/
  cli/
  core/
  providers/
  utils/

package.json
```

---

## Roadmap

Planned features:

• Environment templates  
• Multi-cloud provisioning (Cloudflare / Vercel beyond experimental)  
• GitHub demo environments  
• Local testing environments

---

## Contributing

Pull requests are welcome.

To contribute:

```bash
git clone https://github.com/sgr0691/Sandman.git
cd Sandman
npm install
npm test
npm run dev
```

---

## License

MIT
