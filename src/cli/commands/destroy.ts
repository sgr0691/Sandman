import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { ProviderType } from '../../types/index.js';
import { getAdapter } from '../../providers/index.js';

interface DestroyParams {
  confirmed: boolean;
  json?: boolean;
}

export async function destroyEnvironment(
  name: string,
  store: StateStore,
  params: DestroyParams = { confirmed: false }
): Promise<void> {
  const env = await store.getEnvironment(name);

  if (!env) {
    if (params.json) {
      console.log(JSON.stringify({ success: false, error: `Environment "${name}" not found.` }));
      process.exit(1);
    }
    console.log(chalk.red(`Environment "${name}" not found.`));
    process.exit(1);
  }

  if (!params.confirmed) {
    console.log(chalk.yellow(`\n⚠️  This will destroy environment "${name}" on ${env.provider}.`));
    console.log(chalk.gray('All resources will be permanently deleted.\n'));

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(chalk.yellow('Are you sure? (yes/no): '), (ans) => {
        rl.close();
        resolve(ans.toLowerCase());
      });
    });

    if (answer !== 'yes' && answer !== 'y') {
      console.log(chalk.gray('Destroy cancelled.'));
      return;
    }
  }

  const spinner = params.json ? null : ora(`Destroying environment "${name}"...`).start();

  try {
    const adapter = getAdapter(env.provider as ProviderType);
    await adapter.destroyEnvironment(env);

    const now = new Date().toISOString();
    env.status = 'destroyed';
    env.updatedAt = now;

    await store.saveEnvironment(env);

    if (params.json) {
      console.log(JSON.stringify({ success: true, name, status: 'destroyed' }));
      return;
    }

    spinner!.succeed(chalk.green(`✓ Environment "${name}" destroyed.`));
    console.log(chalk.gray('Cloud resources cleaned up.'));
  } catch (error: any) {
    if (params.json) {
      console.log(JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    }
    spinner!.fail(chalk.red('Failed to destroy environment'));
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
