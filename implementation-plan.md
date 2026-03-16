# Sandman Implementation Plan

A practical implementation plan for building the Sandman MVP from the PRD.

---

## Objective

Build an open-source CLI that can:

- authenticate with AWS and GCP
- create disposable sandbox environments
- enable a small set of common services
- connect users to those environments
- destroy those environments cleanly

The goal is to ship a tight MVP quickly, with clean architecture and room to expand later.

---

## Guiding Principles

- Keep the MVP narrow
- Optimize for developer experience
- Prefer safe defaults
- Avoid production-infra complexity
- Make every command composable
- Design provider support behind adapters

---

## MVP Scope

The initial implementation should support:

### Core commands

- `sandman init <provider>`
- `sandman create <environment-name>`
- `sandman enable <services...>`
- `sandman list`
- `sandman status <environment-name>`
- `sandman connect <environment-name>`
- `sandman destroy <environment-name>`

### Supported providers

- AWS
- GCP

### MVP Constraints

- One active environment per provider
- `enable` activates APIs only, no resource provisioning
- GCP requires billing account ID upfront
- Partial state retained on failure with cleanup guidance

### Minimal resources

#### AWS

- IAM identity verification
- optional sandbox tag set
- S3 bucket
- lightweight compute template placeholder
- local environment registration

#### GCP

- project creation or project registration flow
- billing account attachment
- API enablement
- service account creation
- storage bucket
- lightweight Cloud Run or Compute template placeholder
- local environment registration

---

## Recommended Technical Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **CLI framework:** Commander.js
- **Package manager:** npm or pnpm
- **Logging / terminal UX:** ora, chalk, boxen
- **Validation:** zod
- **Configuration:** JSON in `~/.sandman/config.json`
- **AWS SDK:** AWS SDK v3
- **GCP APIs:** Google Cloud Resource Manager, Cloud Billing, Service Usage, IAM, Storage

---

## Proposed Repository Structure

```txt
sandman/
├─ src/
│  ├─ cli/
│  │  ├─ index.ts
│  │  ├─ commands/
│  │  │  ├─ init.ts
│  │  │  ├─ create.ts
│  │  │  ├─ enable.ts
│  │  │  ├─ list.ts
│  │  │  ├─ connect.ts
│  │  │  └─ destroy.ts
│  ├─ core/
│  │  ├─ environment-manager.ts
│  │  ├─ state-store.ts
│  │  ├─ templates.ts
│  │  └─ types.ts
│  ├─ providers/
│  │  ├─ base.ts
│  │  ├─ aws/
│  │  │  ├─ adapter.ts
│  │  │  ├─ auth.ts
│  │  │  ├─ create.ts
│  │  │  ├─ enable.ts
│  │  │  └─ destroy.ts
│  │  └─ gcp/
│  │     ├─ adapter.ts
│  │     ├─ auth.ts
│  │     ├─ create.ts
│  │     ├─ enable.ts
│  │     └─ destroy.ts
│  ├─ utils/
│  │  ├─ logger.ts
│  │  ├─ errors.ts
│  │  ├─ prompts.ts
│  │  └─ files.ts
│  └─ index.ts
├─ docs/
│  ├─ README.md
│  ├─ PRD.md
│  ├─ architecture.md
│  └─ implementation-plan.md
├─ package.json
├─ tsconfig.json
└─ LICENSE
```

---

## Architecture Strategy

Sandman should use a simple provider adapter architecture.

### Core idea

The CLI should not directly contain provider-specific cloud logic. Instead:

1. The CLI parses user intent
2. The environment manager coordinates the flow
3. The provider adapter executes cloud-specific actions
4. Local state is updated only after successful operations

### Interface example

```ts
export interface ProviderAdapter {
  init(): Promise<void>;
  createEnvironment(name: string): Promise<EnvironmentRecord>;
  enableServices(env: EnvironmentRecord, services: string[]): Promise<void>;
  connect(env: EnvironmentRecord): Promise<Record<string, string>>;
  destroyEnvironment(env: EnvironmentRecord): Promise<void>;
}
```

This keeps AWS and GCP implementations isolated and makes future provider support easier.

---

## Implementation Phases

## Phase 0 — Project Bootstrap

### Goal

