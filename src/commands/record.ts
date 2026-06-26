// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Record command - Record golden files from live MCP server
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ScenarioLoader } from '../lib/scenario-loader.js';
import { MCPTestClient } from '../lib/mcp-client.js';
import { GoldenFileManager } from '../lib/golden-file-manager.js';
import { ExecutionLogWriter } from '../lib/execution-log-writer.js';
import { validateExecutionLog, displayValidationWarnings } from '../lib/version-validator.js';
import type { RecordOptions, Scenario, ExecutionLog, ExecutionEntry } from '../lib/types.js';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Log helper
 */
function log(message: string, verbose: boolean): void {
  if (verbose) {
    console.error(`${GREEN}[MCPTEST]${RESET} ${message}`);
  }
}

/**
 * Calculate hash for tool call (tool name + arguments)
 */
function calculateExecutionHash(toolName: string, args: Record<string, unknown>): string {
  const hashInput = JSON.stringify({ tool: toolName, args });
  const hash = createHash('sha256');
  hash.update(hashInput);
  return hash.digest('hex');
}

/**
 * Load existing execution log if available
 */
async function loadExistingExecutionLog(exportPath: string): Promise<ExecutionLog | null> {
  try {
    const content = await readFile(exportPath, 'utf-8');
    return JSON.parse(content) as ExecutionLog;
  } catch (error) {
    // File doesn't exist or is invalid - return null
    return null;
  }
}

/**
 * Execute recording
 */
