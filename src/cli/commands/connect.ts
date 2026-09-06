import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { getAdapter } from '../../providers/index.js';
import { emitErr, emitOk, mapThrownError } from '../output.js';
import { quoteEnvValue, redactSecrets } from '../secrets.js';

interface ConnectOptions {
  json?: boolean;
  showSecrets?: boolean;
}

export async function connectEnvironment(
  name: string,
  store: StateStore,
  options: ConnectOptions = {}
): Promise<void> {
  const env = await store.getEnvironment(name);

  if (!env) {
    emitErr(options.json, {
      code: 'NOT_FOUND',
      error: `Environment "${name}" not found.`,
      next: ['sandman list --json'],
    });
  }

  if (!options.json && env.status !== 'active') {
    console.log(chalk.yellow(`Environment "${name}" is not active (status: ${env.status}).`));
  }

  const spinner = options.json ? null : ora(`Connecting to ${name}...`).start();

  try {
    const adapter = getAdapter(env.provider);
    const rawCredentials = await adapter.connect(env);
    const { values: credentials, secretsRedacted } = redactSecrets(
      rawCredentials,
      options.showSecrets ?? false,
    );

    spinner?.stop();

    emitOk(
      options.json,
      { credentials, secretsRedacted },
      () => {
        console.log(chalk.bold(`\nConnecting to environment: ${name}\n`));

        if (env.provider === 'gcp') {
          console.log(chalk.gray('# GCP Configuration'));
          if (credentials.GCP_PROJECT) {
            console.log(`export GCP_PROJECT=${quoteEnvValue(credentials.GCP_PROJECT)}`);
          }
          console.log(chalk.gray('\n# Use with gcloud:'));
          console.log(chalk.cyan(`gcloud config set project ${credentials.GCP_PROJECT || '<project-id>'}`));
          console.log(chalk.cyan('gcloud auth application-default login'));
        } else if (env.provider === 'aws') {
          console.log(chalk.gray('# AWS Configuration'));
          if (credentials.AWS_ACCOUNT_ID) {
            console.log(`export AWS_ACCOUNT_ID=${quoteEnvValue(credentials.AWS_ACCOUNT_ID)}`);
          }
          if (credentials.AWS_REGION) {
            console.log(`export AWS_REGION=${quoteEnvValue(credentials.AWS_REGION)}`);
          }
          console.log(chalk.gray('\n# Use with AWS CLI:'));
          console.log(chalk.cyan('aws configure'));
        } else if (env.provider === 'cloudflare') {
          console.log(chalk.gray('# Cloudflare Configuration'));
          console.log(chalk.cyan('export CLOUDFLARE_API_TOKEN=<set in environment>'));
        } else if (env.provider === 'vercel') {
          console.log(chalk.gray('# Vercel Configuration'));
          console.log(chalk.cyan('export VERCEL_TOKEN=<set in environment>'));
        }

        console.log(chalk.gray('\n# Copy to .env:'));
        console.log(chalk.cyan(`SANDMAN_ENV=${quoteEnvValue(name)}`));
        for (const [key, value] of Object.entries(credentials)) {
          if (key !== 'provider') {
            console.log(chalk.cyan(`${key}=${quoteEnvValue(value)}`));
          }
        }

        if (secretsRedacted) {
          console.log(chalk.gray('\nSecrets redacted. Pass --show-secrets to print token values.'));
        }

        console.log(chalk.green('\n✓ Environment configured'));
      },
    );
  } catch (error: unknown) {
    spinner?.fail?.(chalk.red('Failed to connect'));
    const mapped = mapThrownError(error);
    emitErr(options.json, mapped, () => {
      console.log(chalk.red(`Error: ${mapped.error}`));
    });
  }
}
