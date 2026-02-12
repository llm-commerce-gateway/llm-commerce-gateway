import test from 'node:test';
import assert from 'node:assert/strict';
import { registry_list_gateways } from '../tools/registry_list_gateways.js';
import { MemoryRegistryStore } from '../store/memory.js';

const mockStore = new MemoryRegistryStore();

const baseContext = {
  store: mockStore,
  auth: {
    userId: 'user_123',
    organizationId: 'clx1234567890abcdef',
    isSuperAdmin: false,
    permissions: { canRead: true, canWrite: false, canAdmin: false },
  },
};

test('registry_list_gateways enforces tenant boundary', async () => {
  const result = await registry_list_gateways.execute({}, baseContext);

  assert.ok(result, 'expected result');
  assert.equal(result.organizationId, baseContext.auth.organizationId);
  assert.ok(Array.isArray(result.gateways));
});

test('registry_list_gateways rejects missing organizationId', async () => {
  const context = {
    ...baseContext,
    auth: { ...baseContext.auth, organizationId: '' },
  };

  await assert.rejects(registry_list_gateways.execute({}, context), /organizationId is required/);
});

test('registry_list_gateways rejects missing canRead permission', async () => {
  const context = {
    ...baseContext,
    auth: {
      ...baseContext.auth,
      permissions: { ...baseContext.auth.permissions, canRead: false },
    },
  };

  await assert.rejects(
    registry_list_gateways.execute({}, context),
    /Permission denied: canRead required/,
  );
});
