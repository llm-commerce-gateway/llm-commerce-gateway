/**
 * @betterdata/commerce-gateway - Telemetry Tests
 *
 * Ensures telemetry payload is anonymous, aggregate, and schema-locked.
 *
 * @license MIT
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { TelemetryService } from '../../src/telemetry/TelemetryService';
import { TelemetryPayloadSchema } from '../../src/telemetry/types';

const FORBIDDEN_FIELD_SUBSTRINGS = [
  'prompt',
  'input',
  'output',
  'request',
  'response',
  'headers',
  'authorization',
  'apikey',
  'secret',
  'token',
  'org',
  'customer',
  'tenant',
  'email',
  'domain',
  'payload',
  'body',
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, '../../../../docs/telemetry/schema.json');

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }

  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
      keys.push(key);
      collectKeys(nested, keys);
    });
  }

  return keys;
}

function collectSchemaKeys(schema: SchemaNode, keys: string[] = []): string[] {
  if (schema?.properties && typeof schema.properties === 'object') {
    Object.entries(schema.properties).forEach(([key, child]) => {
      keys.push(key);
      collectSchemaKeys(child as SchemaNode, keys);
    });
  }

  return keys;
}

type SchemaNode = {
  type?: string;
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  minimum?: number;
};

function validateAgainstSchema(schema: SchemaNode, value: unknown, pathLabel = 'root'): void {
  if (schema.const !== undefined) {
    expect(value).toEqual(schema.const);
    return;
  }

  if (schema.enum) {
    expect(schema.enum).toContain(value);
    return;
  }

  switch (schema.type) {
    case 'object': {
      expect(value).not.toBeNull();
      expect(typeof value).toBe('object');
      expect(Array.isArray(value)).toBe(false);

      const record = value as Record<string, unknown>;
      const required = schema.required ?? [];
      required.forEach((key) => {
        expect(record).toHaveProperty(key);
      });

      if (schema.additionalProperties === false) {
        const allowedKeys = Object.keys(schema.properties ?? {});
        const valueKeys = Object.keys(record);
        valueKeys.forEach((key) => {
          expect(allowedKeys).toContain(key);
        });
      }

      Object.entries(schema.properties ?? {}).forEach(([key, child]) => {
        if (record[key] !== undefined) {
          validateAgainstSchema(child, record[key], `${pathLabel}.${key}`);
        }
      });
      return;
    }
    case 'array': {
      expect(Array.isArray(value)).toBe(true);
      (value as unknown[]).forEach((item) => {
        validateAgainstSchema(schema.items ?? {}, item, `${pathLabel}[]`);
      });
      return;
    }
    case 'string':
      expect(typeof value).toBe('string');
      return;
    case 'integer':
      expect(typeof value).toBe('number');
      expect(Number.isInteger(value)).toBe(true);
      if (schema.minimum !== undefined) {
        expect(value as number).toBeGreaterThanOrEqual(schema.minimum);
      }
      return;
    case 'number':
      expect(typeof value).toBe('number');
      if (schema.minimum !== undefined) {
        expect(value as number).toBeGreaterThanOrEqual(schema.minimum);
      }
      return;
    case 'boolean':
      expect(typeof value).toBe('boolean');
      return;
    default:
      throw new Error(`Unsupported schema type at ${pathLabel}`);
  }
}

describe('TelemetryService', () => {
  let schema: SchemaNode;

  beforeEach(async () => {
    const raw = await readFile(SCHEMA_PATH, 'utf-8');
    schema = JSON.parse(raw) as SchemaNode;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a payload that matches the canonical schema', () => {
    const telemetry = new TelemetryService();
    telemetry.recordRequest();
    telemetry.recordToolInvocation('openai');

    const payload = telemetry.buildTelemetryPayload({ toolCount: 3 });

    expect(() => TelemetryPayloadSchema.parse(payload)).not.toThrow();
    validateAgainstSchema(schema, payload);
  });

  it('does not include forbidden fields in payload shape', () => {
    const telemetry = new TelemetryService();
    const payload = telemetry.buildTelemetryPayload({ toolCount: 0 });

    const keys = collectKeys(payload).map((key) => key.toLowerCase());
    const allowedKeys = new Set(collectSchemaKeys(schema).map((key) => key.toLowerCase()));
    const forbiddenFound = keys.filter((key) => {
      if (allowedKeys.has(key)) {
        return false;
      }
      return FORBIDDEN_FIELD_SUBSTRINGS.some((fragment) => key.includes(fragment));
    });

    expect(forbiddenFound).toEqual([]);
  });

  it('defaults telemetry to disabled', () => {
    const telemetry = new TelemetryService();

    expect(telemetry.isEnabled()).toBe(false);
  });

  it('matches schema shape and forbids additional properties', () => {
    const telemetry = new TelemetryService();
    const payload = telemetry.buildTelemetryPayload({ toolCount: 1 });

    const topLevelKeys = Object.keys(payload).sort();
    const allowedTopLevelKeys = Object.keys(schema.properties ?? {}).sort();
    expect(topLevelKeys).toEqual(allowedTopLevelKeys);

    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties?.gateway?.additionalProperties).toBe(false);
    expect(schema.properties?.features?.additionalProperties).toBe(false);
    expect(schema.properties?.usage?.additionalProperties).toBe(false);
    expect(schema.properties?.health?.additionalProperties).toBe(false);
  });

  it('does not send telemetry when disabled', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchSpy;

    const telemetry = new TelemetryService();
    telemetry.startSender({ toolCount: 0 });

    await vi.runOnlyPendingTimersAsync();

    expect(fetchSpy).not.toHaveBeenCalled();
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });
});
