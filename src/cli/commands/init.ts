import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { getAdapter } from '../../providers/index.js';
import { experimentalWarning, parseProvider } from '../../providers/catalog.js';
import { emitErr, emitOk, mapThrownError } from '../output.js';

interface InitOptions {
  json?: boolean;
}

export async function initProvider(
  providerInput: string,
  region: string | undefined,
  store: StateStore,
  options: InitOptions = {}
): Promise<void> {
  const providerType = parseProvider(providerInput);
  if (!providerType) {
    emitErr(options.json, {
      code: 'INVALID_PROVIDER',
      error: `Unknown provider "${providerInput}".`,
      hint: 'Supported providers: aws, gcp (cloudflare and vercel are experimental).',
      next: ['sandman providers --json'],
    });
  }

  const warning = experimentalWarning(providerType);
  const spinner = options.json ? null : ora(`Initializing ${providerType}...`).start();

  try {
    const adapter = getAdapter(providerType);
    await adapter.init();

    await store.setProvider(providerType, region);

    emitOk(
      options.json,
      {
        provider: providerType,
        region: region || null,
        ...(warning ? { warning } : {}),
      },
      () => {
        spinner!.succeed(chalk.green(`✓ ${providerType} initialized successfully`));
        console.log(chalk.gray(`Default region: ${region || 'not set'}`));
        if (warning) {
          console.log(chalk.yellow(`⚠ ${warning}`));
        }
        console.log(chalk.cyan('\n→ Run "sandman create <name>" to create an environment'));
      },
    );
  } catch (error: unknown) {
    spinner?.fail?.(chalk.red(`Failed to initialize ${providerType}`));
    const mapped = mapThrownError(error);
    emitErr(options.json, { ...mapped, provider: providerType }, () => {
      console.log(chalk.red(`Error: ${mapped.error}`));
    });
  }
}