Set up the base CLI project and architecture skeleton.

### Tasks

- initialize Node.js + TypeScript project
- install Commander.js
- create command files
- create provider adapter interface
- create shared types
- create local config/state store
- add linting and formatting
- add basic README

### Deliverable

A runnable CLI with stubbed commands:

```bash
sandman init
sandman create
sandman enable
sandman list
sandman connect
sandman destroy
```

Each command can initially print placeholder output.

### Exit criteria

- CLI runs locally
- commands are wired
- config file can be created and read
- provider architecture is defined

---

## Phase 1 — Local State + Environment Registry

### Goal

Build Sandman’s local source of truth.

### Tasks

- create `~/.sandman/config.json`
- define environment record schema
- support create/read/update/delete operations
- validate config with zod
- add helper utilities for state persistence
- handle duplicate names and missing environments

### Example environment record

```json
{
  "name": "demo-env",
  "provider": "gcp",
  "projectId": "sandman-demo-123",
  "services": ["compute", "storage"],
  "createdAt": "2026-03-15T18:00:00.000Z",
  "status": "active"
}
```

### Deliverable

A working environment registry that powers:

- `sandman list`
- environment lookup for `connect`, `enable`, `destroy`

### Exit criteria

- environments can be saved and loaded
- `list` works
- invalid state files are handled safely

---

## Phase 2 — Provider Authentication Flows

### Goal

Implement `sandman init aws` and `sandman init gcp`.

### AWS tasks

- verify AWS credentials from local CLI/profile
- detect current account ID
- detect default region
- store minimal provider config locally

### GCP tasks

- verify gcloud auth state or service account auth
- list available billing accounts (requires organization access)
- prompt user to select billing account if multiple available
- require billing account ID if none discoverable
- detect active organization if relevant
- store minimal provider config locally

### Important

Billing account discovery requires organization-level permissions. If unavailable, Sandman must prompt the user to provide a billing account ID explicitly. This avoids permission errors during project creation.

### Deliverable

Working provider init flows that validate access and save provider context.

### Exit criteria

- `sandman init aws` confirms usable AWS access
- `sandman init gcp` confirms usable GCP access
- clear error messages for missing auth

---

## Phase 3 — GCP MVP Create Flow

### Goal

Ship the first real end-to-end create flow on GCP.

GCP is a strong initial provider because the sandbox concept maps well to projects.

### Tasks

- create a GCP project
- attach billing account
- apply labels/tags
- enable required APIs:
  - Cloud Resource Manager
  - Cloud Billing
  - Service Usage
  - IAM
  - Cloud Run
  - Cloud Storage
- create a service account
- create a storage bucket
- persist environment metadata locally

### Deliverable

A working command:

```bash
sandman create demo-env --provider gcp
```

or provider inferred from init state.

### Exit criteria

- project is created successfully
- billing is attached
- APIs are enabled
- environment is saved locally
- errors roll back or fail cleanly

---

## Phase 4 — GCP Enable / Connect / Destroy

### Goal

Complete the GCP lifecycle.

### Enable tasks

- map friendly service names to GCP APIs/resources
- support commands like:
  - `sandman enable compute storage cloudrun`
- avoid re-enabling already enabled services
- update local state

### Connect tasks

- output project ID
- output useful gcloud commands
- optionally generate `.env`-style export lines
- optionally print active credentials path or service account info

### Destroy tasks

- delete storage bucket contents
- delete bucket
- delete service accounts created by Sandman
- optionally delete project
- mark environment removed from local state

### Deliverable

A full GCP lifecycle.

### Exit criteria

- create → enable → connect → destroy works end-to-end
- cleanup is predictable
- repeated destroy attempts fail gracefully

---

## Phase 5 — AWS MVP Create Flow

### Goal

Ship the first end-to-end AWS flow with narrower scope than GCP.

Because AWS accounts are heavier than GCP projects, the MVP should focus on sandbox resources inside an already-authenticated AWS account rather than trying to create new AWS accounts.

### Important product note

For MVP, Sandman should provision **sandbox environments inside an existing AWS account**, not automate brand-new AWS account creation. This keeps scope realistic and aligned with the actual APIs available.

### Tasks

