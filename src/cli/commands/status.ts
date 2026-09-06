import chalk from "chalk";
import { StateStore } from "../../core/state-store.js";
import { getAdapter } from "../../providers/index.js";
import {
  calculateRunningCost,
  formatCost,
  formatHourlyRate,
} from "../../utils/cost-estimator.js";
import { emitErr, emitOk } from "../output.js";

interface StatusOptions {
  json?: boolean;
}

export async function statusEnvironment(
  name: string,
  store: StateStore,
  options: StatusOptions = {},
): Promise<void> {
  const stored = await store.getEnvironment(name);

  if (!stored) {
    emitErr(options.json, {
      code: "NOT_FOUND",
      error: `Environment "${name}" not found.`,
      next: ["sandman list --json"],
    });
  }

  const adapter = getAdapter(stored.provider);
  const env = await adapter.getStatus(stored);
  if (env.status !== stored.status || env.error !== stored.error) {
    await store.saveEnvironment(env);
  }

  const runningCost = calculateRunningCost(
    env.provider,
    env.services,
    env.createdAt,
  );
  const age = Date.now() - new Date(env.createdAt).getTime();
  const hours = Math.floor(age / (1000 * 60 * 60));
  const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));

  const costEstimate = {
    hourlyRate: runningCost.hourlyRate,
    hoursRunning: runningCost.hoursRunning,
    totalCost: runningCost.totalCost,
    estimatedDaily: runningCost.estimatedDaily,
    estimatedMonthly: runningCost.estimatedMonthly,
  };

  emitOk(
    options.json,
    {
      ...env,
      costEstimate,
    },
    () => {
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
    },
  );
}
