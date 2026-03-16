import chalk from 'chalk';
import { StateStore } from '../../core/state-store.js';
import { EnvironmentRecord } from '../../types/index.js';

const COST_ESTIMATES: Record<string, { hourly: string; description: string }> = {
  gcp: { hourly: '~$0.01-0.05/hour', description: 'Project base + APIs enabled' },
  aws: { hourly: '~$0.01-0.10/hour', description: 'S3 storage + Lambda requests' },
};

interface StatusOptions {
  json?: boolean;
}

export async function statusEnvironment(
  name: string,
  store: StateStore,
  options: StatusOptions = {}
): Promise<void> {
  const env = await store.getEnvironment(name);

  if (!env) {
    console.log(chalk.red(`Environment "${name}" not found.`));
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(env, null, 2));
    return;
  }

  const cost = COST_ESTIMATES[env.provider] || { hourly: 'Unknown', description: '' };
  const age = Date.now() - new Date(env.createdAt).getTime();
  const hours = Math.floor(age / (1000 * 60 * 60));
  const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));

  console.log(chalk.bold(`\nEnvironment: ${env.name}\n`));
  console.log(`  ${chalk.gray('Provider:')} ${env.provider}`);
  console.log(`  ${chalk.gray('Status:')} ${env.status === 'active' ? chalk.green(env.status) : chalk.red(env.status)}`);
  console.log(`  ${chalk.gray('Created:')} ${new Date(env.createdAt).toLocaleString()}`);
  console.log(`  ${chalk.gray('Age:')} ${hours}h ${minutes}m`);
  
  if (env.projectId) {
    console.log(`  ${chalk.gray('Project ID:')} ${env.projectId}`);
  }
  if (env.accountId) {
    console.log(`  ${chalk.gray('Account ID:')} ${env.accountId}`);
  }
  if (env.region) {
    console.log(`  ${chalk.gray('Region:')} ${env.region}`);
  }
  
  if (env.services.length > 0) {
    console.log(`  ${chalk.gray('Services:')} ${env.services.join(', ')}`);
  }

  const resourceCount = Object.keys(env.resources).length;
  if (resourceCount > 0) {
    console.log(`  ${chalk.gray('Resources:')} ${resourceCount} created`);
  }

  console.log(`\n  ${chalk.gray('Est. cost:')} ${cost.hourly}`);
  console.log(chalk.gray(`  ${cost.description}`));

  if (env.error) {
    console.log(`\n  ${chalk.red('Error:')} ${env.error}`);
  }

  console.log(chalk.cyan(`\n→ Run "sandman connect ${name}" to get credentials`));
  console.log(chalk.cyan(`→ Run "sandman destroy ${name}" to clean up`));
}
