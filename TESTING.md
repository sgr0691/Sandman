# Testing Guide

This guide walks through testing the Sandman CLI locally before publishing.

## Prerequisites

- Node.js 18+
- For AWS: AWS credentials configured (`aws configure`)
- For GCP: gcloud authenticated (`gcloud auth application-default login`)

## Test Workflow

### Step 1: Initialize a Provider

```bash
# Test AWS initialization
node dist/index.js init aws

# Test GCP initialization
node dist/index.js init gcp
```

**Expected output:**

- Spinner showing "Initializing..."
- Success message or authentication error (expected if no credentials)

### Step 2: Create an Environment (Dry Run)

```bash
# Test with dry-run (no cloud resources created)
node dist/index.js create test-env --dry-run
```

**Expected output:**

- "[DRY RUN] Would create:" message
- Environment name, provider, region

### Step 3: List Environments

```bash
node dist/index.js list
node dist/index.js list --json
```

**Expected output:**

- Empty list message or list of environments
- JSON output with --json flag

### Step 4: Create a Real Environment

```bash
# AWS (requires credentials)
node dist/index.js create demo-aws -p aws

# GCP (requires credentials)
node dist/index.js create demo-gcp -p gcp
```

**Expected output:**

- Cost warning
- Spinner during creation
- Success message with next steps

### Step 5: Check Status

```bash
node dist/index.js status demo-aws
node dist/index.js status demo-aws --json
```

**Expected output:**

- Provider, status, age, estimated cost
- JSON output with --json flag

### Step 6: Enable Services

```bash
# AWS services
node dist/index.js enable s3 lambda -e demo-aws

# GCP services
node dist/index.js enable compute storage -e demo-gcp
```

**Expected output:**

- Service enabling progress
- Success message

### Step 7: Connect to Environment

```bash
node dist/index.js status demo-aws
```

**Expected output:**

- Environment variables to export
- gcloud/aws CLI commands

### Step 8: Destroy Environment

```bash
# With confirmation
node dist/index.js destroy demo-aws

# Skip confirmation
node dist/index.js destroy demo-aws -y
```

**Expected output:**

- Confirmation prompt (unless -y)
- Destruction progress
- Success message

## Local Link Testing

```bash
# Link globally
npm link

# Now you can use 'sandman' command
sandman --help
sandman init aws
sandman list

# Unlink when done
npm unlink -g sandman
```
