---
name: sandman-setup-ai-tool
description: Use this skill to add Sandman integration to an AI coding tool. Triggers when the user wants to set up, add, configure, or install Sandman support for Cursor, GitHub Copilot, Windsurf, Aider, Continue, or any other AI coding assistant. Also triggers for "connect Sandman to my AI tool", "use Sandman in Cursor", "add Sandman to Copilot", "make Sandman work with my AI editor", or "install Sandman skill for <tool>".
---

# Sandman AI Tool Setup

You help users install Sandman integration files for their AI coding tools so they can provision cloud environments directly from within those tools.

## Supported Tools

| Tool | File Created | Format |
|---|---|---|
| **Claude Code** | `.claude/commands/cloud-infra.md` | Skill markdown (already installed if you're reading this) |
| **Cursor** | `.cursor/rules/sandman.mdc` | MDC rules file |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Workspace instructions |
| **Windsurf** | `.windsurf/rules/sandman.md` | Rules markdown |
| **Aider** | `.aider.instructions.md` | Custom instructions |
| **Continue** | `.continue/sandman.prompt` | Prompt file |

---

## Workflow

### Step 1 — Detect which tools the user wants

Parse the user's request. If a specific tool is named, configure that one. If the user says "all" or "every tool" or doesn't specify, detect which tools are present:

```bash
# Detect installed tools by checking for their config directories
ls -d .cursor .windsurf .github .aider* .continue 2>/dev/null
# Also check if the tools are installed
which cursor windsurf aider 2>/dev/null
```

Report what you found. Ask if they'd like to configure all detected tools or a specific subset.

### Step 2 — Check what's already installed

For each target tool, check if the integration file already exists:

```bash
# Claude Code
ls .claude/commands/cloud-infra.md 2>/dev/null

# Cursor
ls .cursor/rules/sandman.mdc 2>/dev/null

# GitHub Copilot
ls .github/copilot-instructions.md 2>/dev/null

# Windsurf
ls .windsurf/rules/sandman.md 2>/dev/null

# Aider
ls .aider.instructions.md 2>/dev/null

# Continue
ls .continue/sandman.prompt 2>/dev/null
```

Skip tools that are already configured (or ask the user if they want to overwrite).

### Step 3 — Install the integration files

Create only the files for the tools the user selected. Use the exact content below for each tool.

---

## Integration File Content

### Claude Code — `.claude/commands/cloud-infra.md`

```bash
mkdir -p .claude/commands
curl -fsSL https://raw.githubusercontent.com/sgr0691/sandman/main/.claude/commands/cloud-infra.md \
  -o .claude/commands/cloud-infra.md
```

Or write the file directly using the content from this project's `.claude/commands/cloud-infra.md`.

---

### Cursor — `.cursor/rules/sandman.mdc`

```bash
mkdir -p .cursor/rules
curl -fsSL https://raw.githubusercontent.com/sgr0691/sandman/main/.cursor/rules/sandman.mdc \
  -o .cursor/rules/sandman.mdc
```

Or write the file directly using the content from this project's `.cursor/rules/sandman.mdc`.

---

### GitHub Copilot — `.github/copilot-instructions.md`

```bash
mkdir -p .github
curl -fsSL https://raw.githubusercontent.com/sgr0691/sandman/main/.github/copilot-instructions.md \
  -o .github/copilot-instructions.md
```

**Note**: If `.github/copilot-instructions.md` already exists with other content, append the Sandman section rather than overwriting. Check first:
```bash
cat .github/copilot-instructions.md 2>/dev/null
```

---

### Windsurf — `.windsurf/rules/sandman.md`

```bash
mkdir -p .windsurf/rules
curl -fsSL https://raw.githubusercontent.com/sgr0691/sandman/main/.windsurf/rules/sandman.md \
  -o .windsurf/rules/sandman.md
```

Or write the file directly using the content from this project's `.windsurf/rules/sandman.md`.

---

### Aider — `.aider.instructions.md`

Write the following file at `.aider.instructions.md` in the project root:

```markdown
# Sandman — Disposable Cloud Environments

This project uses **Sandman** to provision disposable cloud environments.

## CLI Commands
sandman init <provider> [--json]
sandman create <name> -p <provider> [--dry-run] [--json]
sandman enable <service1> [service2...] -e <name> [--json]
sandman list [--json]
sandman status <name> [--json]
sandman connect <name> [--json]
sandman destroy <name> [-y] [--json]

## Providers: aws | gcp | cloudflare | vercel
## Services: ec2, s3, lambda, iam (AWS) | compute, storage, cloudrun, iam, pubsub (GCP) | workers, pages, r2, kv, d1 (Cloudflare) | functions, edge, blob, postgres (Vercel)

Always use --json. Check `sandman list --json` before creating. Remind user to destroy after use.
```

---

### Continue — `.continue/sandman.prompt`

Write the following file at `.continue/sandman.prompt`:

```
name: Sandman Cloud Setup
description: Provision disposable cloud environments with Sandman

<system>
You are a cloud infrastructure assistant. Use the Sandman CLI to provision disposable environments.

Commands: sandman init|create|enable|list|status|connect|destroy — all support --json.
Providers: aws, gcp, cloudflare, vercel.
Workflow: list → init (if needed) → create → enable → connect.
Always use --json. Always remind the user to run sandman destroy <name> when done.
</system>
```

---

## Step 4 — Confirm and guide the user

After writing the files, tell the user:
1. Which files were created or updated
2. How to use Sandman in each tool (the trigger phrase or command)
3. Whether they need to restart the tool for changes to take effect

### Usage after setup

| Tool | How to invoke |
|---|---|
| **Claude Code** | `/cloud-infra set up an AWS environment with S3` |
| **Cursor** | Chat: `set up an AWS sandbox with S3 and Lambda` (rule auto-applies) |
| **GitHub Copilot** | Copilot Chat: `@workspace set up a Cloudflare environment with Workers` |
| **Windsurf** | Chat: `spin up a Vercel environment with Postgres` (rule auto-applies) |
| **Aider** | Just ask: `set up an AWS sandbox` (instructions are always in context) |
| **Continue** | Use the "Sandman Cloud Setup" prompt from the prompt library |

---

## Response Guidelines

1. **Be specific about what was installed** — list each file path created.
2. **Don't overwrite existing files silently** — check first, then ask or append.
3. **Detect before asking** — run the detection commands and present findings before asking which tools to configure.
4. **If the user's tool isn't listed** — ask them which tool they use and generate a minimal instructions file for it with the Sandman CLI reference and workflow.

$ARGUMENTS
