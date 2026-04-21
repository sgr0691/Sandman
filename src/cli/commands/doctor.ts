import chalk from 'chalk';
import { StateStore } from '../../core/state-store.js';
import { Config } from '../../types/index.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
}

async function checkAws(): Promise<CheckResult> {
  try {
    const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
    const client = new STSClient({});
    const result = await client.send(new GetCallerIdentityCommand({}));
    return { name: 'AWS credentials', status: 'pass', message: `Account ${result.Account}` };
  } catch (err: any) {
    const isCredError = err.name === 'CredentialsProviderError' || err.message?.includes('credentials');
    return {
      name: 'AWS credentials',
      status: 'fail',
      message: isCredError ? 'Not configured. Run "aws configure"' : err.message,
    };
  }
}

async function checkGcp(): Promise<CheckResult> {
  try {
    const { ProjectsClient } = await import('@google-cloud/resource-manager');
    const client = new ProjectsClient();
    await client.searchProjects({ pageSize: 1 });
    return { name: 'GCP credentials', status: 'pass', message: 'Authenticated' };
  } catch (err: any) {
    const isAuthError = err.code === 7 || err.code === 16 || err.message?.includes('credentials');
    return {
      name: 'GCP credentials',
      status: 'fail',
      message: isAuthError
        ? 'Not configured. Run "gcloud auth application-default login"'
        : err.message,
    };
  }
}

export async function doctorCheck(
  store: StateStore,
  options: { json?: boolean } = {}
): Promise<void> {
  const checks: CheckResult[] = [];

  // Node.js version
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);
  checks.push({
    name: 'Node.js version',
    status: major >= 18 ? 'pass' : 'fail',
    message: major >= 18 ? `v${nodeVersion}` : `v${nodeVersion} — requires >=18`,
  });

  // Config file — use readAndValidate so parse/schema errors actually surface
  let config: Config | null = null;
  try {
    config = await store.readAndValidate();
    checks.push({ name: 'Config file', status: 'pass', message: 'Valid' });
  } catch (err: any) {
    // File not found means no config yet — not an error worth failing on
    if (err.code === 'ENOENT') {
      checks.push({ name: 'Config file', status: 'warn', message: 'Not found — run "sandman init <provider>"' });
    } else {
      checks.push({ name: 'Config file', status: 'fail', message: err.message });
    }
    // Load defaults so subsequent checks (provider, envs) can still run
    config = await store.load();
  }

  // Provider configured
  if (config) {
    checks.push(
      config.provider
        ? { name: 'Provider configured', status: 'pass', message: config.provider }
        : { name: 'Provider configured', status: 'warn', message: 'None set — run "sandman init <provider>"' }
    );
  }

  // AWS — check if provider is aws or credentials are present in the environment
  const awsInUse = config?.provider === 'aws' || !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE);
  if (awsInUse) {
    checks.push(await checkAws());
  } else {
    checks.push({ name: 'AWS credentials', status: 'skip', message: 'Not in use' });
  }

  // GCP — check if provider is gcp or ADC credentials are present
  const gcpInUse = config?.provider === 'gcp' || !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT);
  if (gcpInUse) {
    checks.push(await checkGcp());
  } else {
    checks.push({ name: 'GCP credentials', status: 'skip', message: 'Not in use' });
  }

  // Cloudflare — token is the only auth mechanism
  const cfInUse = config?.provider === 'cloudflare' || !!process.env.CLOUDFLARE_API_TOKEN;
  if (cfInUse) {
    checks.push(
      process.env.CLOUDFLARE_API_TOKEN
        ? { name: 'Cloudflare token', status: 'pass', message: 'CLOUDFLARE_API_TOKEN set' }
        : { name: 'Cloudflare token', status: 'fail', message: 'CLOUDFLARE_API_TOKEN not set' }
    );
  } else {
    checks.push({ name: 'Cloudflare token', status: 'skip', message: 'Not in use' });
  }

  // Vercel — token is the only auth mechanism
  const vercelInUse = config?.provider === 'vercel' || !!process.env.VERCEL_TOKEN;
  if (vercelInUse) {
    checks.push(
      process.env.VERCEL_TOKEN
        ? { name: 'Vercel token', status: 'pass', message: 'VERCEL_TOKEN set' }
        : { name: 'Vercel token', status: 'fail', message: 'VERCEL_TOKEN not set' }
    );
  } else {
    checks.push({ name: 'Vercel token', status: 'skip', message: 'Not in use' });
  }

  // Environment summary
  if (config) {
    const envs = Object.values(config.environments);
    const active = envs.filter((e) => e.status === 'active').length;
    checks.push({
      name: 'Environments',
      status: 'pass',
      message: `${envs.length} total, ${active} active`,
    });
  }

  if (options.json) {
    const healthy = checks.every((c) => c.status === 'pass' || c.status === 'skip' || c.status === 'warn');
    console.log(JSON.stringify({ healthy, checks }));
    const hasFail = checks.some((c) => c.status === 'fail');
    if (hasFail) process.exit(1);
    return;
  }

  console.log(chalk.bold('\nSandman Doctor\n'));

  let hasFail = false;
  for (const check of checks) {
    const icon =
      check.status === 'pass' ? chalk.green('✓') :
      check.status === 'fail' ? chalk.red('✗') :
      check.status === 'warn' ? chalk.yellow('⚠') :
      chalk.gray('–');

    const label =
      check.status === 'fail' ? chalk.red(check.name) :
      check.status === 'warn' ? chalk.yellow(check.name) :
      check.status === 'skip' ? chalk.gray(check.name) :
      chalk.white(check.name);

    const msg = chalk.gray(check.message);

    console.log(`  ${icon}  ${label.padEnd(26)} ${msg}`);
    if (check.status === 'fail') hasFail = true;
  }

  console.log('');
  if (hasFail) {
    console.log(chalk.red('Some checks failed. Fix the issues above and re-run "sandman doctor".'));
    process.exit(1);
  } else {
    console.log(chalk.green('All checks passed.'));
  }
}
