/**
 * @betterdata/commerce-gateway - Logger Tests
 * 
 * Unit tests for the structured logging system.
 * 
 * @license MIT
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConsoleLogger,
  StructuredLogger,
  NoOpLogger,
  TestLogger,
  setLogger,
  getLogger,
  resetLogger,
  type Logger,
  type LogEntry,
} from '../../src/observability/index';

describe('ConsoleLogger', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const consoleSpy: Record<string, any> = {};

  beforeEach(() => {
    consoleSpy.log = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleSpy.info = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleSpy.warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleSpy.error = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleSpy.debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log debug messages', () => {
    const logger = new ConsoleLogger('Test', { level: 'debug', json: false });

    logger.debug('Debug message', { key: 'value' });

    expect(consoleSpy.log).toHaveBeenCalled();
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).toContain('DEBUG');
    expect(output).toContain('Test');
    expect(output).toContain('Debug message');
  });

  it('should log info messages', () => {
    const logger = new ConsoleLogger('Test', { level: 'debug', json: false });

    logger.info('Info message');

    expect(consoleSpy.log).toHaveBeenCalled();
    const output = consoleSpy.log.mock.calls[0][0] as string;
    expect(output).toContain('INFO');
  });

  it('should log warn messages', () => {
    const logger = new ConsoleLogger('Test', { level: 'debug', json: false });

    logger.warn('Warning message');

    expect(consoleSpy.warn).toHaveBeenCalled();
    const output = consoleSpy.warn.mock.calls[0][0] as string;
    expect(output).toContain('WARN');
  });

  it('should log error messages with stack trace', () => {
    const logger = new ConsoleLogger('Test', { level: 'debug', json: false });
    const error = new Error('Test error');

    logger.error('Error occurred', error);

    expect(consoleSpy.error).toHaveBeenCalled();
    const output = consoleSpy.error.mock.calls[0][0] as string;
    expect(output).toContain('ERROR');
    expect(output).toContain('Error occurred');
  });

  it('should respect log level', () => {
    const logger = new ConsoleLogger('Test', { level: 'warn', json: false });

    logger.debug('Debug');
    logger.info('Info');
    logger.warn('Warn');
    logger.error('Error', null);

    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it('should output JSON in json mode', () => {
    const logger = new ConsoleLogger('Test', { level: 'debug', json: true });

    logger.info('Test message', { key: 'value' });

    expect(consoleSpy.log).toHaveBeenCalled();
    const output = consoleSpy.log.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Test message');
    expect(parsed.context).toBe('Test');
    expect(parsed.meta.key).toBe('value');
  });

  it('should create child logger with combined context', () => {
    const parent = new ConsoleLogger('Parent', { level: 'debug', json: true });
    const child = parent.child('Child');

    child.info('Child message');

    expect(consoleSpy.log).toHaveBeenCalled();
    const output = consoleSpy.log.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    
    expect(parsed.context).toBe('Parent:Child');
  });
});

describe('StructuredLogger', () => {
  it('should delegate to external logger', () => {
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const logger = new StructuredLogger(mockLogger, 'Test');

    logger.info('Test message', { key: 'value' });

    expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
      context: 'Test',
      key: 'value',
    });
  });

  it('should include error details in error logs', () => {
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const logger = new StructuredLogger(mockLogger, 'Test');
    const error = new Error('Test error');

    logger.error('Something failed', error, { extra: 'data' });

    expect(mockLogger.error).toHaveBeenCalled();
    const call = mockLogger.error.mock.calls[0];
    expect(call[0]).toBe('Something failed');
    expect(call[1].error.message).toBe('Test error');
    expect(call[1].extra).toBe('data');
  });

  it('should use child method if available', () => {
    const childLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnValue(childLogger),
    };

    const logger = new StructuredLogger(mockLogger, 'Parent');
    const child = logger.child('Child');

    child.info('Child message');

    expect(mockLogger.child).toHaveBeenCalledWith({ context: 'Parent:Child' });
    expect(childLogger.info).toHaveBeenCalled();
  });
});

describe('NoOpLogger', () => {
  it('should not throw when calling any method', () => {
    const logger = new NoOpLogger();

    expect(() => {
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error', new Error());
    }).not.toThrow();
  });

  it('should return self from child', () => {
    const logger = new NoOpLogger();
    const child = logger.child('Test');

    expect(child).toBe(logger);
  });
});

describe('TestLogger', () => {
  it('should capture log entries', () => {
    const logger = new TestLogger('Test');

    logger.info('Message 1', { key: 'value1' });
    logger.warn('Message 2');
    logger.error('Message 3', new Error('Test'));

    expect(logger.entries).toHaveLength(3);
    expect(logger.entries[0].level).toBe('info');
    expect(logger.entries[0].message).toBe('Message 1');
    expect(logger.entries[0].context).toBe('Test');
    expect(logger.entries[1].level).toBe('warn');
    expect(logger.entries[2].level).toBe('error');
  });

  it('should include error details', () => {
    const logger = new TestLogger();
    const error = new Error('Test error');

    logger.error('Failed', error);

    expect(logger.entries[0].meta?.error).toEqual({
      name: 'Error',
      message: 'Test error',
      stack: error.stack,
    });
  });

  it('should clear entries', () => {
    const logger = new TestLogger();

    logger.info('Message 1');
    logger.info('Message 2');

    expect(logger.entries).toHaveLength(2);

    logger.clear();

    expect(logger.entries).toHaveLength(0);
  });

  it('should filter by level', () => {
    const logger = new TestLogger();

    logger.debug('Debug');
    logger.info('Info');
    logger.warn('Warn');
    logger.error('Error', null);

    expect(logger.getByLevel('info')).toHaveLength(1);
    expect(logger.getByLevel('warn')).toHaveLength(1);
    expect(logger.getByLevel('error')).toHaveLength(1);
  });

  it('should check for message presence', () => {
    const logger = new TestLogger();

    logger.info('User logged in');
    logger.warn('Rate limit approaching');

    expect(logger.hasMessage('logged in')).toBe(true);
    expect(logger.hasMessage('Rate limit')).toBe(true);
    expect(logger.hasMessage('not found')).toBe(false);
  });

  it('should share entries with child logger', () => {
    const parent = new TestLogger('Parent');
    const child = parent.child('Child');

    parent.info('Parent message');
    child.info('Child message');

    expect(parent.entries).toHaveLength(2);
    expect(parent.entries[0].context).toBe('Parent');
    expect(parent.entries[1].context).toBe('Parent:Child');
  });
});

describe('Global Logger', () => {
  afterEach(() => {
    resetLogger();
  });

  it('should use default console logger', () => {
    const logger = getLogger();
    
    // Just verify it doesn't throw
    expect(() => logger.info('Test')).not.toThrow();
  });

  it('should allow setting custom logger', () => {
    const testLogger = new TestLogger();
    
    setLogger(testLogger);
    
    const logger = getLogger();
    logger.info('Test message');

    expect(testLogger.entries).toHaveLength(1);
    expect(testLogger.entries[0].message).toBe('Test message');
  });

  it('should create child logger with context', () => {
    const testLogger = new TestLogger();
    setLogger(testLogger);

    const child = getLogger('MyComponent');
    child.info('Component message');

    expect(testLogger.entries[0].context).toBe('MyComponent');
  });

  it('should reset to default logger', () => {
    const testLogger = new TestLogger();
    setLogger(testLogger);

    resetLogger();

    const logger = getLogger();
    // After reset, entries should not go to testLogger
    logger.info('After reset');

    expect(testLogger.entries).toHaveLength(0);
  });
});

