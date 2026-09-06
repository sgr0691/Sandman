import { Command } from 'commander';
import { StateStore } from '../core/state-store.js';
import { listEnvironments } from './commands/list.js';
import { statusEnvironment } from './commands/status.js';
import { initProvider } from './commands/init.js';
import { createEnvironment } from './commands/create.js';
import { enableServices } from './commands/enable.js';
import { connectEnvironment } from './commands/connect.js';
import { destroyEnvironment } from './commands/destroy.js';
import { listProviders } from './commands/providers.js';
import { runCommand } from './output.js';

const program = new Command();
const store = new StateStore();

program
  .name('sandman')
  .description('Provision disposable cloud environments in seconds')
  .version('0.2.0');

program
  .command('init')
  .description('Initialize a cloud provider')
  .argument('<provider>', 'Provider to initialize: aws | gcp | cloudflare | vercel')
  .option('-r, --region <region>', 'Default region')
  .option('--json', 'Output as JSON')
  .action(async (provider: string, options: { region?: string; json?: boolean }) => {
    await runCommand(options.json, () =>
      initProvider(provider, options.region, store, { json: options.json }),
    );
  });

program
  .command('create')
  .description('Create a sandbox environment')
  .argument('<name>', 'Environment name (lowercase letters, digits, hyphens)')
  .option('-p, --provider <provider>', 'Cloud provider: aws | gcp | cloudflare | vercel')
  .option('-r, --region <region>', 'Region')
  .option('--dry-run', 'Preview actions without executing')
  .option('--json', 'Output as JSON')
  .action(async (name: string, options: { provider?: string; region?: string; dryRun?: boolean; json?: boolean }) => {
    await runCommand(options.json, () =>
      createEnvironment(
        name,
        { provider: options.provider, region: options.region },
        store,
        { dryRun: options.dryRun, json: options.json },
      ),
    );
  });

program
  .command('enable')
  .description('Enable services for an environment')
  .argument('<services...>', 'Services to enable')
  .option('-e, --environment <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (services: string[], options: { environment?: string; json?: boolean }) => {
    await runCommand(options.json, () =>
      enableServices(services, options.environment, store, { json: options.json }),
    );
  });

program
  .command('list')
  .description('List all environments')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    await runCommand(options.json, () => listEnvironments(store, options));
  });

program
  .command('status')
  .description('Show environment status')
  .argument('<name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (name: string, options: { json?: boolean }) => {
    await runCommand(options.json, () => statusEnvironment(name, store, options));
  });

program
  .command('connect')
  .description('Connect to an environment and output credentials')
  .argument('<name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .option('--show-secrets', 'Include secret values (tokens) in output')
  .action(async (name: string, options: { json?: boolean; showSecrets?: boolean }) => {
    await runCommand(options.json, () => connectEnvironment(name, store, options));
  });

program
  .command('destroy')
  .description('Destroy an environment')
  .argument('<name>', 'Environment name')
  .option('-y, --yes', 'Skip confirmation')
  .option('--json', 'Output as JSON')
  .action(async (name: string, options: { yes?: boolean; json?: boolean }) => {
    await runCommand(options.json, () =>
      destroyEnvironment(name, store, { confirmed: options.yes ?? false, json: options.json }),
    );
  });

program
  .command('providers')
  .description('List supported providers and their maturity')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    await runCommand(options.json, () => listProviders(options));
  });

export { program, store };
