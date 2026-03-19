import { ProviderAdapter, CLOUDFLARE_SERVICES } from "../base.js";
import { EnvironmentRecord, ServiceName } from "../../types/index.js";

export class CloudflareAdapter implements ProviderAdapter {
  private accountId: string | null = null;

  async init(): Promise<void> {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken) {
      throw new Error(
        "CLOUDFLARE_API_TOKEN environment variable is required. " +
          "Create a token at https://dash.cloudflare.com/profile/api-tokens",
      );
    }

    // Verify token by fetching account info
    const response = await fetch("https://api.cloudflare.com/client/v4/user", {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = (await response.json()) as { errors?: { message: string }[] };
      const msg = body.errors?.[0]?.message || response.statusText;
      throw new Error(`Cloudflare authentication failed: ${msg}`);
    }

    if (accountId) {
      this.accountId = accountId;
    } else {
      // Fetch first account associated with the token
      const accountsRes = await fetch(
        "https://api.cloudflare.com/client/v4/accounts",
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (accountsRes.ok) {
        const data = (await accountsRes.json()) as {
          result?: { id: string }[];
        };
        this.accountId = data.result?.[0]?.id || null;
      }
    }
  }

  async createEnvironment(name: string): Promise<EnvironmentRecord> {
    const now = new Date().toISOString();
    const namespaceId = `sandman-${name}-${Date.now()}`;

    return {
      name,
      provider: "cloudflare",
      accountId: this.accountId || undefined,
      status: "active",
      services: [],
      resources: {
        namespaceId,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  async enableServices(
    env: EnvironmentRecord,
    services: ServiceName[],
  ): Promise<void> {
    const enabledServices = services
      .map((s) => CLOUDFLARE_SERVICES[s])
      .filter(Boolean);
    console.log(`Enabling Cloudflare services: ${enabledServices.join(", ")}`);
  }

  async connect(env: EnvironmentRecord): Promise<Record<string, string>> {
    const result: Record<string, string> = {
      provider: "cloudflare",
    };

    if (env.accountId) {
      result.CLOUDFLARE_ACCOUNT_ID = env.accountId;
    }
    if (process.env.CLOUDFLARE_API_TOKEN) {
      result.CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    }
    if (env.resources.namespaceId) {
      result.CLOUDFLARE_NAMESPACE_ID = env.resources.namespaceId as string;
    }

    return result;
  }

  async destroyEnvironment(env: EnvironmentRecord): Promise<void> {
    console.log(
      `Cleaning up Cloudflare resources for environment: ${env.name}`,
    );
    // Future: delete KV namespaces, R2 buckets, D1 databases via API
  }

  async getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord> {
    return env;
  }
}
