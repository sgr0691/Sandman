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
import { ProviderType } from '../types/index.js';

const program = new Command();
const store = new StateStore();

program
  .name('sandman')
  .description('Provision disposable cloud environments in seconds')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a cloud provider')
  .argument('<provider>', 'Provider to initialize: aws | gcp')
  .option('-r, --region <region>', 'Default region')
  .option('--json', 'Output as JSON')
  .action(async (provider: string, options: { region?: string; json?: boolean }) => {
    await initProvider(provider as ProviderType, options.region, store, { json: options.json });
  });

program
  .command('create')
  .description('Create a sandbox environment')
  .argument('<name>', 'Environment name')
  .option('-p, --provider <provider>', 'Cloud provider: aws | gcp')
  .option('-r, --region <region>', 'Region')
  .option('--dry-run', 'Preview actions without executing')
  .option('--json', 'Output as JSON')
  .action(async (name: string, options: { provider?: string; region?: string; dryRun?: boolean; json?: boolean }) => {
    await createEnvironment(
      name,
      { provider: options.provider as ProviderType, region: options.region },
      store,
      { dryRun: options.dryRun, json: options.json }
    );
  });

program
  .command('enable')
  .description('Enable services for an environment')
  .argument('<services...>', 'Services to enable')
  .option('-e, --environment <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (services: string[], options: { environment?: string; json?: boolean }) => {
    await enableServices(services as any[], options.environment, store, { json: options.json });
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
  .description('Connect to an environment and output credentials')
  .argument('<name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (name: string, options: { json?: boolean }) => {
    await connectEnvironment(name, store, options);
  });

program
  .command('destroy')
  .description('Destroy an environment')
  .argument('<name>', 'Environment name')
  .option('-y, --yes', 'Skip confirmation')
  .option('--json', 'Output as JSON')
  .action(async (name: string, options: { yes?: boolean; json?: boolean }) => {
    await destroyEnvironment(name, store, { confirmed: options.yes ?? false, json: options.json });
  });

export { program, store };
