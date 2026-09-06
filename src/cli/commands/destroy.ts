import chalk from 'chalk';
import ora from 'ora';
import { StateStore } from '../../core/state-store.js';
import { getAdapter } from '../../providers/index.js';
import { emitErr, emitOk, mapThrownError } from '../output.js';

interface DestroyParams {
  confirmed: boolean;
  json?: boolean;
}

export async function destroyEnvironment(
  name: string,
  store: StateStore,
  params: DestroyParams = { confirmed: false }
): Promise<void> {
  const env = await store.getEnvironment(name);

  if (!env) {
    emitErr(params.json, {
      code: 'NOT_FOUND',
      error: `Environment "${name}" not found.`,
      next: ['sandman list --json'],
    });
  }

  if (!params.confirmed) {
    if (params.json) {
      emitErr(params.json, {
        code: 'CONFIRMATION_REQUIRED',
        error: `Refusing to destroy "${name}" without confirmation.`,
        hint: 'Pass -y to skip the interactive prompt (required for --json).',
        next: [`sandman destroy ${name} -y --json`],
      });
    }

    console.log(chalk.yellow(`\n⚠️  This will destroy environment "${name}" on ${env.provider}.`));
    console.log(chalk.gray('All resources will be permanently deleted.\n'));

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(chalk.yellow('Are you sure? (yes/no): '), (ans) => {
        rl.close();
        resolve(ans.toLowerCase());
      });
    });

    if (answer !== 'yes' && answer !== 'y') {
      console.log(chalk.gray('Destroy cancelled.'));
      return;
    }
  }

  const spinner = params.json ? null : ora(`Destroying environment "${name}"...`).start();

  try {
    const adapter = getAdapter(env.provider);
    await adapter.destroyEnvironment(env);

    const now = new Date().toISOString();
    env.status = 'destroyed';
    env.updatedAt = now;

    await store.saveEnvironment(env);

    emitOk(params.json, { name, status: 'destroyed' }, () => {
      spinner!.succeed(chalk.green(`✓ Environment "${name}" destroyed.`));
      console.log(chalk.gray('Cloud resources cleaned up.'));
    });
  } catch (error: unknown) {
    spinner?.fail?.(chalk.red('Failed to destroy environment'));
    const mapped = mapThrownError(error);
    emitErr(
      params.json,
      {
        ...mapped,
        hint: 'Local state was not marked destroyed. Retry after resolving the error to avoid orphaned resources.',
      },
      () => {
        console.log(chalk.red(`Error: ${mapped.error}`));
      },
    );
  }
}
