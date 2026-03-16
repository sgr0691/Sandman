import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { AwsAdapter } from '../../providers/aws/adapter.js';
import { GcpAdapter } from '../../providers/gcp/adapter.js';
import { ProviderAdapter } from '../../providers/base.js';

export async function connectEnvironment(
  name: string,
  store: StateStore
): Promise<void> {
  const env = await store.getEnvironment(name);

  if (!env) {
    console.log(chalk.red(`Environment "${name}" not found.`));
    process.exit(1);
  }

  if (env.status !== 'active') {
    console.log(chalk.yellow(`Environment "${name}" is not active (status: ${env.status}).`));
  }

  const spinner = ora(`Connecting to ${name}...`).start();

  try {
    const adapter: ProviderAdapter = env.provider === 'aws' 
      ? new AwsAdapter() 
      : new GcpAdapter();
    
    const credentials = await adapter.connect(env);
    
    spinner.stop();

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
    if (credentials.GCP_PROJECT) {
      console.log(chalk.cyan('GCP_PROJECT=' + credentials.GCP_PROJECT));
    }
    if (credentials.AWS_ACCOUNT_ID) {
      console.log(chalk.cyan('AWS_ACCOUNT_ID=' + credentials.AWS_ACCOUNT_ID));
    }
    if (credentials.AWS_REGION) {
      console.log(chalk.cyan('AWS_REGION=' + credentials.AWS_REGION));
    }
    if (credentials.AWS_S3_BUCKET) {
      console.log(chalk.cyan('AWS_S3_BUCKET=' + credentials.AWS_S3_BUCKET));
    }

    console.log(chalk.green('\n✓ Environment configured'));
  } catch (error: any) {
    spinner?.fail?.(chalk.red('Failed to connect'));
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
