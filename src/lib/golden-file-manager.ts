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

    // Compare results as JSON
    const expectedJson = JSON.stringify(expected.result);
    const actualJson = JSON.stringify(actual.result);

    if (expectedJson !== actualJson) {
      const textDiff = this.compareText(
        expectedJson,
        actualJson,
        fuzzyFields,
        options
      );
      
      if (!textDiff.match) {
        differences.push({
          path: 'result',
          expected: expected.result,
          actual: actual.result,
          type: 'value-mismatch'
        });
      } else if (textDiff.fuzzyMatched) {
        fuzzyMatched.push(...textDiff.fuzzyMatched);
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
   * Compare text with fuzzy matching
   */
  private compareText(
    expected: string,
    actual: string,
    fuzzyFields?: string[],
    options?: FuzzyMatchOptions
  ): { match: boolean; fuzzyMatched?: string[] } {
    // Exact match
    if (expected === actual) {
      return { match: true };
    }

    const fuzzyMatched: string[] = [];

    // Fuzzy timestamp matching
    if (options?.ignoreTimestamps || fuzzyFields?.includes('timestamp')) {
      const expNormalized = this.normalizeTimestamps(expected);
      const actNormalized = this.normalizeTimestamps(actual);
      if (expNormalized === actNormalized) {
        fuzzyMatched.push('timestamps');
        return { match: true, fuzzyMatched };
      }
    }

    // Fuzzy ID matching
    if (options?.ignoreIds || fuzzyFields?.includes('id')) {
      const expNormalized = this.normalizeIds(expected);
      const actNormalized = this.normalizeIds(actual);
      if (expNormalized === actNormalized) {
        fuzzyMatched.push('ids');
        return { match: true, fuzzyMatched };
      }
    }

    // Custom fuzzy fields
    if (fuzzyFields && fuzzyFields.length > 0) {
      let expText = expected;
      let actText = actual;
      
      for (const field of fuzzyFields) {
        if (field !== 'timestamp' && field !== 'id') {
          // Try to normalize custom fields
          expText = this.normalizeCustomField(expText, field);
          actText = this.normalizeCustomField(actText, field);
        }
      }
      
      if (expText === actText) {
        fuzzyMatched.push(...fuzzyFields);
        return { match: true, fuzzyMatched };
      }
    }

    return { match: false };
  }

  /**
   * Normalize timestamps in text (replace with placeholder)
   */
  private normalizeTimestamps(text: string): string {
    // ISO 8601 format: 2025-12-25T10:00:00Z or 2025-12-25T10:00:00.000Z
    return text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?/g, '<TIMESTAMP>');
  }

  /**
   * Normalize IDs in text (replace with placeholder)
   */
  private normalizeIds(text: string): string {
    // UUID format
    let normalized = text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>');
    // Numeric IDs (e.g., "id: 12345" or "ID: 67890")
    normalized = normalized.replace(/\bid[:\s]+\d+/gi, 'id: <ID>');
    return normalized;
  }

  /**
   * Normalize custom fields (simple pattern replacement)
   */
  private normalizeCustomField(text: string, field: string): string {
    // Replace "field: value" patterns with "field: <VALUE>"
    const regex = new RegExp(`${field}[:\\s]+[^\\s,}]+`, 'gi');
    return text.replace(regex, `${field}: <VALUE>`);
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
