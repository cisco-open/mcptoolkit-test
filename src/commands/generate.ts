// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Generate Command
 * 
 * Auto-generate YAML test scenarios from mcpdesc (MCP Server Description) files.
 */

import { Command } from 'commander';
import { ScenarioGenerator, type CoverageStrategy } from '../lib/scenario-generator.js';
import { loadMcpDescFile, type McpDescFormat } from '../lib/mcpdesc-loader.js';

// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

/**
 * Generate command options
 */
interface GenerateOptions {
  mcpdesc: string;
  output: string;
  coverage: CoverageStrategy;
  mcpdescFormat: McpDescFormat;
  merge?: boolean;
  verbose: boolean;
}

/**
 * Main execution
 */
async function runGenerate(options: GenerateOptions): Promise<void> {
  log('Starting scenario generation from mcpdesc...', options);
  log(`mcpdesc file: ${options.mcpdesc}`, options);
  log(`Output directory: ${options.output}`, options);
  log(`Coverage strategy: ${options.coverage}`, options);
  log(`mcpdesc format: ${options.mcpdescFormat}`, options);
  
  // Load mcpdesc file (supports JSON, YAML, auto-detect)
  log('Loading mcpdesc file...', options);
  const { mcpdesc } = await loadMcpDescFile(options.mcpdesc, options.mcpdescFormat);
  
  // Validate mcpdesc
  if (!mcpdesc.tools || mcpdesc.tools.length === 0) {
    throw new Error('mcpdesc file contains no tools');
  }
  
  log(`Found ${mcpdesc.tools.length} tool(s) in mcpdesc`, options);
  
  // Generate scenarios
  const generator = new ScenarioGenerator({
    mcpdesc,
    outputDir: options.output,
    coverage: options.coverage,
    merge: options.merge,
    verbose: options.verbose
  });
  
  const stats = await generator.generate();
  
  // Print summary
  console.error('\n' + GREEN + '━'.repeat(60) + RESET);
  console.error(GREEN + 'Generation Summary' + RESET);
  console.error(GREEN + '━'.repeat(60) + RESET);
  console.error(`${GREEN}✓${RESET} Tools processed: ${stats.toolsProcessed}`);
  console.error(`${GREEN}✓${RESET} Scenarios generated: ${stats.scenariosGenerated}`);
  console.error(`${GREEN}✓${RESET} Files created: ${stats.filesCreated}`);
  
  if (stats.errors.length > 0) {
    console.error(`\n${YELLOW}⚠${RESET}  Errors: ${stats.errors.length}`);
    stats.errors.forEach(err => console.error(`   ${err}`));
  }
  
  console.error(GREEN + '━'.repeat(60) + RESET);
  console.error(`\n${GREEN}✓${RESET} Scenarios saved to: ${options.output}`);
  console.error(`\n${GREEN}Next steps:${RESET}`);
  console.error(`  1. Review generated scenarios: ls ${options.output}/`);
  console.error(`  2. Validate scenarios: mcptest validate --scenarios ${options.output}/`);
  console.error(`  3. Run tests: mcptest run --scenarios ${options.output}/ --server <url>`);
  console.error(`  4. Record golden files: mcptest record --scenarios ${options.output}/ --server <url> --golden golden/`);
}

/**
 * Error handler
 */
function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error('\n' + RED + '❌ Error:' + RESET);
    console.error(`   ${error.message}`);
    
    if (error.stack) {
      console.error('\n' + RED + 'Stack trace:' + RESET);
      console.error(error.stack);
    }
  } else {
    console.error('\n' + RED + '❌ Unknown Error:' + RESET);
    console.error(`   ${String(error)}`);
  }
}

/**
 * Log helper
 */
function log(message: string, options: GenerateOptions): void {
  if (options.verbose) {
    console.error(`${GREEN}[GENERATE]${RESET} ${message}`);
  }
}

/**
 * Create generate command
 */
export function generateCommand(): Command {
  const cmd = new Command('generate');
  
  cmd
    .description('Auto-generate YAML test scenarios from mcpdesc (MCP Server Description) files')
    .requiredOption('-d, --mcpdesc <path>', 'Path to mcpdesc file (JSON or YAML)')
    .requiredOption('-o, --output <path>', 'Output directory for generated scenarios')
    .option('-c, --coverage <strategy>', 'Coverage strategy: basic, full, edge-cases', 'basic')
    .option('-f, --mcpdesc-format <format>', 'mcpdesc file format: json, yaml, auto (detect from extension)', 'auto')
    .option('-m, --merge', 'Merge with existing scenarios (preserve manual tests)', false)
    .option('-v, --verbose', 'Enable detailed logging', false)
    .action(async (options: GenerateOptions) => {
      try {
        // Validate coverage option
        const validCoverage: CoverageStrategy[] = ['basic', 'full', 'edge-cases'];
        if (!validCoverage.includes(options.coverage)) {
          throw new Error(`Invalid coverage strategy: ${options.coverage}. Must be one of: ${validCoverage.join(', ')}`);
        }

        // Validate mcpdesc format option
        const validFormats: McpDescFormat[] = ['json', 'yaml', 'auto'];
        if (!validFormats.includes(options.mcpdescFormat)) {
          throw new Error(`Invalid mcpdesc format: ${options.mcpdescFormat}. Must be one of: ${validFormats.join(', ')}`);
        }
        
        await runGenerate(options);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
  
  return cmd;
}
