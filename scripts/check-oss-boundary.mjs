#!/usr/bin/env node
/**
 * OSS Boundary Check
 *
 * Fails if OSS packages import proprietary modules.
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(__dirname, '..');

/**
 * Always-forbidden imports (regardless of whether target is a library or app).
 * Anything that imports internal proprietary surfaces.
 */
const BASE_FORBIDDEN_PREFIXES = [
  'betterdata-llm-gateway-adapters',
  '@betterdata/hosted-gateway',
  '@betterdata/hosted-gateway-mcp',
];

/**
 * Additional forbidden prefixes for library packages under packages/*.
 * Packages must not reach back into app code.
 */
const PACKAGE_FORBIDDEN_PREFIXES = ['apps/', 'apps\\'];

/**
 * Additional forbidden prefixes for OSS apps (gateway-console).
 * These are proprietary or hosted-only dependencies that must never appear
 * in an app shipped as part of the OSS distribution. Library packages may
 * legitimately declare some of these as type-only peer deps (e.g.
 * @prisma/client typing), so they are only enforced for apps.
 */
const APP_FORBIDDEN_PREFIXES = [
  '@repo/',
  '@prisma/',
  '@clerk/',
  'next-auth',
];

const DEFAULT_PACKAGES = [
  'packages/commerce-gateway',
  'packages/registry-mcp',
  'packages/commerce-gateway-mcp',
];

const SOURCE_DIR_CANDIDATES = ['src', 'app', 'lib', 'tests'];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);

function getArgValues(args, key) {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === key && args[i + 1]) {
      values.push(args[i + 1]);
      i += 1;
    }
  }
  return values;
}

function collectSourceFiles(dir) {
  const files = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else {
      const ext = fullPath.slice(fullPath.lastIndexOf('.'));
      if (SOURCE_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function extractImports(content) {
  const imports = [];
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  const requireRegex = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const regex of [importRegex, requireRegex, dynamicImportRegex]) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }
  return imports;
}

function scanPackage(pkgPath) {
  // When --package . is used (e.g. from registry-mcp), pkgPath is ".";
  // resolve(MONOREPO_ROOT, ".") yields MONOREPO_ROOT, which is wrong.
  // Use process.cwd() as package root when pkgPath is ".".
  const absPath =
    pkgPath === '.' ? resolve(process.cwd()) : resolve(MONOREPO_ROOT, pkgPath);
  const errors = [];

  // Packages (under packages/*) forbid cross-`apps/` imports but may have
  // type-only peer deps on Prisma/Clerk etc. Apps and examples forbid
  // proprietary and hosted-only deps absolutely — they ship to OSS consumers
  // who should never need a database or auth provider to run them.
  const isApp = pkgPath.startsWith('apps/') || pkgPath.startsWith('examples/');
  const forbiddenForThisTarget = isApp
    ? [...BASE_FORBIDDEN_PREFIXES, ...APP_FORBIDDEN_PREFIXES]
    : [...BASE_FORBIDDEN_PREFIXES, ...PACKAGE_FORBIDDEN_PREFIXES];

  // Scan any source-like directory that exists. This covers both library
  // packages (src/) and Next.js apps (app/, lib/).
  const dirsToScan = SOURCE_DIR_CANDIDATES
    .map((dir) => join(absPath, dir))
    .filter((dir) => {
      try {
        return statSync(dir).isDirectory();
      } catch {
        return false;
      }
    });

  if (dirsToScan.length === 0) {
    return [
      `No source directory found under ${relative(MONOREPO_ROOT, absPath)} (looked for: ${SOURCE_DIR_CANDIDATES.join(', ')})`,
    ];
  }

  for (const dir of dirsToScan) {
    const files = collectSourceFiles(dir);
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const imports = extractImports(content);
      for (const specifier of imports) {
        for (const prefix of forbiddenForThisTarget) {
          if (specifier.startsWith(prefix)) {
            errors.push(
              `Forbidden import "${specifier}" in ${relative(MONOREPO_ROOT, file)}`
            );
          }
        }
      }
    }
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const packages = getArgValues(args, '--package');
  const targets = packages.length > 0 ? packages : DEFAULT_PACKAGES;

  const allErrors = [];
  for (const target of targets) {
    allErrors.push(...scanPackage(target));
  }

  if (allErrors.length > 0) {
    console.error('❌ OSS boundary check failed:\n');
    for (const err of allErrors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log('✅ OSS boundary check passed.');
}

main();
