import { ProviderAdapter, GCP_SERVICES } from '../base.js';
import { EnvironmentRecord, ServiceName } from '../../types/index.js';

export class GcpAdapter implements ProviderAdapter {
  private projectId: string | null = null;
  private billingAccountId: string | null = null;

  async init(): Promise<void> {
    try {
      const { ProjectsClient } = await import('@google-cloud/resource-manager');
      const client = new ProjectsClient();
      
      const [project] = await client.getProject({ name: `projects/${process.env.GCP_PROJECT || 'unknown'}`});
      
      this.projectId = project.projectId || null;
    } catch (error: any) {
      if (error.message?.includes('Could not load') || error.code === 5) {
        throw new Error('GCP authentication required. Run "gcloud auth application-default login"');
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
      provider: 'gcp',
      projectId,
      status: 'active',
      services: [],
      resources: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  async enableServices(env: EnvironmentRecord, services: ServiceName[]): Promise<void> {
    const enabledServices = services.map(s => GCP_SERVICES[s]).filter(Boolean);
    console.log(`Enabling GCP services: ${enabledServices.join(', ')}`);
  }

  async connect(env: EnvironmentRecord): Promise<Record<string, string>> {
    const result: Record<string, string> = {
      provider: 'gcp',
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
}
