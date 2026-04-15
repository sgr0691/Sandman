import { ProviderAdapter, GCP_SERVICES } from "../base.js";
import { EnvironmentRecord, ServiceName } from "../../types/index.js";

export class GcpAdapter implements ProviderAdapter {
  private projectId: string | null = null;
  private projectNumber: string | null = null;
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
    if (!this.projectId) {
      throw new Error(
        "No GCP project configured. Set GCP_PROJECT environment variable or run 'gcloud config set project PROJECT_ID'",
      );
    }

    // Generate a unique project ID for the sandman environment
    const timestamp = Date.now();
    const sandmanProjectId = `sandman-${name}-${timestamp}`;

    try {
      const { ProjectsClient } = await import("@google-cloud/resource-manager");
      const resourceManagerClient = new ProjectsClient();

      // Create the project
      const [operation] = await resourceManagerClient.createProject({
        project: {
          projectId: sandmanProjectId,
          name: `Sandman Environment: ${name}`,
        },
      });

      // Wait for the operation to complete
      const [projectOperation] = await operation.promise();

      // Get the project details to get the project number
      const [project] = await resourceManagerClient.getProject({
        name: `projects/${sandmanProjectId}`,
      });

      // Store the project ID and number
      this.projectId = sandmanProjectId;
      this.projectNumber = (project as any).projectNumber?.toString() || null;

      // Link billing account if provided
      if (this.billingAccountId) {
        await this.linkBillingAccount(sandmanProjectId);
      }

      const now = new Date().toISOString();
      return {
        name,
        provider: "gcp",
        projectId: sandmanProjectId,
        status: "active",
        services: [],
        resources: {},
        createdAt: now,
        updatedAt: now,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to create GCP project: ${error.message ?? "Unknown error"}`,
      );
    }
  }

  private async linkBillingAccount(projectId: string): Promise<void> {
    if (!this.billingAccountId) {
      return;
    }

    try {
      const { CloudBillingClient } = await import("@google-cloud/billing");
      const billingClient = new CloudBillingClient();

      // Update project billing info to link the billing account
      await billingClient.updateProjectBillingInfo({
        name: `projects/${projectId}`,
        projectBillingInfo: {
          billingAccountName: `billingAccounts/${this.billingAccountId}`,
        },
      });
    } catch (error: any) {
      throw new Error(
        `Failed to link billing account: ${error.message ?? "Unknown error"}`,
      );
    }
  }

  async enableServices(
    env: EnvironmentRecord,
    services: ServiceName[],
  ): Promise<void> {
    if (!env.projectId) {
      throw new Error("Project ID is required to enable services");
    }

    try {
      const { ServiceUsageClient } =
        await import("@google-cloud/service-usage");
      const serviceUsageClient = new ServiceUsageClient();

      const serviceNames = services.map((s) => GCP_SERVICES[s]).filter(Boolean);

      if (serviceNames.length === 0) {
        return;
      }

      console.log(`Enabling GCP services: ${serviceNames.join(", ")}`);

      // Enable each service
      for (const serviceName of serviceNames) {
        const request = {
          name: `projects/${env.projectId}/services/${serviceName}`,
        };

        await serviceUsageClient.enableService(request);
      }
    } catch (error: any) {
      throw new Error(
        `Failed to enable GCP services: ${error.message ?? "Unknown error"}`,
      );
    }
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
    if (!env.projectId) {
      throw new Error("Project ID is required to destroy environment");
    }

    try {
      const { ProjectsClient } = await import("@google-cloud/resource-manager");
      const resourceManagerClient = new ProjectsClient();

      // Delete the project
      const [operation] = await resourceManagerClient.deleteProject({
        name: `projects/${env.projectId}`,
      });

      // Wait for the operation to complete
      await operation.promise();

      console.log(`Deleted GCP project: ${env.projectId}`);
    } catch (error: any) {
      throw new Error(
        `Failed to delete GCP project: ${error.message ?? "Unknown error"}`,
      );
    }
  }

  async getStatus(env: EnvironmentRecord): Promise<EnvironmentRecord> {
    if (!env.projectId) {
      return {
        ...env,
        status: "failed",
        error: "Project ID not available",
      };
    }

    try {
      const { ProjectsClient } = await import("@google-cloud/resource-manager");
      const resourceManagerClient = new ProjectsClient();

      // Get the project to check its status
      const [project] = await resourceManagerClient.getProject({
        name: `projects/${env.projectId}`,
      });

      // Map GCP project lifecycle state to our status
      let status: EnvironmentRecord["status"] = env.status;
      const lifecycleState = (project as any).lifecycleState;
      switch (lifecycleState) {
        case "ACTIVE":
          status = "active";
          break;
        case "DELETE_REQUESTED":
        case "DELETE_IN_PROGRESS":
          status = "destroyed";
          break;
        case "FAILED":
          status = "failed";
          break;
        default:
          status = "pending";
      }

      return {
        ...env,
        status,
        updatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      // If we can't get the project, it might have been deleted
      return {
        ...env,
        status: "destroyed",
        updatedAt: new Date().toISOString(),
      };
    }
  }

  setBillingAccount(accountId: string): void {
    this.billingAccountId = accountId;
  }

  getProjectId(): string | null {
    return this.projectId;
  }

  getProjectNumber(): string | null {
    return this.projectNumber;
  }
}
