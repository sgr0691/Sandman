
# Sandman
Provision disposable cloud environments in seconds.

---

# Product Requirements Document (PRD)

## Overview

Sandman is an open-source CLI tool that automates provisioning and destroying temporary cloud environments for development, demos, and experimentation.

Supported providers (MVP):

- AWS
- GCP

Sandman removes the friction of manually configuring cloud infrastructure such as:

- billing accounts
- IAM roles
- projects
- API enablement
- compute services

Instead of spending 30–90 minutes configuring cloud environments, Sandman can create a sandbox environment in seconds.

---

# Problem

Developers frequently need temporary infrastructure for:

- DevTool demos
- testing infrastructure automation
- AI experiments
- prototype applications
- learning cloud services

However provisioning infrastructure manually requires many steps.

## AWS setup friction

Typical steps:

1. create account
2. configure IAM
3. create VPC
4. configure compute
5. create access credentials

## GCP setup friction

Typical steps:

1. create project
2. link billing account
3. enable APIs
4. configure service accounts
5. configure IAM permissions

Even experienced engineers spend significant time setting up infrastructure.

---

# Solution

Sandman provides a simple CLI to:

• create disposable environments  
• automatically configure cloud resources  
• enable common services  
• generate credentials  
• destroy environments when finished  

Example:

sandman init gcp  
sandman create demo  
sandman enable compute storage cloudrun  
sandman destroy demo  

---

# Goals

Primary goals:

- Fast infrastructure provisioning
- Disposable environments
- Minimal configuration
- CLI-first developer experience
- Compatible with DevTools ecosystems

---

# Non Goals

Sandman will NOT:

- replace Terraform
- replace official cloud CLIs
- manage production infrastructure
- provide full infrastructure orchestration

Focus is strictly sandbox infrastructure environments.

---

# Target Users

## AI builders

Developers building applications using AI frameworks who need quick infrastructure.

## DevTool builders

Teams needing repeatable demo environments.

## Developers learning cloud

People experimenting with cloud platforms.

---

# Core Features (MVP)

### Environment creation

Create sandbox environments instantly.

sandman create demo

### Service enablement

Enable cloud service APIs.

sandman enable compute storage

Note: For MVP, this command enables APIs only. It does not provision default resources. Resource provisioning may be added as a separate command or flag post-MVP.

### Environment status

Show current environment state.

sandman status demo

Displays:
- Resources created
- Services enabled
- Estimated hourly cost
- Time since creation

### Environment connection

Return credentials and environment variables.

sandman connect demo

### Environment destruction

Destroy infrastructure when finished.

sandman destroy demo

---

# CLI Command Specification

## Initialize provider

sandman init aws  
sandman init gcp  

Authenticates provider credentials.

---

## Create environment

sandman create <environment-name>

Creates sandbox infrastructure.

---

## Enable services

AWS example:

sandman enable ec2 s3 lambda

GCP example:

sandman enable compute storage cloudrun

---

## List environments

sandman list

Lists all environments with provider, status, and age.

---

## Environment status

sandman status <environment>

Shows:
- Resources created
- Services enabled
- Estimated hourly cost
- Time since creation
- Running total estimate

---

## Connect environment

sandman connect <environment>

Returns credentials.

---

## Destroy environment

sandman destroy <environment>

Deletes all associated resources.

---

# Scope Clarifications

## Single Active Environment Per Provider

For MVP, Sandman supports one active environment per provider. This simplifies state management and credential handling. Multi-environment support is a post-MVP feature.

## API Enablement Only

The `sandman enable` command enables cloud service APIs. It does not provision default resources. Users must create resources manually or use future template features.

## Billing Account Requirement (GCP)

GCP requires a billing account to create projects. Users must provide a billing account ID during `init gcp` or `create`. Sandman will list available billing accounts and prompt for selection.

## Error Handling and Rollback

When creation fails partway, Sandman leaves partial state intact and records it. Users can then:
- Retry the operation
- Run `sandman destroy` to clean up
- Run `sandman status` to see what was created

Automatic rollback is risky and deferred post-MVP.

## Cost Awareness

Sandman environments incur hourly costs. The tool should:
- Warn users during `create`
- Display estimated costs in `status`
- Encourage `destroy` when finished

---

# Technical Specification

## Language

TypeScript

## Runtime

Node.js

## CLI framework

Commander.js

## Cloud SDKs

AWS SDK v3  
Google Cloud SDK

## State management

Local configuration file

~/.sandman/config.json

Example:

{
  "environments": {
    "demo": {
      "provider": "gcp",
      "projectId": "demo-project",
      "services": ["cloudrun", "storage"]
    }
  }
}

---

# Architecture

Sandman architecture consists of three primary layers.

CLI  
↓  
Provisioning Engine  
↓  
Cloud Provider APIs

---

# High Level Architecture Diagram

+-----------------------+
|        CLI            |
|   Command Interface   |
+----------+------------+
           |
           v
+-----------------------+
|  Provisioning Engine  |
|                       |
|  Environment manager  |
|  Resource templates   |
+----------+------------+
           |
           v
+-----------------------+
|   Provider Adapters   |
|                       |
|  AWS Adapter          |
|  GCP Adapter          |
+----------+------------+
           |
           v
+-----------------------+
|   Cloud Providers     |
|                       |
| AWS APIs              |
| GCP APIs              |
+-----------------------+

---

# Internal System Architecture

sandman CLI
   |
   |-- command parser
   |
Provisioning Engine
   |
   |-- environment manager
   |-- template system
   |
Provider Layer
   |
   |-- aws provider adapter
   |-- gcp provider adapter
   |
Cloud APIs

---

# Resource Templates

Each sandbox environment includes minimal infrastructure.

## AWS template

- VPC
- EC2 instance
- S3 bucket
- IAM role

## GCP template

- project
- billing link
- cloud run service
- storage bucket
- service account

---

# Repository Structure

sandman/

src/
  cli/
  providers/
    aws/
    gcp/
  templates/
  utils/

docs/
  PRD.md
  architecture.md

package.json
README.md

---

# Roadmap

Future capabilities:

Environment templates

sandman template nextjs  
sandman template ai-agent

Multi-cloud provisioning

Support additional providers:

- Cloudflare
- DigitalOcean
- Render

GUI interface

Potential macOS desktop application.

CI/CD integration

Auto-create ephemeral environments for pull requests.

---

# License

MIT
