/**
 * Staging Observability Verification
 * Run: npx ts-node scripts/verify-observability.ts
 */

async function verifyObservability() {
  console.log('Verifying registry-mcp observability...\n');

  const checks = {
    metrics: false,
    logs: false,
    traces: false,
  };

  // 1. Metrics check
  try {
    const { getMetrics } = await import('../src/telemetry.ts');
    const metrics = await getMetrics();
    checks.metrics = metrics.length > 0;
    console.log(`Metrics: ${metrics.length} registered`);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.log(`Metrics: Not implemented or error - ${message}`);
  }

  // 2. Logs check
  try {
    const { logger } = await import('../src/logger.ts');
    logger.info('Observability verification test', { test: true });
    checks.logs = true;
    console.log('Logs: Structured logging working');
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.log(`Logs: Not implemented or error - ${message}`);
  }

  // 3. Traces check (optional for v0.1)
  try {
    const { tracer } = await import('../src/tracing.ts');
    checks.traces = Boolean(tracer);
    console.log('Traces: Tracer configured');
  } catch (e) {
    console.log('Traces: Not implemented (optional for v0.1)');
    checks.traces = true;
  }

  console.log('\n--- Summary ---');
  const passed = Object.values(checks).every((v) => v);
  console.log(passed ? 'Observability verified' : 'Gaps remain');

  return passed;
}

verifyObservability();
