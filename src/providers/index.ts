import { AwsAdapter } from './aws/adapter.js';
import { GcpAdapter } from './gcp/adapter.js';
import { CloudflareAdapter } from './cloudflare/adapter.js';
import { VercelAdapter } from './vercel/adapter.js';
import { ProviderAdapter } from './base.js';
import { ProviderType } from '../types/index.js';

export function getAdapter(providerType: ProviderType): ProviderAdapter {
  switch (providerType) {
    case 'aws': return new AwsAdapter();
    case 'gcp': return new GcpAdapter();
    case 'cloudflare': return new CloudflareAdapter();
    case 'vercel': return new VercelAdapter();
  }
}
