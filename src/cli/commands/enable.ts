import chalk from "chalk";
import ora from "ora";
import { StateStore } from "../../core/state-store.js";
import { ServiceName, ProviderType } from "../../types/index.js";
import { getAdapter } from "../../providers/index.js";

const VALID_SERVICES: Record<string, string[]> = {
  gcp: ["compute", "storage", "cloudrun", "iam", "pubsub", "container", "artifactregistry"],
  aws: ["ec2", "s3", "lambda", "iam"],
};

interface EnableOptions {
  json?: boolean;
}

export async function enableServices(
  servicesInput: ServiceName[],
  environmentName: string | undefined,
  store: StateStore,
  options: EnableOptions = {}
): Promise<void> {
  let env;

  if (environmentName) {
    env = await store.getEnvironment(environmentName);
    if (!env) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: `Environment "${environmentName}" not found.` }));
        process.exit(1);
      }
      console.log(chalk.red(`Environment "${environmentName}" not found.`));
      process.exit(1);
    }
  } else {
    const environments = await store.listEnvironments();
    const active = environments.filter((e) => e.status === "active");
    if (active.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: "No active environments found." }));
        process.exit(1);
      }
      console.log(chalk.red("No active environments found."));
      process.exit(1);
    }
    if (active.length > 1) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: "Multiple environments found. Specify one with -e.", environments: active.map(e => e.name) }));
        process.exit(1);
      }
      console.log(chalk.yellow("Multiple environments found. Specify one:"));
      for (const e of active) {
        console.log(chalk.gray(`  - ${e.name}`));
      }
      process.exit(1);
    }
    env = active[0];
  }

  const validServices = VALID_SERVICES[env.provider];
  const invalid = servicesInput.filter((s) => !validServices.includes(s));

  if (invalid.length > 0) {
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: `Invalid services for ${env.provider}: ${invalid.join(", ")}`, validServices }));
      process.exit(1);
    }
    console.log(chalk.red(`Invalid services for ${env.provider}: ${invalid.join(", ")}`));
    console.log(chalk.gray(`Valid services: ${validServices.join(", ")}`));
    process.exit(1);
  }

  const spinner = options.json ? null : ora(`Enabling services on ${env.name}...`).start();

  try {
    const adapter = getAdapter(env.provider as ProviderType);
    await adapter.enableServices(env, servicesInput);

    const now = new Date().toISOString();
    env.services = [...new Set([...env.services, ...servicesInput])];
    env.updatedAt = now;

    await store.saveEnvironment(env);

    if (options.json) {
      console.log(JSON.stringify({ success: true, environment: env.name, services: env.services }));
      return;
    }

    spinner!.succeed(chalk.green(`✓ Services enabled: ${servicesInput.join(", ")}`));
  } catch (error: any) {
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    }
    spinner!.fail(chalk.red("Failed to enable services"));
    console.log(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
