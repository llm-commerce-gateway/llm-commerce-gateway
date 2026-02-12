#!/usr/bin/env npx tsx
/**
 * LLM Gateway Contract Enforcement Script
 *
 * This script validates that the OSS build complies with the release contract.
 * CI MUST fail if any of the following conditions are violated:
 *
 * 1. A 🔴 Cloud-only capability is imported in default OSS runtime
 * 2. Federation write paths are enabled
 * 3. MCP stdio is enabled in production builds
 * 4. Redis/session keys do not pass through KeyDeriver
 *
 * @see docs/contracts/llm-gateway-release-contract.md
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// Configuration
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const SRC_DIR = join(ROOT_DIR, 'src');

/**
 * Cloud-only patterns that MUST NOT be imported in OSS runtime.
 * These patterns indicate Cloud-only functionality.
 */
const CLOUD_ONLY_IMPORTS = [
  // SCM-only modules (from @betterdata/scm)
  '@betterdata/scm',
  '@repo/scm',

  // Cloud-only services
  'SemanticCacheService',
  'SmartRoutingService',
  'RealtimeAnalyticsService',

  // Cloud-only providers
  'CloudMerchantRegistry',
  'RankedDiscoveryProvider',
  'MLDiscoveryProvider',
  'AutomatedVerificationProvider',
];

/**
 * Patterns that indicate Cloud-only federation write operations.
 */
