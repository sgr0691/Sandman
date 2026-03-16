import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { ServiceName } from '../../types/index.js';
import { AwsAdapter } from '../../providers/aws/adapter.js';
import { GcpAdapter } from '../../providers/gcp/adapter.js';
import { ProviderAdapter } from '../../providers/base.js';

const VALID_SERVICES: Record<string, string[]> = {
  gcp: ['compute', 'storage', 'cloudrun', 'iam'],
  aws: ['ec2', 's3', 'lambda', 'iam'],
};

export async function enableServices(
  servicesInput: ServiceName[],
  environmentName: string | undefined,
  store: StateStore
): Promise<void> {
  let env;

  if (environmentName) {
    env = await store.getEnvironment(environmentName);
    if (!env) {
      console.log(chalk.red(`Environment "${environmentName}" not found.`));
      process.exit(1);
    }
  } else {
    const environments = await store.listEnvironments();
    const active = environments.filter(e => e.status === 'active');
    if (active.length === 0) {
      console.log(chalk.red('No active environments found.'));
      process.exit(1);
    }
    if (active.length > 1) {
      console.log(chalk.yellow('Multiple environments found. Specify one:'));
      for (const e of active) {
        console.log(chalk.gray(`  - ${e.name}`));
      }
      process.exit(1);
    }
    env = active[0];
  }

  const validServices = VALID_SERVICES[env.provider];
  const invalid = servicesInput.filter(s => !validServices.includes(s));
  
  if (invalid.length > 0) {
    console.log(chalk.red(`Invalid services for ${env.provider}: ${invalid.join(', ')}`));
    console.log(chalk.gray(`Valid services: ${validServices.join(', ')}`));
    process.exit(1);
  }

  const spinner = ora(`Enabling services on ${env.name}...`).start();

  try {
    const adapter: ProviderAdapter = env.provider === 'aws' 
      ? new AwsAdapter() 
      : new GcpAdapter();
    
    await adapter.enableServices(env, servicesInput);

    const now = new Date().toISOString();
    env.services = [...new Set([...env.services, ...servicesInput])];
    env.updatedAt = now;
    
    await store.saveEnvironment(env);

    spinner.succeed(chalk.green(`✓ Services enabled: ${servicesInput.join(', ')}`));
  } catch (error: any) {
    spinner.fail(chalk.red('Failed to enable services'));
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
