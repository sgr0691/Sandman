import chalk from "chalk";
import ora from "ora";
import { StateStore } from "../../core/state-store.js";
import { configureAdapter, getAdapter } from "../../providers/index.js";
import {
  experimentalWarning,
  parseProvider,
} from "../../providers/catalog.js";
import {
  calculateEstimate,
  defaultCreateServices,
  formatHourlyRate,
} from "../../utils/cost-estimator.js";
import { TTL_HINT, expiresAtFromTtl } from "../../utils/ttl.js";
import { emitErr, emitOk, mapThrownError } from "../output.js";
import { ENV_NAME_HINT, isValidEnvName } from "../env-name.js";

interface CreateParams {
  dryRun?: boolean;
  json?: boolean;
  strict?: boolean;
}

export async function createEnvironment(
  name: string,
  options: {
    provider?: string;
    region?: string;
    billingAccount?: string;
    ttl?: string;
  },
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
  if (existing && existing.status !== "destroyed") {
    emitErr(params.json, {
      code: "ALREADY_EXISTS",
      error: `Environment "${name}" already exists.`,
      next: [`sandman status ${name}`, `sandman destroy ${name}`],
    });
  }

  let ttlInfo: { expiresAt: string; ttl: string } | undefined;
  if (options.ttl) {
    try {
      ttlInfo = expiresAtFromTtl(options.ttl);
    } catch (error: unknown) {
      emitErr(params.json, {
        code: "INVALID_TTL",
        error: error instanceof Error ? error.message : String(error),
        hint: TTL_HINT,
      });
    }
  }

  const warning = experimentalWarning(providerType);
  const requestedRegion = options.region || providerConfig.region;
  const region = requestedRegion || "default";
  const requestedBilling =
    options.billingAccount ||
    providerConfig.billingAccount ||
    process.env.GCP_BILLING_ACCOUNT;

  if (params.dryRun) {
    const dryRunResult = {
      dryRun: true,
      name,
      provider: providerType,
      region,
      ...(requestedBilling ? { billingAccount: requestedBilling } : {}),
      ...(ttlInfo ? { ttl: ttlInfo.ttl, expiresAt: ttlInfo.expiresAt } : {}),
      ...(params.strict ? { strict: true } : {}),
      ...(warning ? { warning } : {}),
    };
    emitOk(params.json, dryRunResult, () => {
      console.log(chalk.cyan("[DRY RUN] Would create:"));
      console.log(chalk.gray(`  - Environment: ${name}`));
      console.log(chalk.gray(`  - Provider: ${providerType}`));
      console.log(chalk.gray(`  - Region: ${region}`));
      if (requestedBilling) {
        console.log(chalk.gray(`  - Billing: ${requestedBilling}`));
      }
      if (ttlInfo) {
        console.log(chalk.gray(`  - TTL: ${ttlInfo.ttl} (expires ${ttlInfo.expiresAt})`));
      }
      if (warning) {
        console.log(chalk.yellow(`  - Warning: ${warning}`));
      }
    });
    return;
  }

  const costEstimate = calculateEstimate(
    providerType,
    defaultCreateServices(providerType),
  );
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
    if (ttlInfo) {
      console.log(chalk.gray(`TTL ${ttlInfo.ttl}; expires ${ttlInfo.expiresAt}`));
    }
    if (warning) {
      console.log(chalk.yellow(`⚠ ${warning}\n`));
    }
  }

  const spinner = params.json ? null : ora("Creating environment...").start();

  try {
    const adapter = getAdapter(providerType);
    await adapter.init();
    configureAdapter(adapter, {
      region: requestedRegion,
      billingAccount: requestedBilling,
    });
    const env = await adapter.createEnvironment(name);
    if (requestedRegion && !env.region) {
      env.region = requestedRegion;
    }
    if (ttlInfo) {
      env.ttl = ttlInfo.ttl;
      env.expiresAt = ttlInfo.expiresAt;
    }

    await store.saveEnvironment(env);

    const warnings: string[] = [];
    if (warning) warnings.push(warning);
    if (env.status === "failed" && env.error) warnings.push(env.error);
    const partial = env.status === "failed";
    const payload = {
      environment: env,
      ...(warning ? { warning } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(partial ? { partial: true } : {}),
    };

    if (partial && params.strict) {
      emitErr(
        params.json,
        {
          code: "PARTIAL",
          error:
            env.error ||
            `Environment "${name}" was created with partial or unlinkable resources.`,
          ...payload,
          hint: "Pass without --strict to record the failure and continue. Destroy leftovers before recreating.",
          next: [
            `sandman destroy ${name} -y --json`,
            `sandman status ${name} --json`,
          ],
        },
        () => {
          spinner?.fail?.(
            chalk.red(
              `Environment "${name}" was saved as failed (partial resources).`,
            ),
          );
          if (env.error) {
            console.log(chalk.red(`Error: ${env.error}`));
          }
          console.log(
            chalk.cyan(`\n→ Run "sandman status ${name}" to see what was created`),
          );
          console.log(
            chalk.cyan(
              `→ Run "sandman destroy ${name}" to clean up partial resources`,
            ),
          );
        },
      );
    }

    emitOk(params.json, payload, () => {
      if (partial) {
        spinner!.warn(
          chalk.yellow(
            `Environment "${name}" was saved as failed (partial resources).`,
          ),
        );
        if (env.error) {
          console.log(chalk.red(`Error: ${env.error}`));
        }
        console.log(
          chalk.cyan(`\n→ Run "sandman status ${name}" to see what was created`),
        );
        console.log(
          chalk.cyan(
            `→ Run "sandman destroy ${name}" to clean up partial resources`,
          ),
        );
        if (!params.strict) {
          console.log(
            chalk.gray('→ Agents: pass --strict to exit non-zero on failed creates'),
          );
        }
        return;
      }
      spinner!.succeed(
        chalk.green(`Environment "${name}" created successfully!`),
      );
      if (warning) {
        console.log(chalk.yellow(`⚠ ${warning}`));
      }
      if (ttlInfo) {
        console.log(
          chalk.gray(
            `Expires ${ttlInfo.expiresAt}. Status/connect/enable will reap it after TTL.`,
          ),
        );
      }
      console.log(chalk.cyan(`\n→ Run "sandman status ${name}" to see details`));
      console.log(
        chalk.cyan(
          `→ Run "sandman enable <services> -e ${name}" to enable services`,
        ),
      );
    });
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
