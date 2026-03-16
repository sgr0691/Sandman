import { Command } from 'commander';
import chalk from 'chalk';
import { StateStore } from '../core/state-store.js';
import { listEnvironments } from './commands/list.js';
import { statusEnvironment } from './commands/status.js';
import { initProvider } from './commands/init.js';
import { createEnvironment } from './commands/create.js';
import { enableServices } from './commands/enable.js';
import { connectEnvironment } from './commands/connect.js';
import { destroyEnvironment } from './commands/destroy.js';

const program = new Command();
const store = new StateStore();

program
  .name('sandman')
  .description('Provision disposable cloud environments in seconds')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a cloud provider')
  .argument('<provider>', 'Provider to initialize (aws or gcp)')
  .option('-r, --region <region>', 'Default region')
  .action(async (provider: string, options: { region?: string }) => {
    await initProvider(provider as 'aws' | 'gcp', options.region, store);
  });

program
  .command('create')
  .description('Create a sandbox environment')
  .argument('<name>', 'Environment name')
  .option('-p, --provider <provider>', 'Cloud provider (aws or gcp)')
  .option('-r, --region <region>', 'Region')
  .option('--dry-run', 'Preview actions without executing')
  .action(async (name: string, options: { provider?: string; region?: string; dryRun?: boolean }) => {
    await createEnvironment(
      name,
      { provider: options.provider as 'aws' | 'gcp', region: options.region },
      store,
      { dryRun: options.dryRun }
    );
  });

program
  .command('enable')
  .description('Enable services for an environment')
  .argument('<services...>', 'Services to enable')
  .option('-e, --environment <name>', 'Environment name')
  .action(async (services: string[], options: { environment?: string }) => {
    await enableServices(services as any[], options.environment, store);
  });

program
  .command('list')
  .description('List all environments')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    await listEnvironments(store, options);
  });

program
  .command('status')
  .description('Show environment status')
  .argument('<name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (name: string, options: { json?: boolean }) => {
    await statusEnvironment(name, store, options);
  });

program
  .command('connect')
  .description('Connect to an environment')
  .argument('<name>', 'Environment name')
  .action(async (name: string) => {
    await connectEnvironment(name, store);
  });

program
  .command('destroy')
  .description('Destroy an environment')
  .argument('<name>', 'Environment name')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (name: string, options: { yes?: boolean }) => {
    await destroyEnvironment(name, store, { confirmed: options.yes ?? false });
  });

export { program, store };
