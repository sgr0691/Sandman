import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateStore } from './state-store.js';
import { Config, EnvironmentRecord, ProviderType } from '../types/index.js';

describe('StateStore', () => {
  let store: StateStore;
  const testConfigPath = '/tmp/sandman-test-config.json';

  beforeEach(async () => {
    vi.resetModules();
    const fs = await import('fs/promises');
    try {
      await fs.unlink(testConfigPath);
    } catch {}
    store = new StateStore(testConfigPath);
  });

  describe('load', () => {
    it('should return default config when file does not exist', async () => {
      const fs = await import('fs/promises');
      try {
        await fs.unlink(testConfigPath);
      } catch {}
      const config = await store.load();
      expect(config).toEqual({
        version: '1.0.0',
        environments: {},
      });
    });

    it('should load existing config from file', async () => {
      const fs = await import('fs/promises');
      await fs.writeFile(
        testConfigPath,
        JSON.stringify({
          version: '1.0.0',
          environments: { 'test-env': { name: 'test-env', provider: 'gcp' as ProviderType, status: 'active' as const, services: [], resources: {}, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } },
        })
      );
      const config = await store.load();
      expect(config.environments['test-env']).toBeDefined();
      expect(config.environments['test-env'].name).toBe('test-env');
    });
  });

  describe('save', () => {
    it('should save config to file', async () => {
      const config: Config = {
        version: '1.0.0',
        environments: {},
      };
      await store.save(config);
      const fs = await import('fs/promises');
      const content = await fs.readFile(testConfigPath, 'utf-8');
      expect(JSON.parse(content)).toEqual(config);
    });
  });

  describe('getEnvironment', () => {
    it('should return environment by name', async () => {
      const fs = await import('fs/promises');
      await fs.writeFile(
        testConfigPath,
        JSON.stringify({
          version: '1.0.0',
          environments: {
            'my-env': {
              name: 'my-env',
              provider: 'gcp',
              status: 'active',
              services: [],
              resources: {},
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          },
        })
      );
      const env = await store.getEnvironment('my-env');
      expect(env?.name).toBe('my-env');
    });

    it('should return undefined for non-existent environment', async () => {
      const env = await store.getEnvironment('non-existent');
      expect(env).toBeUndefined();
    });
  });

  describe('saveEnvironment', () => {
    it('should add new environment', async () => {
      const env: EnvironmentRecord = {
        name: 'new-env',
        provider: 'aws',
        status: 'active',
        services: ['s3'],
        resources: { bucketName: 'test-bucket' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      await store.saveEnvironment(env);
      const config = await store.load();
      expect(config.environments['new-env']).toBeDefined();
    });

    it('should update existing environment', async () => {
      const fs = await import('fs/promises');
      await fs.writeFile(
        testConfigPath,
        JSON.stringify({
          version: '1.0.0',
          environments: {
            'existing-env': {
              name: 'existing-env',
              provider: 'gcp',
              status: 'active',
              services: [],
              resources: {},
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          },
        })
      );
      const env: EnvironmentRecord = {
        name: 'existing-env',
        provider: 'gcp',
        status: 'failed',
        services: [],
        resources: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        error: 'Test error',
      };
      await store.saveEnvironment(env);
      const config = await store.load();
      expect(config.environments['existing-env']?.status).toBe('failed');
    });
  });

  describe('deleteEnvironment', () => {
    it('should remove environment by name', async () => {
      const fs = await import('fs/promises');
      await fs.writeFile(
        testConfigPath,
        JSON.stringify({
          version: '1.0.0',
          environments: {
            'to-delete': {
              name: 'to-delete',
              provider: 'gcp',
              status: 'active',
              services: [],
              resources: {},
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          },
        })
      );
      await store.deleteEnvironment('to-delete');
      const config = await store.load();
      expect(config.environments['to-delete']).toBeUndefined();
    });
  });

  describe('listEnvironments', () => {
    it('should return all environments', async () => {
      const fs = await import('fs/promises');
      await fs.writeFile(
        testConfigPath,
        JSON.stringify({
          version: '1.0.0',
          environments: {
            env1: {
              name: 'env1',
              provider: 'gcp',
              status: 'active',
              services: [],
              resources: {},
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
            env2: {
              name: 'env2',
              provider: 'aws',
              status: 'active',
              services: [],
              resources: {},
              createdAt: '2026-01-02T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
            },
          },
        })
      );
      const envs = await store.listEnvironments();
      expect(envs).toHaveLength(2);
    });
  });

  describe('setProvider', () => {
    it('should set provider config', async () => {
      await store.setProvider('gcp', 'us-central1');
      const config = await store.load();
      expect(config.provider).toBe('gcp');
      expect(config.defaultRegion).toBe('us-central1');
    });
  });
});