- verify current AWS account and region
- create standard tags for Sandman-managed resources
- create S3 bucket
- create IAM role or policy set if needed
- create lightweight compute placeholder:
  - Lambda function template, or
  - minimal EC2 template metadata without full network complexity
- persist environment metadata locally

### Deliverable

A working AWS environment create flow in an existing account.

### Exit criteria

- resources are created in the target account
- resources are tagged
- local state tracks them accurately

---

## Phase 6 — AWS Enable / Connect / Destroy

### Goal

Complete AWS lifecycle support.

### Enable tasks

- support friendly names:
  - `ec2`
  - `s3`
  - `lambda`
- provision minimal default resources per service
- skip already-enabled services safely

### Connect tasks

- output region
- output account ID
- output relevant ARNs, bucket names, and next-step commands

### Destroy tasks

- delete Sandman-managed resources by recorded IDs
- empty and delete S3 buckets
- remove created roles/policies where safe
- clean local state

### Deliverable

A full AWS lifecycle in an existing account.

### Exit criteria

- create → enable → connect → destroy works end-to-end
- only Sandman-managed resources are touched
- destructive operations are explicit and safe

---

## Phase 7 — Polish, Safety, and DX

### Goal

Make the tool pleasant and trustworthy.

### Tasks

- add progress spinners
- improve terminal output
- add confirmation prompts for destroy
- add `--json` output mode
- add `--yes` for non-interactive usage
- add helpful remediation messages
- add provider/service validation
- improve docs and examples

### Deliverable

A polished MVP ready for GitHub.

### Exit criteria

- commands feel predictable
- errors are actionable
- README matches actual behavior

---

## Phase 8 — Demo Templates (Post-MVP Killer Feature)

### Goal

Add the feature most likely to create excitement.

### Proposed command

```bash
sandman demo nextjs
```

### What it would do

- create sandbox environment
- enable required services
- deploy a template app
- return a live URL

### Example future templates

- nextjs
- node-api
- ai-agent
- static-site

### Why this matters

This turns Sandman from “infra helper” into “one-command cloud playground,” which is much more shareable.

---

## Command-by-Command Build Order

Recommended order of implementation:

1. `sandman list`
2. `sandman status`
3. `sandman init aws`
4. `sandman init gcp`
5. `sandman create` for GCP
6. `sandman connect` for GCP
7. `sandman enable` for GCP
8. `sandman destroy` for GCP
9. `sandman create` for AWS
10. `sandman connect` for AWS
11. `sandman enable` for AWS
12. `sandman destroy` for AWS
13. DX improvements
14. demo templates

This sequencing gets one provider working end-to-end quickly before expanding.

---

## Rollback Strategy

### Partial state on failure

When `create` fails partway through, Sandman should:

1. Record all successfully created resources to local state
2. Mark the environment status as `failed`
3. Print clear error message with remediation options

### User recovery options

- `sandman status <env>` to see what was created
- `sandman destroy <env>` to clean up partial state
- Retry `create` after fixing the underlying issue

### Why not automatic rollback

Automatic rollback is risky because:
- Destroy operations can themselves fail
- Network issues may leave orphaned resources
- User may want to debug the partial state

For MVP, explicit cleanup via `destroy` is safer and more predictable.

---

## Testing Strategy

### Unit tests

- Test state store operations (create, read, update, delete)
- Test environment record validation with zod
- Test provider adapter interface compliance
- Mock provider SDKs for isolated testing

### Integration tests

- Flag-based: `sandman create --integration-test`
- Requires real cloud credentials
- Creates minimal resources, then destroys
- Skipped by default in CI unless explicitly enabled

### Dry-run mode

- `sandman create --dry-run` prints planned actions without executing
- Helps users understand what will happen
- Useful for debugging and learning
- Low-cost way to validate configuration

---

## Cost Awareness

### During create

`sandman create` should warn:
- Estimated hourly/daily cost range
- Reminder to run `destroy` when finished

Example output:
```
Creating environment 'demo-env'...
⚠ Estimated cost: ~$0.10/hour
⚠ Run 'sandman destroy demo-env' when finished to avoid ongoing charges
```

### During status

`status` should display:
- Resources created with their cost tier (e.g., "micro", "small")
- Estimated hourly cost
- Time since creation
- Running total estimate

