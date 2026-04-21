import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { EnvironmentRecord, ProviderType } from '../../types/index.js';
import { getAdapter } from '../../providers/index.js';

interface CleanupOptions {
  olderThan?: string;
  yes?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

function parseDuration(input: string): number {
  const match = input.match(/^(\d+(?:\.\d+)?)(m|h|d)$/i);
  if (!match) {
    throw new Error(`Invalid duration "${input}". Use a number followed by m, h, or d (e.g. 30m, 24h, 7d)`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const msPerUnit: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * msPerUnit[unit];
}

async function destroyOne(env: EnvironmentRecord, store: StateStore): Promise<void> {
  const adapter = getAdapter(env.provider as ProviderType);
  await adapter.destroyEnvironment(env);
  const now = new Date().toISOString();
  env.status = 'destroyed';
  env.updatedAt = now;
  await store.saveEnvironment(env);
}

export async function cleanupEnvironments(
  store: StateStore,
  options: CleanupOptions = {}
): Promise<void> {
  const all = await store.listEnvironments();
  let candidates = all.filter((e) => e.status !== 'destroyed');

  if (options.olderThan) {
    let maxAgeMs: number;
    try {
      maxAgeMs = parseDuration(options.olderThan);
    } catch (err: any) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: err.message }));
      } else {
        console.log(chalk.red(`Error: ${err.message}`));
      }
      process.exit(1);
    }
    const cutoff = Date.now() - maxAgeMs!;
    candidates = candidates.filter((e) => new Date(e.createdAt).getTime() < cutoff);
  }

  if (candidates.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ success: true, destroyed: [], message: 'No environments matched.' }));
    } else {
      console.log(chalk.gray('No environments matched the cleanup criteria.'));
    }
    return;
  }

  if (!options.json) {
    const header = options.olderThan
      ? `Environments older than ${options.olderThan} (${candidates.length})`
      : `Active environments to clean up (${candidates.length})`;
    console.log(chalk.bold(`\n${header}:\n`));
    for (const env of candidates) {
      const ageHours = ((Date.now() - new Date(env.createdAt).getTime()) / 3_600_000).toFixed(1);
      console.log(
        `  ${chalk.cyan(env.name.padEnd(22))} ${chalk.gray(env.provider.padEnd(14))} ${chalk.gray(`${ageHours}h old`)}`
      );
    }
    console.log('');
  }

  if (options.dryRun) {
    if (options.json) {
      console.log(JSON.stringify({ dryRun: true, wouldDestroy: candidates.map((e) => e.name) }));
    } else {
      console.log(chalk.yellow('Dry run — no environments were destroyed.'));
    }
    return;
  }

  if (!options.yes && !options.json) {
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question(
        chalk.yellow(`Destroy all ${candidates.length} environment(s)? (yes/no): `),
        (ans: string) => { rl.close(); resolve(ans.trim().toLowerCase()); }
      );
    });
    if (answer !== 'yes' && answer !== 'y') {
      console.log(chalk.gray('Cleanup cancelled.'));
      return;
    }
  }

  const destroyed: string[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const env of candidates) {
    if (options.json) {
      try {
        await destroyOne(env, store);
        destroyed.push(env.name);
      } catch (err: any) {
        failed.push({ name: env.name, error: err.message });
      }
    } else {
      const spinner = ora(`Destroying "${env.name}"...`).start();
      try {
        await destroyOne(env, store);
        spinner.succeed(chalk.green(`✓ Destroyed "${env.name}"`));
        destroyed.push(env.name);
      } catch (err: any) {
        spinner.fail(chalk.red(`Failed to destroy "${env.name}": ${err.message}`));
        failed.push({ name: env.name, error: err.message });
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify({ success: failed.length === 0, destroyed, failed }));
    if (failed.length > 0) process.exit(1);
    return;
  }

  console.log('');
  console.log(chalk.green(`Cleaned up ${destroyed.length} environment(s).`));
  if (failed.length > 0) {
    console.log(chalk.red(`${failed.length} environment(s) failed — check errors above.`));
    process.exit(1);
  }
}
