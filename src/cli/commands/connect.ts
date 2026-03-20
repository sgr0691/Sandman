import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { ProviderType } from '../../types/index.js';
import { getAdapter } from '../../providers/index.js';

interface ConnectOptions {
  json?: boolean;
}

export async function connectEnvironment(
  name: string,
  store: StateStore,
  options: ConnectOptions = {}
): Promise<void> {
  const env = await store.getEnvironment(name);

  if (!env) {
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: `Environment "${name}" not found.` }));
      process.exit(1);
    }
    console.log(chalk.red(`Environment "${name}" not found.`));
    process.exit(1);
  }

  if (!options.json && env.status !== 'active') {
    console.log(chalk.yellow(`Environment "${name}" is not active (status: ${env.status}).`));
  }

  const spinner = options.json ? null : ora(`Connecting to ${name}...`).start();

  try {
    const adapter = getAdapter(env.provider as ProviderType);
    const credentials = await adapter.connect(env);

    spinner?.stop();

    if (options.json) {
      console.log(JSON.stringify({ success: true, credentials }));
      return;
    }

    console.log(chalk.bold(`\nConnecting to environment: ${name}\n`));

    if (env.provider === 'gcp') {
      console.log(chalk.gray('# GCP Configuration'));
      if (credentials.GCP_PROJECT) {
        console.log(`export GCP_PROJECT=${credentials.GCP_PROJECT}`);
      }
      console.log(chalk.gray('\n# Use with gcloud:'));
      console.log(chalk.cyan(`gcloud config set project ${credentials.GCP_PROJECT || '<project-id>'}`));
      console.log(chalk.cyan('gcloud auth application-default login'));
    } else if (env.provider === 'aws') {
      console.log(chalk.gray('# AWS Configuration'));
      if (credentials.AWS_ACCOUNT_ID) {
        console.log(`export AWS_ACCOUNT_ID=${credentials.AWS_ACCOUNT_ID}`);
      }
      if (credentials.AWS_REGION) {
        console.log(`export AWS_REGION=${credentials.AWS_REGION}`);
      }
      console.log(chalk.gray('\n# Use with AWS CLI:'));
      console.log(chalk.cyan('aws configure'));
    }

    console.log(chalk.gray('\n# Copy to .env:'));
    console.log(chalk.cyan('SANDMAN_ENV=' + name));
    for (const [key, value] of Object.entries(credentials)) {
      if (key !== 'provider') {
        console.log(chalk.cyan(`${key}=${value}`));
      }
    }

    console.log(chalk.green('\n✓ Environment configured'));
  } catch (error: any) {
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    }
    spinner?.fail?.(chalk.red('Failed to connect'));
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
