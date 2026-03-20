import { promises as fs } from "fs";
import { dirname } from "path";
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

export class StateStore {
  private configPath: string;
  private config: Config | null = null;

  constructor(configPath: string = "~/.sandman/config.json") {
    this.configPath = expandPath(configPath);
  }

  async load(): Promise<Config> {
    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(content);
      this.config = ConfigSchema.parse(parsed);
      return this.config;
    } catch {
      this.config = {
        version: "1.0.0",
        environments: {},
      };
      return this.config;
    }
  }

  async save(config: Config): Promise<void> {
    await fs.mkdir(dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
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
}
