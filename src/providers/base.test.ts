import { describe, it, expect } from 'vitest';
import { ProviderAdapter } from './base.js';
import { EnvironmentRecord, ServiceName } from '../types/index.js';

describe('ProviderAdapter (interface contract)', () => {
  it('should have all required methods', () => {
    const adapter: ProviderAdapter = {
      init: async () => {},
      createEnvironment: async (name: string) => ({
        name,
        provider: 'gcp',
        status: 'active',
        services: [],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      enableServices: async () => {},
      connect: async () => ({}),
      destroyEnvironment: async () => {},
      getStatus: async (env: EnvironmentRecord) => env,
    };

    expect(typeof adapter.init).toBe('function');
    expect(typeof adapter.createEnvironment).toBe('function');
    expect(typeof adapter.enableServices).toBe('function');
    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.destroyEnvironment).toBe('function');
    expect(typeof adapter.getStatus).toBe('function');
  });

  it('createEnvironment should return EnvironmentRecord', async () => {
    const adapter: ProviderAdapter = {
      init: async () => {},
      createEnvironment: async (name: string) => ({
        name,
        provider: 'gcp',
        status: 'active',
        services: [],
        resources: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      enableServices: async () => {},
      connect: async () => ({}),
      destroyEnvironment: async () => {},
      getStatus: async (env) => env,
    };

    const result = await adapter.createEnvironment('test');
    expect(result.name).toBe('test');
    expect(result.provider).toBe('gcp');
    expect(result.status).toBe('active');
  });
});
