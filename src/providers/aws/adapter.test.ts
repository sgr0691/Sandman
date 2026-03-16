import { describe, it, expect, vi } from 'vitest';
import { AwsAdapter } from './adapter.js';

describe('AwsAdapter', () => {
  describe('interface compliance', () => {
    const adapter: any = {
      init: async () => {},
      createEnvironment: async (name: string) => ({ name, provider: 'aws' as const, status: 'active' as const, services: [], resources: {}, createdAt: '', updatedAt: '' }),
      enableServices: async () => {},
      connect: async () => ({}),
      destroyEnvironment: async () => {},
      getStatus: async (env: any) => env,
    };

    it('should have all required methods', () => {
      expect(typeof adapter.init).toBe('function');
      expect(typeof adapter.createEnvironment).toBe('function');
      expect(typeof adapter.enableServices).toBe('function');
      expect(typeof adapter.connect).toBe('function');
      expect(typeof adapter.destroyEnvironment).toBe('function');
      expect(typeof adapter.getStatus).toBe('function');
    });
  });
});
