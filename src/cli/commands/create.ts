import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { CreateOptions } from '../../types/index.js';
import { AwsAdapter } from '../../providers/aws/adapter.js';
import { GcpAdapter } from '../../providers/gcp/adapter.js';
import { CloudflareAdapter } from '../../providers/cloudflare/adapter.js';
import { VercelAdapter } from '../../providers/vercel/adapter.js';
import { ProviderAdapter } from '../../providers/base.js';
import { ProviderType } from '../../types/index.js';

interface CreateParams {
  dryRun?: boolean;
  json?: boolean;
}

function getAdapter(providerType: ProviderType): ProviderAdapter {
  switch (providerType) {
    case 'aws': return new AwsAdapter();
    case 'gcp': return new GcpAdapter();
    case 'cloudflare': return new CloudflareAdapter();
    case 'vercel': return new VercelAdapter();
  }
}

export async function createEnvironment(
  name: string,
  options: CreateOptions,
  store: StateStore,
  params: CreateParams
): Promise<void> {
  const providerConfig = await store.getProvider();
  const providerType = (options.provider || providerConfig.provider) as ProviderType | undefined;

  if (!providerType) {
    if (params.json) {
      console.log(JSON.stringify({ success: false, error: 'No provider specified. Run "sandman init <provider>" first.' }));
      process.exit(1);
    }
    console.log(chalk.red('Error: No provider specified.'));
    console.log(chalk.gray('Run "sandman init aws", "sandman init gcp", "sandman init cloudflare", or "sandman init vercel" first.'));
    process.exit(1);
  }

  const existing = await store.getEnvironment(name);
  if (existing) {
    if (params.json) {
      console.log(JSON.stringify({ success: false, error: `Environment "${name}" already exists.` }));
      process.exit(1);
    }
    console.log(chalk.red(`Environment "${name}" already exists.`));
    process.exit(1);
  }

  if (params.dryRun) {
    const dryRunResult = {
      dryRun: true,
      name,
      provider: providerType,
      region: options.region || providerConfig.region || 'default',
    };
    if (params.json) {
      console.log(JSON.stringify(dryRunResult));
      return;
    }
    console.log(chalk.cyan('[DRY RUN] Would create:'));
    console.log(chalk.gray(`  - Environment: ${name}`));
    console.log(chalk.gray(`  - Provider: ${providerType}`));
    console.log(chalk.gray(`  - Region: ${dryRunResult.region}`));
    return;
  }

  if (!params.json) {
    console.log(chalk.blue(`\nCreating environment "${name}" on ${providerType}...`));
    console.log(chalk.yellow(`⚠ Estimated cost: ~$0.10/hour`));
    console.log(chalk.gray('⚠ Run "sandman destroy ' + name + '" when finished to avoid ongoing charges\n'));
  }

  const spinner = params.json ? null : ora('Creating environment...').start();

  try {
    const adapter = getAdapter(providerType);
    const env = await adapter.createEnvironment(name);

    await store.saveEnvironment(env);

    if (params.json) {
      console.log(JSON.stringify({ success: true, environment: env }));
      return;
    }

    spinner!.succeed(chalk.green(`Environment "${name}" created successfully!`));
    console.log(chalk.cyan(`\n→ Run "sandman status ${name}" to see details`));
    console.log(chalk.cyan(`→ Run "sandman enable <services> -e ${name}" to enable services`));
  } catch (error: any) {
    if (params.json) {
      console.log(JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    }
    spinner!.fail(chalk.red('Failed to create environment'));
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
