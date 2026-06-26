// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Run command - Execute test scenarios
 */

import { Command } from 'commander';
import { ScenarioLoader } from '../lib/scenario-loader.js';
import { TestExecutor } from '../lib/test-executor.js';
import type { RunOptions, TestResult } from '../lib/types.js';

// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Log helper - respects verbose flag
 */
function log(message: string, options: RunOptions): void {
  if (options.verbose) {
    console.error(`${GREEN}[MCPTEST]${RESET} ${message}`);
  }
}

/**
 * Error handler
 */
function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error('\n❌ Error:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n   Stack: ${error.stack}`);
    }
  } else {
    console.error('\n❌ Unknown Error:');
    console.error(`   ${String(error)}`);
  }
}

/**
 * Format test results for console
 */
function formatResults(results: Array<TestResult>): void {
  console.log('\n' + BOLD + 'Test Results' + RESET);
  console.log('='.repeat(50));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    const status = result.passed ? GREEN + 'PASS' + RESET : RED + 'FAIL' + RESET;
    console.log(`${icon} ${result.scenarioName} - ${status} (${result.duration}ms)`);

    if (result.error) {
      console.log(`   ${RED}Error: ${result.error}${RESET}`);
    }

    // Show failed tool details
    if (!result.passed && result.toolResults) {
      for (const toolResult of result.toolResults) {
        if (!toolResult.success) {
          console.log(`   ${YELLOW}Tool: ${toolResult.toolName}${RESET}`);
          if (toolResult.error) {
            console.log(`     ${RED}Error: ${toolResult.error.message}${RESET}`);
          }
          if (toolResult.assertions) {
            for (const assertion of toolResult.assertions) {
              if (!assertion.passed) {
                console.log(`     ${RED}✗ ${assertion.type}: ${assertion.message || 'failed'}${RESET}`);
              }
            }
          }
        }
      }
    }

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`${BOLD}Total:${RESET} ${results.length} scenarios`);
  console.log(`${GREEN}Passed:${RESET} ${passed}`);
  if (failed > 0) {
    console.log(`${RED}Failed:${RESET} ${failed}`);
  }
}

/**
 * Main execution
 */
async function executeRun(options: RunOptions): Promise<void> {
  log('Starting test execution...', options);

  // Validate options
  if (!options.server) {
    throw new Error('--server option is required');
  }

  log(`Loading scenarios from: ${options.scenarios}`, options);

  // Load scenarios
  const loader = new ScenarioLoader();
  await loader.loadSchema();
  const scenarios = await loader.loadScenarios(options.scenarios);

  log(`Loaded ${scenarios.length} scenario(s)`, options);

  // Initialize test executor with optional golden file support
  const fuzzyOptions = options.golden ? {
    ignoreTimestamps: true,
    ignoreIds: true
  } : undefined;
  const executor = new TestExecutor(options.golden, fuzzyOptions);

  // Parse environment variables from CLI option
  // Format: --env KEY1=VALUE1 --env KEY2=VALUE2
  const env: Record<string, string> = {};
  if (options.env && options.env.length > 0) {
    for (const envVar of options.env) {
      const [key, value] = envVar.split('=', 2);
      if (key && value !== undefined) {
        env[key] = value;
        log(`Environment variable: ${key}=${value}`, options);
      }
    }
  }

  // Parse custom headers from CLI option
  // Format: --header "Authorization: Bearer TOKEN" --header "X-Custom: value"
  const headers: Record<string, string> = {};
  if (options.header && options.header.length > 0) {
    for (const h of options.header) {
      const colonIdx = h.indexOf(':');
      if (colonIdx > 0) {
        const key = h.slice(0, colonIdx).trim();
        const value = h.slice(colonIdx + 1).trim();
        headers[key] = value;
        log(`Header: ${key}: ${value.slice(0, 20)}...`, options);
      }
    }
  }

  // Detect transport from server URL
  // Prefer streamable-http (standardized June 2025) over SSE for HTTP URLs
  let transport: 'stdio' | 'sse' | 'streamable-http';
  if (options.server.startsWith('http://') || options.server.startsWith('https://') || options.server.startsWith('streamable-http://')) {
    transport = 'streamable-http';
  } else if (options.server.startsWith('sse://')) {
    transport = 'sse';
  } else {
    transport = 'stdio';
  }
  
  log(`Using ${transport} transport`, options);

  // Execute scenarios
  const results = [];

  for (const scenario of scenarios) {
    log(`Executing: ${scenario.name}`, options);

    const result = await executor.executeScenario(scenario, {
      serverUrl: options.server,
      transport,
      env: Object.keys(env).length > 0 ? env : undefined,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    results.push(result);
  }

  await executor.disconnect();

  // Format and display results
  formatResults(results);

  // Exit with appropriate code
  const allPassed = results.every((r) => r.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

/**
 * Create command
 */
export function runCommand(): Command {
  const cmd = new Command('run');

  cmd
    .description('Execute test scenarios against MCP server')
    .requiredOption('--scenarios <path>', 'Path to scenario file or directory')
    .requiredOption('--server <url>', 'MCP server URL (stdio://command?args=... or http://localhost:3000)')
    .option('--golden <path>', 'Golden file directory for comparison')
    .option('--mode <type>', 'Test mode: live, mock, or ci', 'live')
    .option('--mock-data <path>', 'Mock data file for replay mode')
    .option('--format <type>', 'Output format: json, yaml, junit, html', 'json')
    .option('--output <path>', 'Output file path')
    .option('--env <KEY=VALUE>', 'Environment variable (can be specified multiple times)', (value, previous: string[] = []) => {
      return [...previous, value];
    }, [])
    .option('--header <Header: Value>', 'Custom HTTP header (can be specified multiple times)', (value, previous: string[] = []) => {
      return [...previous, value];
    }, [])
    .option('--verbose', 'Enable detailed logging', false)
    .option('--pretty', 'Pretty-print output', true)
    .action(async (options: RunOptions) => {
      try {
        await executeRun(options);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });

  return cmd;
}
