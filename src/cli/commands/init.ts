import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { AwsAdapter } from '../../providers/aws/adapter.js';
import { GcpAdapter } from '../../providers/gcp/adapter.js';

export async function initProvider(
  providerType: 'aws' | 'gcp',
  region: string | undefined,
  store: StateStore
): Promise<void> {
  const spinner = ora(`Initializing ${providerType}...`).start();
  
  try {
    const adapter = providerType === 'aws' ? new AwsAdapter() : new GcpAdapter();
    
    await adapter.init();
    
    spinner.succeed(chalk.green(`✓ ${providerType} initialized successfully`));
    
    await store.setProvider(providerType, region);
    console.log(chalk.gray(`Default region: ${region || 'not set'}`));
    
    if (providerType === 'gcp') {
      console.log(chalk.cyan('\n→ Run "sandman create <name>" to create an environment'));
    }
  } catch (error: any) {
    spinner.fail(chalk.red(`Failed to initialize ${providerType}`));
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
