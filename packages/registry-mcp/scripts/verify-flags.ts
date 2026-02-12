/**
 * Feature Flag Validation
 * Tests that flags can be toggled on/off
 */

import { isEnabled } from '../src/flags.ts';

async function validateFlags() {
  console.log('Validating feature flags...\n');

  const flags = [
    'oss_registry_discovery',
    'oss_registry_metadata',
  ] as const;

  const results: Record<string, { on: boolean; off: boolean }> = {};

  for (const flag of flags) {
    // Test default (ON)
    const defaultState = isEnabled(flag);
    console.log(`${flag}: default=${defaultState}`);

    // Test OFF state
    const envVar = flag.toUpperCase();
    const originalEnv = process.env[envVar];

    process.env[envVar] = 'false';
    const offState = isEnabled(flag);

    process.env[envVar] = 'true';
    const onState = isEnabled(flag);

    // Restore
    if (originalEnv === undefined) {
      delete process.env[envVar];
    } else {
      process.env[envVar] = originalEnv;
    }

    results[flag] = { on: onState, off: !offState };

    console.log(`  - ON state:  ${onState ? 'ok' : 'fail'}`);
    console.log(`  - OFF state: ${!offState ? 'ok' : 'fail'}`);
  }

  console.log('\n--- Summary ---');
  const allPassed = Object.values(results).every((r) => r.on && r.off);
  console.log(allPassed
    ? 'All flags validated (on/off working)'
    : 'Some flags not working correctly'
  );

  return allPassed;
}

validateFlags();
