import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { AwsAdapter } from '../../providers/aws/adapter.js';
import { GcpAdapter } from '../../providers/gcp/adapter.js';
import { CloudflareAdapter } from '../../providers/cloudflare/adapter.js';
import { VercelAdapter } from '../../providers/vercel/adapter.js';
import { ProviderAdapter } from '../../providers/base.js';
import { ProviderType } from '../../types/index.js';

interface InitOptions {
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

export async function initProvider(
  providerType: ProviderType,
  region: string | undefined,
  store: StateStore,
  options: InitOptions = {}
): Promise<void> {
  const spinner = options.json ? null : ora(`Initializing ${providerType}...`).start();

  try {
    const adapter = getAdapter(providerType);
    await adapter.init();

    await store.setProvider(providerType, region);

    if (options.json) {
      console.log(JSON.stringify({ success: true, provider: providerType, region: region || null }));
      return;
    }

    spinner!.succeed(chalk.green(`✓ ${providerType} initialized successfully`));
    console.log(chalk.gray(`Default region: ${region || 'not set'}`));

    if (providerType === 'gcp') {
      console.log(chalk.cyan('\n→ Run "sandman create <name>" to create an environment'));
    }
    if (providerType === 'cloudflare') {
      console.log(chalk.cyan('\n→ Run "sandman create <name>" to create an environment'));
    }
    if (providerType === 'vercel') {
      console.log(chalk.cyan('\n→ Run "sandman create <name>" to create an environment'));
    }
  } catch (error: any) {
    if (options.json) {
      console.log(JSON.stringify({ success: false, provider: providerType, error: error.message }));
      process.exit(1);
    }
    spinner!.fail(chalk.red(`Failed to initialize ${providerType}`));
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
