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

Supported providers:

- AWS
- GCP

Future support:

- Cloudflare
- DigitalOcean
- Render

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

Connect to the environment.

```bash
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

### Initialize provider

```bash
sandman init aws
sandman init gcp
```

Authenticates and configures credentials.

---

### Create environment

```bash
sandman create <environment-name>
```

Example:

```bash
sandman create demo
```

---

### Enable services

AWS example:

```bash
sandman enable ec2 s3 lambda
```

GCP example:

```bash
sandman enable compute storage cloudrun
```

---

### List environments

```bash
sandman list
```

---

### Connect environment

```bash
sandman connect <environment-name>
```

Outputs environment credentials.

---

### Destroy environment

```bash
sandman destroy <environment-name>
```

Deletes all associated resources.

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
- S3
- IAM roles

---

### GCP

Uses Google Cloud APIs to provision:

- projects
- billing connections
- cloud run
- storage buckets
- service accounts

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
  providers/
  templates/
  utils/

docs/
  PRD.md

package.json
```

---

## Roadmap

Planned features:

• Environment templates  
• Multi-cloud provisioning  
• GitHub demo environments  
• Local testing environments

---

## Contributing

Pull requests are welcome.

To contribute:

```bash
git clone https://github.com/your-org/sandman
cd sandman
npm install
npm run dev
```

---

## License

MIT
