import { promises as fs } from "fs";
import { basename, dirname } from "path";
import { homedir } from "os";
import {
  Config,
  ConfigSchema,
  EnvironmentRecord,
  ProviderType,
} from "../types/index.js";

function expandPath(path: string): string {
  if (path.startsWith("~/")) {
    return path.replace("~", homedir());
  }
  return path;
}

export class StateError extends Error {
  readonly code = "STATE_CORRUPT";

  constructor(message: string) {
    super(message);
    this.name = "StateError";
  }
}

export class StateStore {
  private configPath: string;
  private config: Config | null = null;

  constructor(configPath: string = "~/.sandman/config.json") {
    this.configPath = expandPath(configPath);
  }

  async load(): Promise<Config> {
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

  async save(config: Config): Promise<void> {
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

  async getEnvironment(name: string): Promise<EnvironmentRecord | undefined> {
    const config = await this.load();
    return config.environments[name];
  }

  async saveEnvironment(env: EnvironmentRecord): Promise<void> {
    const config = await this.load();
    config.environments[env.name] = env;
    await this.save(config);
  }

  async deleteEnvironment(name: string): Promise<void> {
    const config = await this.load();
    delete config.environments[name];
    await this.save(config);
  }

  async listEnvironments(): Promise<EnvironmentRecord[]> {
    const config = await this.load();
    return Object.values(config.environments);
  }

  async setProvider(provider: ProviderType, region?: string): Promise<void> {
    const config = await this.load();
    config.provider = provider;
    if (region) {
      config.defaultRegion = region;
    }
    await this.save(config);
  }

  async getProvider(): Promise<{ provider?: ProviderType; region?: string }> {
    const config = await this.load();
    return {
      provider: config.provider,
      region: config.defaultRegion,
    };
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
