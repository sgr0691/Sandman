import chalk from 'chalk';
import { StateStore } from '../../core/state-store.js';
import { emitOk } from '../output.js';

interface ListOptions {
  json?: boolean;
}

export async function listEnvironments(store: StateStore, options: ListOptions = {}): Promise<void> {
  const environments = await store.listEnvironments();

  // Preserve the historical --json contract: a raw array of environments.
  if (options.json) {
    console.log(JSON.stringify(environments, null, 2));
    return;
  }

  emitOk(false, { environments }, () => {
    if (environments.length === 0) {
      console.log(chalk.yellow('No environments found.'));
      console.log(chalk.gray('Run "sandman create <name>" to create one.'));
      return;
    }

    console.log(chalk.bold('\nEnvironments:\n'));

    for (const env of environments) {
      const statusColor = env.status === 'active' ? chalk.green :
                          env.status === 'failed' ? chalk.red :
                          chalk.gray;

      console.log(`  ${chalk.bold(env.name)}`);
      console.log(`    Provider: ${env.provider}`);
      console.log(`    Status: ${statusColor(env.status)}`);
      console.log(`    Created: ${new Date(env.createdAt).toLocaleString()}`);
      if (env.expiresAt) {
        console.log(`    Expires: ${new Date(env.expiresAt).toLocaleString()}${env.ttl ? ` (${env.ttl})` : ""}`);
      }
      if (env.services.length > 0) {
        console.log(`    Services: ${env.services.join(', ')}`);
      }
      console.log();
    }
  });
}