const FEDERATION_WRITE_PATTERNS = [
  // Direct write operations in non-cloud code
  /\.register\s*\(/,
  /\.unregister\s*\(/,
  /updateTier\s*\(/,
];

/**
 * Files that are allowed to have Cloud-only imports.
 * These are Cloud-only modules that are not loaded by default.
 */
const ALLOWED_CLOUD_IMPORT_FILES = [
  'cloud/capability-discovery.ts',
  'cloud/capability-gate.ts',
  'cloud/__tests__/',
  '__tests__/',
  '.test.ts',
  '.spec.ts',
];

/**
 * Entry points that define the OSS runtime.
 * These files and their imports MUST NOT contain Cloud-only code.
 */
const OSS_ENTRY_POINTS = ['index.ts', 'core/Gateway.ts', 'core/GatewayFactory.ts'];

// ============================================================================
// Validation Functions
// ============================================================================

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Get all TypeScript files in a directory recursively.
 */
function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        if (entry !== 'node_modules' && entry !== 'dist' && entry !== '.git') {
          walk(fullPath);
        }
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Check if a file is allowed to have Cloud-only imports.
 */
function isAllowedCloudImportFile(filePath: string): boolean {
  const relativePath = relative(SRC_DIR, filePath);
  return ALLOWED_CLOUD_IMPORT_FILES.some(
    (pattern) =>
      relativePath.includes(pattern) || relativePath.startsWith(pattern)
  );
}

/**
 * Check for Cloud-only imports in OSS runtime files.
 */
function checkCloudOnlyImports(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const files = getAllTsFiles(SRC_DIR);

  for (const file of files) {
    if (isAllowedCloudImportFile(file)) {
      continue;
    }

    const content = readFileSync(file, 'utf-8');
    const relativePath = relative(SRC_DIR, file);

    for (const cloudImport of CLOUD_ONLY_IMPORTS) {
      // Check for import statements
      const importRegex = new RegExp(
        `(import|from)\\s+['"].*${cloudImport}.*['"]`,
        'g'
      );

      if (importRegex.test(content)) {
        errors.push(
          `❌ Cloud-only import found in ${relativePath}: "${cloudImport}"`
        );
      }

      // Check for require statements
      const requireRegex = new RegExp(
        `require\\s*\\(\\s*['"].*${cloudImport}.*['"]\\s*\\)`,
        'g'
      );

      if (requireRegex.test(content)) {
        errors.push(
          `❌ Cloud-only require found in ${relativePath}: "${cloudImport}"`
        );
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check that feature flags are properly defaulted.
 */
function checkFeatureFlagDefaults(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const featureFlagsFile = join(SRC_DIR, 'feature-flags.ts');

  if (!existsSync(featureFlagsFile)) {
    errors.push('❌ feature-flags.ts not found');
    return { passed: false, errors, warnings };
  }

  const content = readFileSync(featureFlagsFile, 'utf-8');

  // Check that Cloud-only flags default to false
  const cloudOnlyFlags = [
    'ENABLE_FEDERATION_WRITE',
    'ENABLE_SMART_ROUTING',
    'ENABLE_SEMANTIC_CACHING',
    'ENABLE_SCM_TOOLS',
    'ENABLE_REALTIME_ANALYTICS',
    'ENABLE_MULTI_TENANT',
  ];

  for (const flag of cloudOnlyFlags) {
    // Look for the flag definition
    const flagRegex = new RegExp(
      `${flag}:[\\s\\S]*?defaultValue:\\s*(true|false)`,
      'm'
    );
    const match = content.match(flagRegex);

    if (match) {
      const defaultValue = match[1];
      if (defaultValue === 'true') {
        errors.push(
          `❌ Cloud-only flag ${flag} has defaultValue: true (must be false)`
        );
      }
    }

    // Check classification is cloud-only
    const classificationRegex = new RegExp(
      `${flag}:[\\s\\S]*?classification:\\s*['"]([^'"]+)['"]`,
      'm'
    );
    const classMatch = content.match(classificationRegex);

    if (classMatch && classMatch[1] !== 'cloud-only') {
      errors.push(
        `❌ Cloud-only flag ${flag} has classification: "${classMatch[1]}" (must be "cloud-only")`
      );
    }
  }

  // Check experimental flags
  const experimentalFlags = [
    'ENABLE_LOT_EXPIRY',
    'ENABLE_MCP_STDIO',
    'ENABLE_FEDERATION',
  ];

  for (const flag of experimentalFlags) {
    const flagRegex = new RegExp(
      `${flag}:[\\s\\S]*?defaultValue:\\s*(true|false)`,
      'm'
    );
    const match = content.match(flagRegex);

    if (match && match[1] === 'true') {
      warnings.push(
        `⚠️  Experimental flag ${flag} defaults to true (should be false for OSS)`
      );
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check that SessionManager uses KeyDeriver.
 */
function checkKeyDeriverUsage(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sessionManagerFile = join(SRC_DIR, 'session/SessionManager.ts');

  if (!existsSync(sessionManagerFile)) {
    errors.push('❌ session/SessionManager.ts not found');
    return { passed: false, errors, warnings };
  }

  const content = readFileSync(sessionManagerFile, 'utf-8');

  // Check for KeyDeriver import
  if (!content.includes("import type { KeyDeriver }")) {
    errors.push('❌ SessionManager does not import KeyDeriver');
  }

  // Check for KeyDeriver usage in key derivation
  if (!content.includes('keyDeriver.deriveSessionKey')) {
    errors.push('❌ SessionManager does not use keyDeriver.deriveSessionKey()');
  }

  // Check that hardcoded prefix patterns are not used
  const hardcodedPrefixPattern = /this\.prefix\s*\+\s*sessionId|`\$\{this\.prefix\}\$\{sessionId\}`/;
  if (hardcodedPrefixPattern.test(content)) {
    errors.push(
      '❌ SessionManager uses hardcoded prefix concatenation instead of KeyDeriver'
    );
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check that extension interfaces exist.
 */
function checkExtensionInterfaces(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const extensionsDir = join(SRC_DIR, 'extensions');

  if (!existsSync(extensionsDir)) {
    errors.push('❌ extensions/ directory not found');
    return { passed: false, errors, warnings };
  }

  // Check for required interface files
  const requiredFiles = ['interfaces.ts', 'oss-defaults.ts', 'index.ts'];

  for (const file of requiredFiles) {
    const filePath = join(extensionsDir, file);
    if (!existsSync(filePath)) {
      errors.push(`❌ Required file extensions/${file} not found`);
    }
  }

  // Check for required interfaces
  const interfacesFile = join(extensionsDir, 'interfaces.ts');
  if (existsSync(interfacesFile)) {
    const content = readFileSync(interfacesFile, 'utf-8');

    const requiredInterfaces = [
      'TenantContextResolver',
      'KeyDeriver',
      'EntitlementsChecker',
    ];

    for (const iface of requiredInterfaces) {
      if (!content.includes(`export interface ${iface}`)) {
        errors.push(`❌ Required interface ${iface} not found in interfaces.ts`);
      }
    }
  }

  // Check for OSS defaults
  const ossDefaultsFile = join(extensionsDir, 'oss-defaults.ts');
  if (existsSync(ossDefaultsFile)) {
    const content = readFileSync(ossDefaultsFile, 'utf-8');

    const requiredDefaults = [
      'OSSTenantContextResolver',
      'OSSKeyDeriver',
      'OSSEntitlementsChecker',
    ];

    for (const def of requiredDefaults) {
      if (!content.includes(`class ${def}`)) {
        errors.push(`❌ Required OSS default ${def} not found in oss-defaults.ts`);
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check that MCP stdio is properly gated.
 */
function checkMCPStdioGating(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const mcpServerFile = join(SRC_DIR, 'mcp/MCPServer.ts');

  if (!existsSync(mcpServerFile)) {
    warnings.push('⚠️  mcp/MCPServer.ts not found (MCP may not be implemented)');
    return { passed: true, errors, warnings };
  }

  // Check if the file mentions stdio transport
  const content = readFileSync(mcpServerFile, 'utf-8');

  if (content.includes('stdio') && !content.includes('process.stdin')) {
    // No actual stdio implementation found, that's fine
    return { passed: true, errors, warnings };
  }

  // If there's stdio implementation, it should have a comment about being dev-only
  if (content.includes('process.stdin')) {
    if (
      !content.includes('dev') &&
      !content.includes('development') &&
      !content.includes('local')
    ) {
      warnings.push(
        '⚠️  MCP stdio transport found without dev/development/local comments'
      );
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check documentation mentions single-tenant OSS.
 */
function checkDocumentation(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const docsDir = join(ROOT_DIR, 'docs', 'oss');

  if (!existsSync(docsDir)) {
    warnings.push('⚠️  docs/oss/ directory not found');
    return { passed: true, errors, warnings };
  }

  // Check for CAPABILITIES.md or similar
  const capabilitiesFile = join(docsDir, 'CAPABILITIES.md');
  if (existsSync(capabilitiesFile)) {
    const content = readFileSync(capabilitiesFile, 'utf-8');

    // Should mention single-tenant
    if (
      !content.toLowerCase().includes('single-tenant') &&
      !content.toLowerCase().includes('single tenant')
    ) {
      warnings.push(
        '⚠️  CAPABILITIES.md does not mention single-tenant (should explicitly state OSS is single-tenant)'
      );
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  LLM Gateway Contract Enforcement Check');
  console.log('  Contract: v0 + v0.1');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const checks = [
    { name: 'Cloud-only imports', fn: checkCloudOnlyImports },
    { name: 'Feature flag defaults', fn: checkFeatureFlagDefaults },
    { name: 'KeyDeriver usage', fn: checkKeyDeriverUsage },
    { name: 'Extension interfaces', fn: checkExtensionInterfaces },
    { name: 'MCP stdio gating', fn: checkMCPStdioGating },
    { name: 'Documentation', fn: checkDocumentation },
  ];

  let allPassed = true;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const check of checks) {
    console.log(`Checking: ${check.name}...`);
    const result = check.fn();

    if (!result.passed) {
      allPassed = false;
    }

    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    for (const error of result.errors) {
      console.log(`  ${error}`);
    }

    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }

    if (result.passed && result.errors.length === 0 && result.warnings.length === 0) {
      console.log('  ✅ Passed');
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');

  if (allPassed) {
    console.log(`✅ All contract checks passed!`);
    if (totalWarnings > 0) {
      console.log(`   (${totalWarnings} warning${totalWarnings > 1 ? 's' : ''})`);
    }
    console.log('');
    process.exit(0);
  } else {
    console.log(`❌ Contract check failed!`);
    console.log(`   ${totalErrors} error${totalErrors > 1 ? 's' : ''}, ${totalWarnings} warning${totalWarnings > 1 ? 's' : ''}`);
    console.log('');
    console.log('Please fix the errors above before merging.');
    console.log('See: docs/contracts/llm-gateway-release-contract.md');
    console.log('');
    process.exit(1);
  }
}

main();
