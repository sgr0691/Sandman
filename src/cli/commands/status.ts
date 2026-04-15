import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { EnvironmentRecord } from "../../types/index.js";
import {
  calculateRunningCost,
  formatCost,
  formatHourlyRate,
} from "../../utils/cost-estimator.js";

interface StatusOptions {
  json?: boolean;
}

export async function statusEnvironment(
  name: string,
  store: StateStore,
  options: StatusOptions = {},
): Promise<void> {
  const env = await store.getEnvironment(name);

  if (!env) {
    console.log(chalk.red(`Environment "${name}" not found.`));
    process.exit(1);
  }

  // Calculate running costs
  const runningCost = calculateRunningCost(
    env.provider,
    env.services,
    env.createdAt,
  );
  const age = Date.now() - new Date(env.createdAt).getTime();
  const hours = Math.floor(age / (1000 * 60 * 60));
  const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ...env,
          costEstimate: {
            hourlyRate: runningCost.hourlyRate,
            hoursRunning: runningCost.hoursRunning,
            totalCost: runningCost.totalCost,
            estimatedDaily: runningCost.estimatedDaily,
            estimatedMonthly: runningCost.estimatedMonthly,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(chalk.bold(`\nEnvironment: ${env.name}\n`));
  console.log(`  ${chalk.gray("Provider:")} ${env.provider}`);
  console.log(
    `  ${chalk.gray("Status:")} ${env.status === "active" ? chalk.green(env.status) : chalk.red(env.status)}`,
  );
  console.log(
    `  ${chalk.gray("Created:")} ${new Date(env.createdAt).toLocaleString()}`,
  );
  console.log(`  ${chalk.gray("Age:")} ${hours}h ${minutes}m`);

  if (env.projectId) {
    console.log(`  ${chalk.gray("Project ID:")} ${env.projectId}`);
  }
  if (env.accountId) {
    console.log(`  ${chalk.gray("Account ID:")} ${env.accountId}`);
  }
  if (env.region) {
    console.log(`  ${chalk.gray("Region:")} ${env.region}`);
  }

  if (env.services.length > 0) {
    console.log(`  ${chalk.gray("Services:")} ${env.services.join(", ")}`);
  }

  const resourceCount = Object.keys(env.resources).length;
  if (resourceCount > 0) {
    console.log(`  ${chalk.gray("Resources:")} ${resourceCount} created`);
  }

  console.log(`\n  ${chalk.gray("Cost Estimate:")}`);
  console.log(
    `    ${chalk.gray("Hourly rate:")} ${formatHourlyRate(runningCost.hourlyRate)}`,
  );
  console.log(
    `    ${chalk.gray("Hours running:")} ${runningCost.hoursRunning}h`,
  );
  console.log(
    `    ${chalk.yellow("Current cost:")} ${formatCost(runningCost.totalCost)}`,
  );
  console.log(
    `    ${chalk.gray("Est. daily:")} ${formatCost(runningCost.estimatedDaily)}`,
  );
  console.log(
    `    ${chalk.gray("Est. monthly:")} ${formatCost(runningCost.estimatedMonthly)}`,
  );

  if (env.error) {
    console.log(`\n  ${chalk.red("Error:")} ${env.error}`);
  }

  console.log(
    chalk.cyan(`\n→ Run "sandman connect ${name}" to get credentials`),
  );
  console.log(chalk.cyan(`→ Run "sandman destroy ${name}" to clean up`));
}
