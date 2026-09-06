import chalk from "chalk";
import ora from "ora";
import { StateStore } from "../../core/state-store.js";
import { ServiceName } from "../../types/index.js";
import { getAdapter } from "../../providers/index.js";
import { SERVICES_BY_PROVIDER } from "../../providers/catalog.js";
import { emitErr, emitOk, mapThrownError } from "../output.js";

interface EnableOptions {
  json?: boolean;
}

export async function enableServices(
  servicesInput: string[],
  environmentName: string | undefined,
  store: StateStore,
  options: EnableOptions = {}
): Promise<void> {
  let env;

  if (environmentName) {
    env = await store.getEnvironment(environmentName);
    if (!env) {
      emitErr(options.json, {
        code: "NOT_FOUND",
        error: `Environment "${environmentName}" not found.`,
        next: ["sandman list --json"],
      });
    }
  } else {
    const environments = await store.listEnvironments();
    const active = environments.filter((e) => e.status === "active");
    if (active.length === 0) {
      emitErr(options.json, {
        code: "NOT_FOUND",
        error: "No active environments found.",
        next: ["sandman create <name> --provider aws"],
      });
    }
    if (active.length > 1) {
      emitErr(
        options.json,
        {
          code: "AMBIGUOUS",
          error: "Multiple environments found. Specify one with -e.",
          environments: active.map((e) => e.name),
          hint: "Pass -e <name> to choose an environment.",
        },
        () => {
          console.log(chalk.yellow("Multiple environments found. Specify one:"));
          for (const e of active) {
            console.log(chalk.gray(`  - ${e.name}`));
          }
        },
      );
    }
    env = active[0];
  }

  const validServices = SERVICES_BY_PROVIDER[env.provider] ?? [];
  const invalid = servicesInput.filter((s) => !validServices.includes(s));

  if (invalid.length > 0) {
    emitErr(
      options.json,
      {
        code: "INVALID_SERVICE",
        error: `Invalid services for ${env.provider}: ${invalid.join(", ")}`,
        validServices,
      },
      () => {
        console.log(chalk.red(`Invalid services for ${env.provider}: ${invalid.join(", ")}`));
        console.log(chalk.gray(`Valid services: ${validServices.join(", ")}`));
      },
    );
  }

  const spinner = options.json ? null : ora(`Enabling services on ${env.name}...`).start();

  try {
    const adapter = getAdapter(env.provider);
    await adapter.enableServices(env, servicesInput as ServiceName[]);

    const now = new Date().toISOString();
    env.services = [...new Set([...env.services, ...(servicesInput as ServiceName[])])];
    env.updatedAt = now;

    await store.saveEnvironment(env);

    emitOk(
      options.json,
      { environment: env.name, services: env.services },
      () => {
        spinner!.succeed(chalk.green(`✓ Services enabled: ${servicesInput.join(", ")}`));
      },
    );
  } catch (error: unknown) {
    spinner?.fail?.(chalk.red("Failed to enable services"));
    const mapped = mapThrownError(error);
    emitErr(options.json, mapped, () => {
      console.log(chalk.red(`Error: ${mapped.error}`));
    });
  }
}