### Cost estimation approach

For MVP, use static cost tiers based on resource types:
- GCP project: base cost
- Cloud Run: pay-per-request (warn about minimum)
- Storage: pay-per-GB (use default bucket size estimate)

Post-MVP: integrate with cloud billing APIs for real-time estimates.

---

## Engineering Risks

## 1. Billing complexity on GCP

Attaching billing may require different permissions than project creation.

### Mitigation

- make billing account selection explicit
- validate billing permissions during `init gcp`
- provide clear fallback guidance

---

## 2. AWS account creation is too large for MVP

Creating brand-new AWS accounts programmatically is possible in some enterprise contexts but adds major complexity.

### Mitigation

- define AWS MVP as sandbox resources within an existing account
- leave multi-account orchestration for a later roadmap

---

## 3. Safe deletion is hard

Destroy flows can accidentally remove too much if state is incomplete.

### Mitigation

- only destroy resources created and recorded by Sandman
- use tags/labels aggressively
- require explicit confirmation unless `--yes`

---

## 4. API enablement delays

Cloud APIs can take time to enable, especially in GCP.

### Mitigation

- add polling/retry logic
- set user expectations in CLI output
- show progress during long-running operations
- consider async enable with status polling

---

## 5. Scope creep

It will be tempting to add databases, VPC customization, CI integrations, GUI, and templates too early.

### Mitigation

- keep MVP centered on lifecycle basics
- defer templates until lifecycle is stable
- defer resource provisioning from `enable` command

---

## 6. Cloud latency and eventual consistency

AWS IAM and GCP API enablement are eventually consistent. Operations may report success before resources are usable.

### Mitigation

- add wait/retry logic for critical operations
- set realistic expectations in output
- document typical propagation times

---

## Success Criteria for MVP

Sandman MVP is successful when a user can:

### GCP

```bash
sandman init gcp
# prompted for billing account selection
sandman create demo-env
sandman enable compute storage cloudrun
sandman status demo-env
sandman connect demo-env
sandman destroy demo-env
```

### AWS

```bash
sandman init aws
sandman create demo-env
sandman enable s3 lambda
sandman status demo-env
sandman connect demo-env
sandman destroy demo-env
```

### Key requirements

- Billing account is explicitly selected during GCP init or create
- `enable` activates APIs only, does not create resources
- `status` shows environment state and estimated cost
- Failed operations leave partial state and provide cleanup guidance
- Cost warnings appear during create and status commands

And the entire lifecycle is understandable, predictable, and documented.

---

## Suggested 2-Week Build Plan

### Prerequisites (Before Day 1)

Ensure cloud project readiness:
- GCP billing account available or linked
- AWS account with appropriate permissions
- Organization-level access for GCP billing discovery (or billing account ID ready)
- Test project quotas verified

---

## Week 1

### Day 1
- bootstrap repo
- wire CLI commands
- define types and adapters

### Day 2
- implement local state store
- implement `list`
- implement `status`

### Day 3
- implement `init gcp`
- validate billing/account discovery

### Day 4
- implement GCP create flow

### Day 5
- implement GCP enable flow

### Day 6
- implement GCP connect + destroy

### Day 7
- test GCP end-to-end
- fix edge cases

---

## Week 2

### Day 8
- implement `init aws`

### Day 9
- implement AWS create flow

### Day 10
- implement AWS enable flow

### Day 11
- implement AWS connect + destroy

### Day 12
- improve output, confirmations, error handling

### Day 13
- polish README and docs
- record demo GIF or screenshots

### Day 14
- package release
- GitHub launch

---

## Suggested Future Milestones

### Milestone 2
- template-based demo environments
- `sandman demo nextjs`

### Milestone 3
- Cloudflare support
- Render support
- DigitalOcean support

### Milestone 4
- CI ephemeral environments
- GitHub PR integrations

### Milestone 5
- desktop app or web UI

---

## Final Recommendation

Build Sandman in this order:

1. **Get GCP working end-to-end first**
2. **Add AWS in an existing-account model**
3. **Polish DX**
4. **Ship the one-command demo template feature**

That path gives you:

- a realistic MVP
- a usable OSS project quickly
- a strong GitHub launch story
- a clear roadmap to a more magical product

---
