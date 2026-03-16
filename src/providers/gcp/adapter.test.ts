import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GcpAdapter } from './adapter.js';

vi.mock('@google-cloud/resource-manager', () => ({
  ProjectsClient: vi.fn().mockImplementation(() => ({
      getProjects: vi.fn().mockResolvedValue([[{ projectId: 'test-project', name: 'Test' }]]),
      getIamPolicy: vi.fn().mockResolvedValue([{ bindings: [] }]),
  })),
}));

describe('GcpAdapter', () => {
  let adapter: GcpAdapter;

  beforeEach(() => {
    adapter = new GcpAdapter();
  });

  describe('init', () => {
    it('should exist and be callable', async () => {
      expect(typeof adapter.init).toBe('function');
    });
  });

  describe('interface compliance', () => {
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
