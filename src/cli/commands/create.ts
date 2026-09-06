import chalk from "chalk";
import ora from "ora";
import { StateStore } from "../../core/state-store.js";
import { getAdapter } from "../../providers/index.js";
import {
  experimentalWarning,
  parseProvider,
} from "../../providers/catalog.js";
import {
  calculateEstimate,
  formatHourlyRate,
} from "../../utils/cost-estimator.js";
import { emitErr, emitOk, mapThrownError } from "../output.js";
import { ENV_NAME_HINT, isValidEnvName } from "../env-name.js";

interface CreateParams {
  dryRun?: boolean;
  json?: boolean;
}

export async function createEnvironment(
  name: string,
  options: { provider?: string; region?: string },
  store: StateStore,
  params: CreateParams,
): Promise<void> {
  if (!isValidEnvName(name)) {
    emitErr(params.json, {
      code: "INVALID_NAME",
      error: `Invalid environment name "${name}".`,
      hint: ENV_NAME_HINT,
    });
  }

  const providerConfig = await store.getProvider();
  const rawProvider = options.provider || providerConfig.provider;
  const providerType = rawProvider
    ? parseProvider(String(rawProvider))
    : undefined;

  if (rawProvider && !providerType) {
    emitErr(params.json, {
      code: "INVALID_PROVIDER",
      error: `Unknown provider "${rawProvider}".`,
      hint: 'Use "sandman providers" to see supported providers.',
      next: ["sandman providers --json"],
    });
  }

  if (!providerType) {
    emitErr(
      params.json,
      {
        code: "NO_PROVIDER",
        error: "No provider specified. Run \"sandman init <provider>\" first.",
        next: ["sandman init aws", "sandman init gcp", "sandman providers --json"],
      },
      () => {
        console.log(chalk.red("Error: No provider specified."));
        console.log(
          chalk.gray('Run "sandman init aws" or "sandman init gcp" first.'),
        );
      },
    );
  }

  const existing = await store.getEnvironment(name);
  if (existing) {
    emitErr(params.json, {
      code: "ALREADY_EXISTS",
      error: `Environment "${name}" already exists.`,
      next: [`sandman status ${name}`, `sandman destroy ${name}`],
    });
  }

  const warning = experimentalWarning(providerType);
  const region = options.region || providerConfig.region || "default";

  if (params.dryRun) {
    const dryRunResult = {
      dryRun: true,
      name,
      provider: providerType,
      region,
      ...(warning ? { warning } : {}),
    };
    emitOk(params.json, dryRunResult, () => {
      console.log(chalk.cyan("[DRY RUN] Would create:"));
      console.log(chalk.gray(`  - Environment: ${name}`));
      console.log(chalk.gray(`  - Provider: ${providerType}`));
      console.log(chalk.gray(`  - Region: ${region}`));
      if (warning) {
        console.log(chalk.yellow(`  - Warning: ${warning}`));
      }
    });
    return;
  }

  const costEstimate = calculateEstimate(providerType, []);
  const costDisplay = formatHourlyRate(costEstimate.hourlyRate);

  if (!params.json) {
    console.log(
      chalk.blue(`\nCreating environment "${name}" on ${providerType}...`),
    );
    console.log(chalk.yellow(`⚠ Estimated cost: ${costDisplay}`));
    console.log(
      chalk.gray(
        '⚠ Run "sandman destroy ' +
          name +
          '" when finished to avoid ongoing charges\n',
      ),
    );
    if (warning) {
      console.log(chalk.yellow(`⚠ ${warning}\n`));
    }
  }

  const spinner = params.json ? null : ora("Creating environment...").start();

  try {
    const adapter = getAdapter(providerType);
    const env = await adapter.createEnvironment(name);

    await store.saveEnvironment(env);

    emitOk(
      params.json,
      {
        environment: env,
        ...(warning ? { warning } : {}),
      },
      () => {
        spinner!.succeed(
          chalk.green(`Environment "${name}" created successfully!`),
        );
        if (warning) {
          console.log(chalk.yellow(`⚠ ${warning}`));
        }
        console.log(chalk.cyan(`\n→ Run "sandman status ${name}" to see details`));
        console.log(
          chalk.cyan(
            `→ Run "sandman enable <services> -e ${name}" to enable services`,
          ),
        );
      },
    );
  } catch (error: unknown) {
    spinner?.fail?.(chalk.red("Failed to create environment"));
    const mapped = mapThrownError(error);
    emitErr(
      params.json,
      {
        ...mapped,
        hint: 'Partial cloud resources may exist. Run "sandman status" / "sandman destroy" after fixing the issue.',
      },
      () => {
        console.log(chalk.red(`Error: ${mapped.error}`));
      },
    );
  }
}

