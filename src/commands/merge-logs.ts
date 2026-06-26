// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Merge-logs command - Merge execution logs from different mcpdesc versions
 */

import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import Ajv, { type ValidateFunction } from 'ajv';
import { validateExecutionLog, displayValidationWarnings } from '../lib/version-validator.js';
import type { ExecutionLog, ExecutionEntry } from '../lib/types.js';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Options for merge-logs command
 */
interface MergeLogsOptions {
  old: string;
  new: string;
  output: string;
  verbose: boolean;
}

/**
 * Log helper
 */
function log(message: string, verbose: boolean): void {
  if (verbose) {
    console.error(`${GREEN}[MCPTEST]${RESET} ${message}`);
  }
}

/**
 * Calculate hash for execution entry
 */
function calculateExecutionHash(toolName: string, args: Record<string, unknown>): string {
  const hashInput = JSON.stringify({ tool: toolName, args });
  const hash = createHash('sha256');
  hash.update(hashInput);
  return hash.digest('hex');
}

/**
 * Load execution log from file
 */
async function loadExecutionLog(path: string): Promise<ExecutionLog> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as ExecutionLog;
  } catch (error) {
    throw new Error(
      `Failed to load execution log from ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Validate execution log against schema
 */
async function validateExecutionLogSchema(executionLog: ExecutionLog, schemaPath: string): Promise<void> {
  try {
    const schemaContent = await readFile(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    
    const ajv = new Ajv({ 
      allErrors: true,
      verbose: true,
      validateFormats: false  // Disable format validation for date-time, uri
    });
    
    const validator = ajv.compile(schema);
    const valid = validator(executionLog);
    
    if (!valid && validator.errors) {
      const errorMessages = validator.errors
        .map(err => `  - ${err.instancePath || '/'}: ${err.message}`)
        .join('\n');
      
      throw new Error(
        `Execution log validation failed:\n${errorMessages}`
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to validate execution log: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Merge two execution logs
 */
async function mergeLogs(
  oldLog: ExecutionLog,
  newLog: ExecutionLog,
  verbose: boolean
): Promise<{
  mergedLog: ExecutionLog;
  stats: {
    preserved: number;
    added: number;
    updated: number;
    removed: number;
    removedTools: string[];
  };
}> {
  log('Building hash maps for merge...', verbose);
  
  // Build hash maps for quick lookup
  const oldHashes = new Map<string, ExecutionEntry>();
  const newHashes = new Map<string, ExecutionEntry>();
  
  for (const entry of oldLog.executions) {
    const hash = entry.executionHash || calculateExecutionHash(entry.toolName, entry.arguments);
    oldHashes.set(hash, entry);
  }
  
  for (const entry of newLog.executions) {
    const hash = entry.executionHash || calculateExecutionHash(entry.toolName, entry.arguments);
    newHashes.set(hash, entry);
  }
  
  log(`Old log: ${oldHashes.size} executions`, verbose);
  log(`New log: ${newHashes.size} executions`, verbose);
  
  // Merge logic: Preserve old, add new, update modified
  const mergedExecutions: ExecutionEntry[] = [];
  const stats = {
    preserved: 0,
    added: 0,
    updated: 0,
    removed: 0,
    removedTools: [] as string[]
  };
  
  // Track which old entries are still present
  const oldHashesProcessed = new Set<string>();
  
  // Process new executions
  for (const [hash, newEntry] of newHashes.entries()) {
    const oldEntry = oldHashes.get(hash);
    
    if (oldEntry) {
      // Execution exists in both - preserve old execution (unchanged)
      mergedExecutions.push(oldEntry);
      oldHashesProcessed.add(hash);
      stats.preserved++;
    } else {
      // New execution not in old log - add it
      mergedExecutions.push(newEntry);
      stats.added++;
    }
  }
  
  // Find removed executions (in old but not in new)
  const removedToolNames = new Set<string>();
  for (const [hash, oldEntry] of oldHashes.entries()) {
    if (!oldHashesProcessed.has(hash)) {
      // This execution was removed - track tool name
      removedToolNames.add(oldEntry.toolName);
      stats.removed++;
    }
  }
  
  stats.removedTools = Array.from(removedToolNames);
  
  log(`Preserved: ${stats.preserved}`, verbose);
  log(`Added: ${stats.added}`, verbose);
  log(`Removed: ${stats.removed}`, verbose);
  
  // Build version history
  const previousVersions = [
    ...(oldLog.metadata.previousVersions || []),
    {
      mcpdescVersion: oldLog.metadata.mcpdescVersion,
      recordedAt: oldLog.recordedAt,
      executionCount: oldLog.executions.length
    }
  ];
  
  // Create merged log (use new log's metadata as base)
  const mergedLog: ExecutionLog = {
    version: newLog.version,
    schema: newLog.schema,
    recordedAt: new Date().toISOString(),
    metadata: {
      ...newLog.metadata,
      previousVersions
    },
    executions: mergedExecutions
  };
  
  return { mergedLog, stats };
}

/**
 * Execute merge-logs command
 */
async function runMergeLogs(options: MergeLogsOptions): Promise<void> {
  console.log(`${BOLD}Merging Execution Logs${RESET}\n`);
  
  log(`Loading old log: ${options.old}`, options.verbose);
  const oldLog = await loadExecutionLog(options.old);
  log(`Old version: ${oldLog.metadata.mcpdescVersion}`, options.verbose);
  
  log(`Loading new log: ${options.new}`, options.verbose);
  const newLog = await loadExecutionLog(options.new);
  log(`New version: ${newLog.metadata.mcpdescVersion}`, options.verbose);
  
  // Validate new log against current mcpdesc if available
  const mcpdescFile = process.env.MCPTEST_MCPDESC_FILE || 'mcpdesc.json';
  try {
    const validationResult = await validateExecutionLog(newLog, mcpdescFile);
    
    if (!validationResult.valid) {
      displayValidationWarnings(validationResult, options.verbose);
      console.error(`${YELLOW}Warning: New execution log may not match current mcpdesc${RESET}`);
      console.error(`${YELLOW}Proceeding with merge...${RESET}\n`);
    } else if (options.verbose) {
      log('✓ New execution log version matches current mcpdesc', options.verbose);
    }
  } catch (error) {
    // If mcpdesc file doesn't exist, just warn in verbose mode
    log(`Note: Could not validate against mcpdesc (${error instanceof Error ? error.message : String(error)})`, options.verbose);
  }
  
  // Validate versions are different
  if (oldLog.metadata.mcpdescVersion === newLog.metadata.mcpdescVersion) {
    console.warn(
      `${YELLOW}Warning:${RESET} Both logs have the same mcpdesc version (${oldLog.metadata.mcpdescVersion})`
    );
  }
  
  // Merge logs
  console.log('Merging execution logs...');
  const { mergedLog, stats } = await mergeLogs(oldLog, newLog, options.verbose);
  
  // Validate merged log
  log('Validating merged log...', options.verbose);
  const schemaPath = new URL('../../schemas/execution-log-schema.json', import.meta.url).pathname;
  await validateExecutionLogSchema(mergedLog, schemaPath);
  
  // Write output
  log(`Writing merged log to: ${options.output}`, options.verbose);
  const jsonContent = JSON.stringify(mergedLog, null, 2);
  await writeFile(options.output, jsonContent, 'utf-8');
  
  // Display summary
  console.log(`\n${BOLD}Merge Summary${RESET}`);
  console.log(`Preserved:  ${GREEN}${stats.preserved}${RESET} (unchanged from old)`);
  console.log(`Added:      ${GREEN}${stats.added}${RESET} (new in current version)`);
  console.log(`Total:      ${GREEN}${mergedLog.executions.length}${RESET} executions`);
  
  if (stats.removed > 0) {
    console.log(`\n${YELLOW}Removed:${RESET}    ${stats.removed} executions (tools no longer present)`);
    console.log(`${YELLOW}Tools:${RESET}      ${stats.removedTools.join(', ')}`);
    console.log(`${YELLOW}Note:${RESET}       Removed executions are not included in merged log`);
  }
  
  console.log(`\n${BOLD}Version History${RESET}`);
  if (mergedLog.metadata.previousVersions && mergedLog.metadata.previousVersions.length > 0) {
    for (const version of mergedLog.metadata.previousVersions) {
      const execCount = version.executionCount !== undefined ? ` (${version.executionCount} executions)` : '';
      const recordedDate = new Date(version.recordedAt).toLocaleDateString();
      console.log(`  - ${version.mcpdescVersion}${execCount} - recorded ${recordedDate}`);
    }
  }
  console.log(`  - ${mergedLog.metadata.mcpdescVersion} (current)`);
  
  console.log(`\n${GREEN}✓${RESET} Merged log saved to: ${options.output}`);
}

/**
 * Create merge-logs command
 */
export function mergeLogsCommand(): Command {
  const cmd = new Command('merge-logs');

  cmd
    .description('Merge execution logs from different mcpdesc versions')
    .requiredOption('--old <path>', 'Path to old execution log (previous version)')
    .requiredOption('--new <path>', 'Path to new execution log (current version)')
    .requiredOption('--output <path>', 'Path to save merged execution log')
    .option('-v, --verbose', 'Enable detailed logging', false)
    .action(async (options: MergeLogsOptions) => {
      try {
        await runMergeLogs(options);
      } catch (error) {
        console.error('\n❌ Error:');
        console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  return cmd;
}