async function runRecord(options: RecordOptions): Promise<void> {
  log(`Recording golden files from scenarios: ${options.scenarios}`, options.verbose);
  log(`Server: ${options.server}`, options.verbose);
  log(`Golden directory: ${options.golden}`, options.verbose);
  
  if (options.export) {
    log(`Export execution log: ${options.export}`, options.verbose);
  }

  // Load scenarios
  const loader = new ScenarioLoader();
  await loader.loadSchema();
  
  const scenarios = await loader.loadScenarios(options.scenarios);
  log(`Loaded ${scenarios.length} scenario(s)`, options.verbose);

  // Initialize golden file manager
  const goldenManager = new GoldenFileManager(options.golden);

  // Load existing execution log for incremental recording
  let existingLog: ExecutionLog | null = null;
  const existingHashes = new Map<string, ExecutionEntry>();
  
  if (options.incremental && options.export) {
    existingLog = await loadExistingExecutionLog(options.export);
    if (existingLog) {
      log('Loaded existing execution log for incremental recording', options.verbose);
      
      // Validate execution log against current mcpdesc
      const mcpdescFile = process.env.MCPTEST_MCPDESC_FILE || 'mcpdesc.json';
      try {
        const validationResult = await validateExecutionLog(existingLog, mcpdescFile);
        
        if (!validationResult.valid) {
          // Display warnings but don't fail - let user proceed with incremental recording
          displayValidationWarnings(validationResult, options.verbose);
          console.error(`${YELLOW}Proceeding with incremental recording...${RESET}\n`);
        } else if (options.verbose) {
          log('✓ Execution log version matches current mcpdesc', options.verbose);
        }
      } catch (error) {
        // If mcpdesc file doesn't exist, just warn
        log(`Warning: Could not validate execution log against mcpdesc (${error instanceof Error ? error.message : String(error)})`, options.verbose);
      }
      
      // Build hash map for quick lookup
      for (const entry of existingLog.executions) {
        const hash = calculateExecutionHash(entry.toolName, entry.arguments);
        existingHashes.set(hash, entry);
      }
      log(`Found ${existingHashes.size} existing executions`, options.verbose);
    }
  }

  // Connect to MCP server
  const client = new MCPTestClient();
  
  // Detect transport
  let transport: 'stdio' | 'sse' | 'streamable-http';
  if (options.server.startsWith('http://') || options.server.startsWith('https://')) {
    transport = 'streamable-http';
  } else if (options.server.startsWith('sse://')) {
    transport = 'sse';
  } else {
    transport = 'stdio';
  }
  
  await client.connect({
    serverUrl: options.server,
    transport,
    env: parseEnv(options.env || []),
    headers: parseHeaders(options.header || []),
  });
  log('Connected to MCP server', options.verbose);

  let recordedCount = 0;
  let skippedCount = 0;
  let unchangedCount = 0;
  let modifiedCount = 0;
  let newCount = 0;
  let errorCount = 0;
  
  // Track executions for export
  const executions: ExecutionEntry[] = [];

  // Process each scenario
  for (const scenario of scenarios) {
    console.log(`\n${BOLD}Recording: ${scenario.name}${RESET}`);

    for (const toolCall of scenario.tools) {
      const args = toolCall.arguments || {};
      const hash = calculateExecutionHash(toolCall.name, args);
      const existingEntry = existingHashes.get(hash);
      const goldenExists = goldenManager.exists(scenario.name, toolCall.name);

      // Skip if incremental and execution unchanged
      if (options.incremental && existingEntry) {
        console.log(`  ${YELLOW}⊙${RESET} ${toolCall.name} (unchanged)`);
        unchangedCount++;
        
        // Preserve existing execution in export
        if (options.export) {
          executions.push(existingEntry);
        }
        continue;
      }

      // Skip if incremental (no export) and golden exists
      if (options.incremental && !options.export && goldenExists) {
        console.log(`  ${YELLOW}⊙${RESET} ${toolCall.name} (skipped - exists)`);
        skippedCount++;
        continue;
      }

      try {
        log(`  Calling tool: ${toolCall.name}`, options.verbose);
        const result = await client.callTool(toolCall.name, args);

        // Save golden file
        await goldenManager.save(
          scenario.name,
          toolCall.name,
          result,
          options.fuzzyMatch?.split(',')
        );

        // Track execution for export
        if (options.export) {
          const executionEntry: ExecutionEntry = {
            scenarioName: scenario.name,
            toolName: toolCall.name,
            arguments: args,
            response: {
              success: result.success,
              duration: result.duration,
              result: result.result,
              error: result.error
            },
            timestamp: new Date().toISOString(),
            executionHash: hash
          };
          executions.push(executionEntry);
        }

        // Categorize execution
        if (existingEntry) {
          console.log(`  ${GREEN}✓${RESET} ${toolCall.name} (modified)`);
          modifiedCount++;
        } else {
          console.log(`  ${GREEN}✓${RESET} ${toolCall.name} (new)`);
          newCount++;
        }
        recordedCount++;
      } catch (error) {
        console.log(`  ${RED}✗${RESET} ${toolCall.name}: ${error instanceof Error ? error.message : String(error)}`);
        errorCount++;
      }
    }
  }

  // Disconnect
  await client.disconnect();

  // Write execution log if export requested
  if (options.export && executions.length > 0) {
    log('Writing execution log...', options.verbose);
    
    // Determine mcpdesc file path
    // For now, require explicit path or fail gracefully
    const mcpdescFile = process.env.MCPTEST_MCPDESC_FILE || 'mcpdesc.json';
    
    const schemaPath = new URL('../../schemas/execution-log-schema.json', import.meta.url).pathname;
    const writer = new ExecutionLogWriter(schemaPath);
    
    // Get mcptest version from package.json
    const mcptestVersion = '0.10.0';  // TODO: Read from package.json
    
    await writer.write(options.export, {
      executions,
      metadata: {
        previousVersions: existingLog?.metadata.previousVersions || []
      },
      mcpdescFile,
      serverUrl: options.server,
      transport,
      mcptestVersion,
      verbose: options.verbose
    });
    
    console.log(`\n${GREEN}✓${RESET} Execution log exported to: ${options.export}`);
  }

  // Summary
  console.log(`\n${BOLD}Recording Summary${RESET}`);
  console.log(`Recorded: ${GREEN}${recordedCount}${RESET}`);
  
  if (options.incremental && options.export) {
    // Detailed incremental statistics
    console.log(`  New:       ${GREEN}${newCount}${RESET}`);
    console.log(`  Modified:  ${GREEN}${modifiedCount}${RESET}`);
    console.log(`  Unchanged: ${YELLOW}${unchangedCount}${RESET}`);
  } else if (skippedCount > 0) {
    console.log(`Skipped:  ${YELLOW}${skippedCount}${RESET} (incremental mode)`);
  }
  
  if (errorCount > 0) {
    console.log(`Errors:   ${RED}${errorCount}${RESET}`);
  }
  console.log(`\nGolden files saved to: ${options.golden}`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

/**
 * Parse environment variables
 */
function parseEnv(envArray: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const item of envArray) {
    const [key, ...valueParts] = item.split('=');
    if (key && valueParts.length > 0) {
      env[key] = valueParts.join('=');
    }
  }
  return env;
}

/**
 * Parse HTTP headers from CLI option
 * Format: "Header-Name: header value"
 */
function parseHeaders(headerArray: string[]): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  for (const item of headerArray) {
    const colonIdx = item.indexOf(':');
    if (colonIdx > 0) {
      const key = item.slice(0, colonIdx).trim();
      const value = item.slice(colonIdx + 1).trim();
      headers[key] = value;
    }
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

/**
 * Create record command
 */
export function recordCommand(): Command {
  const cmd = new Command('record');

  cmd
    .description('Record golden files from live MCP server')
    .requiredOption('-s, --scenarios <path>', 'Path to scenario file or directory')
    .requiredOption('--server <url>', 'MCP server URL (stdio://, http://, sse://)')
    .requiredOption('-g, --golden <path>', 'Directory to save golden files')
    .option('--mock-data <path>', 'Also save mock data for mcpmock (JSONL format)')
    .option('--export <path>', 'Export execution log (JSON format with version tracking)')
    .option('--incremental', 'Skip scenarios that already have golden files', false)
    .option('--fuzzy-match <fields>', 'Fields to ignore during comparison (comma-separated)')
    .option('-e, --env <KEY=VALUE>', 'Environment variables for stdio server (repeatable)', collect, [])
    .option('--header <Header: Value>', 'Custom HTTP header (repeatable)', collect, [])
    .option('-v, --verbose', 'Enable detailed logging', false)
    .action(async (options: RecordOptions & { env?: string[] }) => {
      try {
        // Convert CLI options to RecordOptions
        const recordOpts: RecordOptions = {
          scenarios: options.scenarios,
          server: options.server,
          golden: options.golden,
          mockData: options.mockData,
          export: options.export,
          incremental: options.incremental,
          fuzzyMatch: options.fuzzyMatch,
          env: options.env,
          header: options.header,
          verbose: options.verbose
        };

        await runRecord(recordOpts);
      } catch (error) {
        console.error('\n❌ Error:');
        console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Collect repeated options into array
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
