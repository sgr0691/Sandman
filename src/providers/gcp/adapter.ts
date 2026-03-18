import { ProviderAdapter, GCP_SERVICES } from "../base.js";
import { EnvironmentRecord, ServiceName } from "../../types/index.js";

export class GcpAdapter implements ProviderAdapter {
  private projectId: string | null = null;
  private billingAccountId: string | null = null;

  async init(): Promise<void> {
    try {
      const { ProjectsClient } = await import("@google-cloud/resource-manager");
      const client = new ProjectsClient();

      // Verify authentication by searching for projects
      // This works even without specifying a project
      const [projects] = await client.searchProjects({ pageSize: 1 });

      // Get project from:
      // 1. GCP_PROJECT env var
      // 2. gcloud config (via GCLOUD_CONFIG env or default)
      // 3. First project found (if any)
      const envProject = process.env.GCP_PROJECT;
      const gcloudProject =
        process.env.GOOGLE_CLOUD_PROJECT || process.env.CLOUDSDK_CORE_PROJECT;

      if (envProject) {
        this.projectId = envProject;
      } else if (gcloudProject) {
        this.projectId = gcloudProject;
      } else if (projects.length > 0 && projects[0].projectId) {
        this.projectId = projects[0].projectId;
      } else {
        // Auth works but no projects - user needs to create one or set GCP_PROJECT
        this.projectId = null;
      }
    } catch (error: any) {
      if (error.code === 7 || error.code === 16) {
        // PERMISSION_DENIED or UNAUTHENTICATED
        throw new Error(
          'GCP authentication required. Run "gcloud auth application-default login"',
        );
      }
      if (
        error.message?.includes("Could not load") ||
        error.message?.includes("credentials")
      ) {
        throw new Error(
          'GCP authentication required. Run "gcloud auth application-default login"',
        );
      }
      throw error;
    }
  }

  async createEnvironment(name: string): Promise<EnvironmentRecord> {
    const timestamp = Date.now();
    const projectId = `sandman-${name}-${timestamp}`;

    const now = new Date().toISOString();
    return {
      name,
      provider: "gcp",
      projectId,
      status: "active",
      services: [],
      resources: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  async enableServices(
    env: EnvironmentRecord,
    services: ServiceName[],
  ): Promise<void> {
    const enabledServices = services
      .map((s) => GCP_SERVICES[s])
      .filter(Boolean);
    console.log(`Enabling GCP services: ${enabledServices.join(", ")}`);
  }

  async connect(env: EnvironmentRecord): Promise<Record<string, string>> {
    const result: Record<string, string> = {
      provider: "gcp",
    };

    if (env.projectId) {
      result.GCP_PROJECT = env.projectId;
    }

    return result;
  }

  async destroyEnvironment(env: EnvironmentRecord): Promise<void> {
    console.log(`Would delete GCP project: ${env.projectId}`);
  }

  async getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord> {
    return env;
  }

  setBillingAccount(accountId: string): void {
    this.billingAccountId = accountId;
  }

  getProjectId(): string | null {
    return this.projectId;
  }
}
