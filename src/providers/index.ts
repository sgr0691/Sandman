import { AwsAdapter } from './aws/adapter.js';
import { GcpAdapter } from './gcp/adapter.js';
import { CloudflareAdapter } from './cloudflare/adapter.js';
import { VercelAdapter } from './vercel/adapter.js';
import { ProviderAdapter, ProviderType } from '../types/index.js';

export function getAdapter(providerType: ProviderType): ProviderAdapter {
  switch (providerType) {
    case 'aws': return new AwsAdapter();
    case 'gcp': return new GcpAdapter();
    case 'cloudflare': return new CloudflareAdapter();
    case 'vercel': return new VercelAdapter();
    default: {
      const unknown: never = providerType;
      throw new Error(`Unknown provider: ${String(unknown)}`);
    }
  }
}

export function configureAdapter(
  adapter: ProviderAdapter,
  options: { region?: string; billingAccount?: string },
): void {
  if (options.region && typeof adapter.setRegion === "function") {
    adapter.setRegion(options.region);
  }
  if (
    options.billingAccount &&
    typeof adapter.setBillingAccount === "function"
  ) {
    adapter.setBillingAccount(options.billingAccount);
  }
}
