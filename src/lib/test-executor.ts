// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Test executor - Execute scenarios and validate results
 */

import { MCPTestClient } from './mcp-client.js';
import { GoldenFileManager } from './golden-file-manager.js';
import {
  TestExecutionError,
  type Scenario,
  type TestResult,
  type ToolResult,
  type AssertionResult,
  type MCPClientConfig,
  type FuzzyMatchOptions,
} from './types.js';

export class TestExecutor {
  private client: MCPTestClient;
  private goldenManager?: GoldenFileManager;
  private fuzzyMatchOptions?: FuzzyMatchOptions;

  constructor(goldenDir?: string, fuzzyMatchOptions?: FuzzyMatchOptions) {
    this.client = new MCPTestClient();
    if (goldenDir) {
      this.goldenManager = new GoldenFileManager(goldenDir);
      this.fuzzyMatchOptions = fuzzyMatchOptions;
    }
  }

  /**
   * Execute a single scenario
   */
  async executeScenario(scenario: Scenario, clientConfig: MCPClientConfig): Promise<TestResult> {
    const startTime = Date.now();
    const toolResults: ToolResult[] = [];

    try {
      // Connect to server
      if (!this.client.isConnected()) {
        await this.client.connect(clientConfig);
      }

      // Execute each tool call
      for (const toolCall of scenario.tools) {
        const result = await this.client.callTool(toolCall.name, toolCall.arguments || {});

        // Run assertions if present
        if (toolCall.assertions && toolCall.assertions.length > 0) {
          const assertions = await this.runAssertions(toolCall.assertions, result);
          result.assertions = assertions;

          // Mark tool as failed if any assertion failed
          if (assertions.some((a) => !a.passed)) {
            result.success = false;
          }
        }

        // Compare against golden file if available
        if (this.goldenManager) {
          const comparison = await this.goldenManager.compare(
            scenario.name,
            toolCall.name,
            result,
            this.fuzzyMatchOptions
          );

          if (!comparison.match) {
            result.success = false;
            result.assertions = result.assertions || [];
            result.assertions.push({
              type: 'golden-file',
              passed: false,
              message: `Golden file mismatch: ${comparison.differences?.length || 0} difference(s)`,
              expected: 'matches golden file',
              actual: comparison.differences,
            });
          } else if (comparison.fuzzyMatched && comparison.fuzzyMatched.length > 0) {
            // Add info about fuzzy matching
            result.assertions = result.assertions || [];
            result.assertions.push({
              type: 'golden-file',
              passed: true,
              message: `Matched with fuzzy fields: ${comparison.fuzzyMatched.join(', ')}`,
              expected: 'matches golden file',
              actual: 'matched',
            });
          }
        }

        toolResults.push(result);
      }

      const duration = Date.now() - startTime;
      const allPassed = toolResults.every((r) => r.success);

      return {
        scenarioName: scenario.name,
        passed: allPassed,
        duration,
        toolResults,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        scenarioName: scenario.name,
        passed: false,
        duration,
        toolResults,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run assertions on tool result
   */
  private async runAssertions(
    assertions: Array<{ type: string; expected?: unknown; schema?: Record<string, unknown>; expression?: string }>,
    result: ToolResult
  ): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];

    for (const assertion of assertions) {
      let passed = false;
      let message: string | undefined;
      let actual: unknown;

      try {
        switch (assertion.type) {
          case 'response-type':
            actual = typeof result.result;
            passed = actual === assertion.expected;
            if (!passed) {
              message = `Expected type ${assertion.expected}, got ${actual}`;
            }
            break;

          case 'error':
            actual = !result.success;
            passed = actual === assertion.expected;
            if (!passed) {
              message = `Expected error=${assertion.expected}, got error=${actual}`;
            }
            break;

          case 'error-code':
            actual = result.error?.code;
            passed = actual === assertion.expected;
            if (!passed) {
              message = `Expected error code ${assertion.expected}, got ${actual}`;
            }
            break;

          case 'contains-text':
            if (typeof result.result === 'string') {
              actual = result.result;
              passed = result.result.includes(String(assertion.expected));
              if (!passed) {
                message = `Expected text to contain "${assertion.expected}"`;
              }
            } else {
              passed = false;
              message = 'Result is not a string';
            }
            break;

          case 'array-length':
            if (Array.isArray(result.result)) {
              actual = result.result.length;
              passed = result.result.length === assertion.expected;
              if (!passed) {
                message = `Expected array length ${assertion.expected}, got ${actual}`;
              }
            } else {
              passed = false;
              message = 'Result is not an array';
            }
            break;

          case 'array-length-max':
            if (Array.isArray(result.result)) {
              actual = result.result.length;
              passed = result.result.length <= (assertion.expected as number);
              if (!passed) {
                message = `Expected array length <= ${assertion.expected}, got ${actual}`;
              }
            } else {
              passed = false;
              message = 'Result is not an array';
            }
            break;

          default:
            passed = false;
            message = `Unknown assertion type: ${assertion.type}`;
        }
      } catch (error) {
        passed = false;
        message = `Assertion error: ${error instanceof Error ? error.message : String(error)}`;
      }

      results.push({
        type: assertion.type,
        passed,
        message,
        expected: assertion.expected,
        actual,
      });
    }

    return results;
  }

  /**
   * Disconnect client
   */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
