import { promises as fs } from "fs";
import { basename, dirname } from "path";
import { homedir } from "os";
import {
  Config,
  ConfigSchema,
  EnvironmentRecord,
  ProviderType,
} from "../types/index.js";

const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 5_000;
const LOCK_POLL_MS = 50;

function expandPath(path: string): string {
  if (path.startsWith("~/")) {
    return path.replace("~", homedir());
  }
  return path;
}

export class StateError extends Error {
  readonly code: "STATE_CORRUPT" | "STATE_LOCKED";

  constructor(
    message: string,
    code: "STATE_CORRUPT" | "STATE_LOCKED" = "STATE_CORRUPT",
  ) {
    super(message);
    this.name = "StateError";
    this.code = code;
  }
}

export class StateStore {
  private configPath: string;
  private config: Config | null = null;

  constructor(configPath: string = "~/.sandman/config.json") {
    this.configPath = expandPath(configPath);
  }

  private lockPath(): string {
    return this.getLockPath();
  }

  async load(): Promise<Config> {
    return this.loadUnlocked();
  }

  async save(config: Config): Promise<void> {
    await this.withLock(() => this.saveUnlocked(config));
  }

  async getEnvironment(name: string): Promise<EnvironmentRecord | undefined> {
    const config = await this.loadUnlocked();
    return config.environments[name];
  }

  async saveEnvironment(env: EnvironmentRecord): Promise<void> {
    await this.withLock(async () => {
      const config = await this.loadUnlocked();
      config.environments[env.name] = env;
      await this.saveUnlocked(config);
    });
  }

  async deleteEnvironment(name: string): Promise<void> {
    await this.withLock(async () => {
      const config = await this.loadUnlocked();
      delete config.environments[name];
      await this.saveUnlocked(config);
    });
  }

  async listEnvironments(): Promise<EnvironmentRecord[]> {
    const config = await this.loadUnlocked();
    return Object.values(config.environments);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  getLockPath(): string {
    return `${this.configPath}.lock`;
  }

  async setProvider(
    provider: ProviderType,
    region?: string,
    billingAccount?: string,
  ): Promise<void> {
    await this.withLock(async () => {
      const config = await this.loadUnlocked();
      config.provider = provider;
      if (region) {
        config.defaultRegion = region;
      }
      if (billingAccount) {
        config.defaultBillingAccount = billingAccount;
      }
      await this.saveUnlocked(config);
    });
  }

  async getProvider(): Promise<{
    provider?: ProviderType;
    region?: string;
    billingAccount?: string;
  }> {
    const config = await this.loadUnlocked();
    return {
      provider: config.provider,
      region: config.defaultRegion,
      billingAccount: config.defaultBillingAccount,
    };
  }

  private async loadUnlocked(): Promise<Config> {
    let content: string;
    try {
      content = await fs.readFile(this.configPath, "utf-8");
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        this.config = {
          version: "1.0.0",
          environments: {},
        };
        return this.config;
      }
      throw new StateError(
        `Unable to read Sandman state at ${this.configPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new StateError(
        `Sandman state file is corrupt (${this.configPath}). Fix the JSON or delete the file, then retry. Refusing to overwrite so cloud resources are not orphaned.`,
      );
    }

    try {
      this.config = ConfigSchema.parse(parsed);
    } catch {
      throw new StateError(
        `Sandman state file is invalid (${this.configPath}). Fix or delete the file, then retry. Refusing to overwrite so cloud resources are not orphaned.`,
      );
    }

    await this.tightenPermissions();
    return this.config;
  }

  private async saveUnlocked(config: Config): Promise<void> {
    const dir = dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    if (basename(dir) === ".sandman") {
      try {
        await fs.chmod(dir, 0o700);
      } catch {
        // Best-effort on platforms that ignore directory modes.
      }
    }

    const tmpPath = `${this.configPath}.tmp-${process.pid}`;
    await fs.writeFile(tmpPath, JSON.stringify(config, null, 2), {
      mode: 0o600,
      encoding: "utf-8",
    });
    await fs.rename(tmpPath, this.configPath);
    try {
      await fs.chmod(this.configPath, 0o600);
    } catch {
      // Best-effort on platforms that ignore file modes.
    }
    this.config = config;
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireLock();
    try {
      return await fn();
    } finally {
      await this.releaseLock();
    }
  }

  private async acquireLock(): Promise<void> {
    const lockPath = this.lockPath();
    const started = Date.now();
    while (true) {
      try {
        await fs.writeFile(lockPath, String(process.pid), {
          flag: "wx",
          mode: 0o600,
        });
        return;
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") {
          throw error;
        }
        try {
          const stat = await fs.stat(lockPath);
          if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            await fs.unlink(lockPath).catch(() => undefined);
            continue;
          }
        } catch {
          continue;
        }
        if (Date.now() - started > LOCK_WAIT_MS) {
          throw new StateError(
            `Sandman state is locked (${lockPath}). Retry in a moment; another sandman process may be running.`,
            "STATE_LOCKED",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
      }
    }
  }

  private async releaseLock(): Promise<void> {
    await fs.unlink(this.lockPath()).catch(() => undefined);
  }

  private async tightenPermissions(): Promise<void> {
    try {
      await fs.chmod(this.configPath, 0o600);
    } catch {
      // Best-effort.
    }
    const dir = dirname(this.configPath);
    if (basename(dir) === ".sandman") {
      try {
        await fs.chmod(dir, 0o700);
      } catch {
        // Best-effort.
      }
    }
  }
}
