import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { configureAdapter, getAdapter } from '../../providers/index.js';
import { experimentalWarning, parseProvider } from '../../providers/catalog.js';
import { emitErr, emitOk, mapThrownError } from '../output.js';

interface InitOptions {
  json?: boolean;
  billingAccount?: string;
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
  const requestedBilling =
    options.billingAccount || process.env.GCP_BILLING_ACCOUNT;
  const spinner = options.json ? null : ora(`Initializing ${providerType}...`).start();

  try {
    const adapter = getAdapter(providerType);
    await adapter.init();
    configureAdapter(adapter, {
      region,
      billingAccount: requestedBilling,
    });

    let billingAccount = requestedBilling;
    if (typeof adapter.discoverBillingAccount === "function") {
      billingAccount =
        (await adapter.discoverBillingAccount()) || requestedBilling;
    }

    await store.setProvider(providerType, region, billingAccount);

    const billingWarning =
      providerType === "gcp" && !billingAccount
        ? "No GCP billing account resolved. Create will save the project as failed until you pass --billing-account or set GCP_BILLING_ACCOUNT."
        : undefined;

    emitOk(
      options.json,
      {
        provider: providerType,
        region: region || null,
        billingAccount: billingAccount || null,
        ...(warning ? { warning } : {}),
        ...(billingWarning ? { billingWarning } : {}),
      },
      () => {
        spinner!.succeed(chalk.green(`✓ ${providerType} initialized successfully`));
        console.log(chalk.gray(`Default region: ${region || 'not set'}`));
        console.log(chalk.gray(`Billing account: ${billingAccount || 'not set'}`));
        if (warning) {
          console.log(chalk.yellow(`⚠ ${warning}`));
        }
        if (billingWarning) {
          console.log(chalk.yellow(`⚠ ${billingWarning}`));
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
