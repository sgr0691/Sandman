import { ProviderAdapter, GCP_SERVICES } from "../base.js";
import {
  EnableResult,
  EnvironmentRecord,
  ServiceName,
} from "../../types/index.js";
import { enableResult } from "../enable-result.js";
import { logger } from "../../utils/logger.js";

function normalizeBillingAccountId(raw: string): string {
  return raw.replace(/^billingAccounts\//, "");
}

export class GcpAdapter implements ProviderAdapter {
  private projectId: string | null = null;
  private projectNumber: string | null = null;
  private billingAccountId: string | null = null;
  private region: string | undefined;

  setRegion(region: string): void {
    this.region = region;
  }

  setBillingAccount(accountId: string): void {
    this.billingAccountId = normalizeBillingAccountId(accountId);
  }

  getBillingAccount(): string | null {
    return this.billingAccountId;
  }

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
        logger.warn(
          `No GCP_PROJECT / GOOGLE_CLOUD_PROJECT set; using first accessible project "${this.projectId}". Set GCP_PROJECT to avoid targeting the wrong project.`,
        );
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

  async discoverBillingAccount(): Promise<string | null> {
    if (this.billingAccountId) {
      return this.billingAccountId;
    }
    const fromEnv = process.env.GCP_BILLING_ACCOUNT;
    if (fromEnv) {
      this.billingAccountId = normalizeBillingAccountId(fromEnv);
      return this.billingAccountId;
    }
    const discovered = await this.lookupBillingAccount(this.projectId);
    if (discovered) {
      this.billingAccountId = discovered;
    }
    return this.billingAccountId;
  }

  async whoami(): Promise<Record<string, string | null | undefined>> {
    return {
      provider: "gcp",
      projectId: this.projectId,
      region: this.region,
      billingAccount: this.billingAccountId,
    };
  }

  async createEnvironment(name: string): Promise<EnvironmentRecord> {
    if (!this.projectId) {
      throw new Error(
        "No GCP project configured. Set GCP_PROJECT environment variable or run 'gcloud config set project PROJECT_ID'",
      );
    }

    const parentProjectId = this.projectId;
    const timestamp = Date.now();
    const sandmanProjectId = `sandman-${name}-${timestamp}`;

    try {
      const { ProjectsClient } = await import("@google-cloud/resource-manager");
      const resourceManagerClient = new ProjectsClient();

      const [operation] = await resourceManagerClient.createProject({
        project: {
          projectId: sandmanProjectId,
          name: `Sandman Environment: ${name}`,
        },
      });

      await operation.promise();

      const [project] = await resourceManagerClient.getProject({
        name: `projects/${sandmanProjectId}`,
      });

      this.projectId = sandmanProjectId;
      this.projectNumber = (project as any).projectNumber?.toString() || null;

      const billingId =
        this.billingAccountId ||
        (await this.lookupBillingAccount(parentProjectId));
      if (billingId) {
        this.billingAccountId = billingId;
      }

      let billingError: string | undefined;
      if (this.billingAccountId) {
        try {
          await this.linkBillingAccount(sandmanProjectId);
        } catch (error: any) {
          billingError = error.message ?? String(error);
        }
      } else {
        billingError =
          "No billing account linked. Pass --billing-account, set GCP_BILLING_ACCOUNT, or enable billing on the parent project. GCP APIs cannot be enabled until billing is linked.";
      }

      const now = new Date().toISOString();
      return {
        name,
        provider: "gcp",
        projectId: sandmanProjectId,
        region: this.region,
        billingAccount: this.billingAccountId || undefined,
        status: billingError ? "failed" : "active",
        services: [],
        resources: {},
        createdAt: now,
        updatedAt: now,
        error: billingError,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to create GCP project: ${error.message ?? "Unknown error"}`,
      );
    }
  }

  private async lookupBillingAccount(
    parentProjectId?: string | null,
  ): Promise<string | null> {
    try {
      const { CloudBillingClient } = await import("@google-cloud/billing");
      const billingClient = new CloudBillingClient();

      if (parentProjectId) {
        try {
          const [info] = await billingClient.getProjectBillingInfo({
            name: `projects/${parentProjectId}`,
          });
          const name = info?.billingAccountName;
          if (info?.billingEnabled && name) {
            return normalizeBillingAccountId(name);
          }
        } catch {
          // Parent may not have billing; fall through to account list.
        }
      }

      const [accounts] = await billingClient.listBillingAccounts({});
      const open = (accounts ?? []).filter((account) => account.open);
      if (open.length === 1 && open[0].name) {
        return normalizeBillingAccountId(open[0].name);
      }
      if (open.length > 1) {
        logger.warn(
          `Found ${open.length} open GCP billing accounts. Pass --billing-account to choose one.`,
        );
      }
    } catch (error: any) {
      logger.warn(
        `Could not discover a GCP billing account: ${error.message ?? String(error)}`,
      );
    }
    return null;
  }

  private async linkBillingAccount(projectId: string): Promise<void> {
    if (!this.billingAccountId) {
      return;
    }

    try {
      const { CloudBillingClient } = await import("@google-cloud/billing");
      const billingClient = new CloudBillingClient();

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
  ): Promise<EnableResult> {
    if (!env.projectId) {
      throw new Error("Project ID is required to enable services");
    }

    try {
      const { ServiceUsageClient } =
        await import("@google-cloud/service-usage");
      const serviceUsageClient = new ServiceUsageClient();

      const recorded = services.filter((s) => GCP_SERVICES[s]);

      if (recorded.length === 0) {
        return enableResult({
          recorded: [],
          provisioned: [],
          localOnly: [],
        });
      }

      const serviceNames = recorded.map((s) => GCP_SERVICES[s]);
      logger.info(`Enabling GCP services: ${serviceNames.join(", ")}`);

      for (const serviceName of serviceNames) {
        const request = {
          name: `projects/${env.projectId}/services/${serviceName}`,
        };

        await serviceUsageClient.enableService(request);
      }

      return enableResult({
        recorded,
        provisioned: recorded,
        localOnly: [],
      });
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

    if (!env.projectId.startsWith("sandman-")) {
      throw new Error(
        `Refusing to delete GCP project "${env.projectId}" because it was not created by Sandman (expected sandman- prefix).`,
      );
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

      logger.info(`Deleted GCP project: ${env.projectId}`);
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
          status =
            !env.billingAccount && /billing/i.test(env.error || "")
              ? "failed"
              : "active";
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

  getProjectId(): string | null {
    return this.projectId;
  }

  getProjectNumber(): string | null {
    return this.projectNumber;
  }
}
