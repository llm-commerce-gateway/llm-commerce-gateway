import { validateTenantContext } from '../context';

describe('MCP Tenant Context', () => {
  it('should accept valid organizationId', () => {
    const context = {
      organizationId: 'clx1234567890abcdef',
      roles: [],
      permissions: {
        canReadRegistry: true,
        canWriteRegistry: false,
        isSuperAdmin: false,
      },
    };

    expect(() => validateTenantContext(context)).not.toThrow();
  });

  it('should reject missing organizationId', () => {
    const context = {
      organizationId: '',
      roles: [],
      permissions: {
        canReadRegistry: false,
        canWriteRegistry: false,
        isSuperAdmin: false,
      },
    };

    expect(() => validateTenantContext(context)).toThrow('organizationId is required');
  });
});
