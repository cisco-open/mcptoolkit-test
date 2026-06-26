// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Golden File Manager - Save/load/compare baseline responses
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { GoldenFile, ToolResult, ComparisonResult, Difference, FuzzyMatchOptions } from './types.js';

/** ISO 8601 timestamp value, e.g. 2025-12-25T10:00:00Z or 2025-12-25T10:00:00.000Z */
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?$/;
/** UUID value (any version) */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class GoldenFileManager {
  constructor(private goldenDir: string) {}

  /**
   * Save a golden file
   */
  async save(scenarioName: string, toolName: string, result: ToolResult, fuzzyFields?: string[]): Promise<void> {
    const golden: GoldenFile = {
      scenarioName,
      toolName,
      recordedAt: new Date().toISOString(),
      response: result,
      fuzzyFields,
      metadata: {
        mcptestVersion: '0.4.0'
      }
    };

    const filePath = this.getFilePath(scenarioName, toolName);
    const dir = dirname(filePath);
    
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(filePath, JSON.stringify(golden, null, 2), 'utf-8');
  }

  /**
   * Load a golden file
   */
  async load(scenarioName: string, toolName: string): Promise<GoldenFile | null> {
    const filePath = this.getFilePath(scenarioName, toolName);
    
    if (!existsSync(filePath)) {
      return null;
    }

    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as GoldenFile;
  }

  /**
   * Compare actual result against golden file
   */
  async compare(
    scenarioName: string,
    toolName: string,
    actual: ToolResult,
    options?: FuzzyMatchOptions
  ): Promise<ComparisonResult> {
    const golden = await this.load(scenarioName, toolName);

    if (!golden) {
      return {
        match: false,
        differences: [{
          path: '<root>',
          expected: 'golden file exists',
          actual: 'no golden file found',
          type: 'missing'
        }]
      };
    }

    return this.compareResults(golden.response, actual, golden.fuzzyFields, options);
  }

  /**
   * Compare two tool results
   */
  private compareResults(
    expected: ToolResult,
    actual: ToolResult,
    fuzzyFields?: string[],
    options?: FuzzyMatchOptions
  ): ComparisonResult {
    const differences: Difference[] = [];
    const fuzzyMatched: string[] = [];

    // Compare success status
    if (expected.success !== actual.success) {
      differences.push({
        path: 'success',
        expected: expected.success,
        actual: actual.success,
        type: 'value-mismatch'
      });
    }

    // Compare results structurally, applying fuzzy rules on the parsed values
    const expectedJson = JSON.stringify(expected.result);
    const actualJson = JSON.stringify(actual.result);

    if (expectedJson !== actualJson) {
      const fuzzy = this.compareValues(expected.result, actual.result, fuzzyFields, options);

      if (!fuzzy.match) {
        differences.push({
          path: 'result',
          expected: expected.result,
          actual: actual.result,
          type: 'value-mismatch'
        });
      } else if (fuzzy.fuzzyMatched) {
        fuzzyMatched.push(...fuzzy.fuzzyMatched);
      }
    }

    // Compare error if present
    if (expected.error || actual.error) {
      if (!expected.error && actual.error) {
        differences.push({
          path: 'error',
          expected: undefined,
          actual: actual.error,
          type: 'extra'
        });
      } else if (expected.error && !actual.error) {
        differences.push({
          path: 'error',
          expected: expected.error,
          actual: undefined,
          type: 'missing'
        });
      } else if (expected.error && actual.error) {
        if (expected.error.code !== actual.error.code || expected.error.message !== actual.error.message) {
          differences.push({
            path: 'error',
            expected: expected.error,
            actual: actual.error,
            type: 'value-mismatch'
          });
        }
      }
    }

    return {
      match: differences.length === 0,
      differences: differences.length > 0 ? differences : undefined,
      fuzzyMatched: fuzzyMatched.length > 0 ? fuzzyMatched : undefined
    };
  }

  /**
   * Compare two result values structurally, applying fuzzy rules.
   *
   * Fuzzy matching operates on the parsed structure (not serialized text):
   * - Built-in `ignoreTimestamps` / `ignoreIds` (or the `timestamp` / `id`
   *   keywords in `fuzzyFields`) normalize ISO timestamps, UUIDs, and `id`-like
   *   properties by value/key.
   * - Any other entry in `fuzzyFields` (or `options.customFields`) is treated as
   *   a property name whose value is ignored wherever it appears in the result.
   */
  private compareValues(
    expected: unknown,
    actual: unknown,
    fuzzyFields?: string[],
    options?: FuzzyMatchOptions
  ): { match: boolean; fuzzyMatched?: string[] } {
    // Reserved keywords keep their historical meaning: enabling timestamp/id rules.
    const ignoreTimestamps = Boolean(options?.ignoreTimestamps || fuzzyFields?.includes('timestamp'));
    const ignoreIds = Boolean(options?.ignoreIds || fuzzyFields?.includes('id'));

    const customFields = new Set<string>();
    for (const field of fuzzyFields || []) {
      if (field !== 'timestamp' && field !== 'id') {
        customFields.add(field);
      }
    }
    for (const field of options?.customFields || []) {
      customFields.add(field);
    }

    const applied = new Set<string>();
    const rules = { ignoreTimestamps, ignoreIds, customFields };

    const normExpected = this.normalizeValue(expected, rules, applied);
    const normActual = this.normalizeValue(actual, rules, applied);

    const match = JSON.stringify(normExpected) === JSON.stringify(normActual);
    if (match && applied.size > 0) {
      return { match: true, fuzzyMatched: [...applied] };
    }
    return { match };
  }

  /**
   * Recursively normalize a value for fuzzy comparison, replacing volatile
   * fields with stable placeholders. Records which fuzzy categories/fields were
   * applied in `applied`.
   */
  private normalizeValue(
    value: unknown,
    rules: { ignoreTimestamps: boolean; ignoreIds: boolean; customFields: Set<string> },
    applied: Set<string>,
    key?: string
  ): unknown {
    // Key-based rules: ignore the entire value regardless of its type.
    if (key !== undefined) {
      if (rules.customFields.has(key)) {
        applied.add(key);
        return '<FUZZY>';
      }
      if (rules.ignoreIds && this.isIdKey(key)) {
        applied.add('ids');
        return '<ID>';
      }
    }

    // Value-pattern rules for string leaves.
    if (typeof value === 'string') {
      if (rules.ignoreIds && UUID_PATTERN.test(value)) {
        applied.add('ids');
        return '<UUID>';
      }
      if (rules.ignoreTimestamps && TIMESTAMP_PATTERN.test(value)) {
        applied.add('timestamps');
        return '<TIMESTAMP>';
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeValue(item, rules, applied));
    }

    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = this.normalizeValue(v, rules, applied, k);
      }
      return out;
    }

    return value;
  }

  /**
   * Determine whether a property key represents an identifier (e.g. `id`,
   * `sessionId`, `user_id`). Avoids false positives like `valid` or `paid`.
   */
  private isIdKey(key: string): boolean {
    return key.toLowerCase() === 'id' || /[a-z0-9]Id$/.test(key) || /_id$/i.test(key);
  }

  /**
   * Get file path for golden file
   */
  private getFilePath(scenarioName: string, toolName: string): string {
    const sanitizedScenario = scenarioName.replace(/[^a-z0-9-_]/gi, '-');
    const sanitizedTool = toolName.replace(/[^a-z0-9-_]/gi, '-');
    return resolve(this.goldenDir, `${sanitizedScenario}__${sanitizedTool}.golden.json`);
  }

  /**
   * Check if golden file exists
   */
  exists(scenarioName: string, toolName: string): boolean {
    return existsSync(this.getFilePath(scenarioName, toolName));
  }

  /**
   * List all golden files
   */
  async list(): Promise<string[]> {
    const { readdir } = await import('node:fs/promises');
    try {
      const files = await readdir(this.goldenDir);
      return files.filter(f => f.endsWith('.golden.json'));
    } catch {
      return [];
    }
  }
}
