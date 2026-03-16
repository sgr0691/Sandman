import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { EnvironmentRecord, CreateOptions, ServiceName } from '../../types/index.js';
import { AwsAdapter } from '../../providers/aws/adapter.js';
import { GcpAdapter } from '../../providers/gcp/adapter.js';
import { ProviderAdapter } from '../../providers/base.js';

interface CreateParams {
  dryRun?: boolean;
}

export async function createEnvironment(
  name: string,
  options: CreateOptions,
  store: StateStore,
  params: CreateParams
): Promise<void> {
  const providerConfig = await store.getProvider();
  const providerType = options.provider || providerConfig.provider;
  
  if (!providerType) {
    console.log(chalk.red('Error: No provider specified.'));
    console.log(chalk.gray('Run "sandman init aws" or "sandman init gcp" first.'));
    process.exit(1);
  }

  const existing = await store.getEnvironment(name);
  if (existing) {
    console.log(chalk.red(`Environment "${name}" already exists.`));
    process.exit(1);
  }

  console.log(chalk.blue(`\nCreating environment "${name}" on ${providerType}...`));
  console.log(chalk.yellow(`⚠ Estimated cost: ~$0.10/hour`));
  console.log(chalk.gray('⚠ Run "sandman destroy ' + name + '" when finished to avoid ongoing charges\n'));

  if (params.dryRun) {
    console.log(chalk.cyan('[DRY RUN] Would create:'));
    console.log(chalk.gray(`  - Environment: ${name}`));
    console.log(chalk.gray(`  - Provider: ${providerType}`));
    console.log(chalk.gray(`  - Region: ${options.region || providerConfig.region || 'default'}`));
    return;
  }

  const spinner = ora('Creating environment...').start();

  try {
    const adapter: ProviderAdapter = providerType === 'aws' 
      ? new AwsAdapter() 
      : new GcpAdapter();
    
    const env = await adapter.createEnvironment(name);
    
    await store.saveEnvironment(env);
    
    spinner.succeed(chalk.green(`Environment "${name}" created successfully!`));
    console.log(chalk.cyan(`\n→ Run "sandman status ${name}" to see details`));
    console.log(chalk.cyan(`→ Run "sandman enable <services> -e ${name}" to enable services`));
  } catch (error: any) {
    spinner.fail(chalk.red('Failed to create environment'));
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
