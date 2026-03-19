import { ProviderAdapter, VERCEL_SERVICES } from "../base.js";
import { EnvironmentRecord, ServiceName } from "../../types/index.js";

export class VercelAdapter implements ProviderAdapter {
  private teamId: string | null = null;

  async init(): Promise<void> {
    const token = process.env.VERCEL_TOKEN;

    if (!token) {
      throw new Error(
        "VERCEL_TOKEN environment variable is required. " +
          "Create a token at https://vercel.com/account/tokens",
      );
    }

    // Verify token by fetching the authenticated user
    const response = await fetch("https://api.vercel.com/v2/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: { message: string } };
      const msg = body.error?.message || response.statusText;
      throw new Error(`Vercel authentication failed: ${msg}`);
    }

    // Optionally capture team ID for team-scoped deployments
    const teamId = process.env.VERCEL_TEAM_ID;
    if (teamId) {
      this.teamId = teamId;
    }
  }

  async createEnvironment(name: string): Promise<EnvironmentRecord> {
    const now = new Date().toISOString();
    const projectName = `sandman-${name}-${Date.now()}`;

    return {
      name,
      provider: "vercel",
      projectId: projectName,
      status: "active",
      services: [],
      resources: {
        projectName,
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
      .map((s) => VERCEL_SERVICES[s])
      .filter(Boolean);
    console.log(`Enabling Vercel services: ${enabledServices.join(", ")}`);
  }

  async connect(env: EnvironmentRecord): Promise<Record<string, string>> {
    const result: Record<string, string> = {
      provider: "vercel",
    };

    if (process.env.VERCEL_TOKEN) {
      result.VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    }
    if (env.projectId) {
      result.VERCEL_PROJECT_NAME = env.projectId;
    }
    if (this.teamId) {
      result.VERCEL_TEAM_ID = this.teamId;
    }

    return result;
  }

  async destroyEnvironment(env: EnvironmentRecord): Promise<void> {
    console.log(`Cleaning up Vercel resources for environment: ${env.name}`);
    // Future: delete Vercel project via API
    // DELETE /v9/projects/{projectId}
  }

  async getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord> {
    return env;
  }
}
