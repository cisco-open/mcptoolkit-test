// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Validate command - Check test scenarios against JSON schema
 */

import { Command } from 'commander';
import { ScenarioLoader } from '../lib/scenario-loader.js';
import { readFile, stat } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

interface ValidateOptions {
  scenarios: string;
  verbose?: boolean;
}

interface ValidationResult {
  file: string;
  valid: boolean;
  errors?: string[];
}

/**
 * Validate a single scenario file
 */
async function validateFile(filePath: string, loader: ScenarioLoader): Promise<ValidationResult> {
  try {
    await loader.loadScenario(filePath);
    return {
      file: basename(filePath),
      valid: true
    };
  } catch (error) {
    return {
      file: basename(filePath),
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * Validate all scenarios in a directory
 */
async function validateDirectory(dirPath: string, loader: ScenarioLoader): Promise<ValidationResult[]> {
  const files = await readdir(dirPath);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  
  const results: ValidationResult[] = [];
  for (const file of yamlFiles) {
    const filePath = resolve(dirPath, file);
    results.push(await validateFile(filePath, loader));
  }
  
  return results;
}

/**
 * Execute validation
 */
async function runValidate(options: ValidateOptions): Promise<void> {
  const loader = new ScenarioLoader();
  
  if (options.verbose) {
    console.error(`${GREEN}[MCPTEST]${RESET} Validating scenarios from: ${options.scenarios}`);
  }
  
  // Check if path is file or directory
  const stats = await stat(options.scenarios);
  let results: ValidationResult[];
  
  if (stats.isDirectory()) {
    results = await validateDirectory(options.scenarios, loader);
  } else {
    results = [await validateFile(options.scenarios, loader)];
  }
  
  // Display results
  console.log(`\n${BOLD}Validation Results${RESET}\n`);
  
  let hasErrors = false;
  for (const result of results) {
    if (result.valid) {
      console.log(`${GREEN}✓${RESET} ${result.file}`);
    } else {
      console.log(`${RED}✗${RESET} ${result.file}`);
      if (result.errors) {
        for (const error of result.errors) {
          console.log(`  ${RED}→${RESET} ${error}`);
        }
      }
      hasErrors = true;
    }
  }
  
  // Summary
  const validCount = results.filter(r => r.valid).length;
  const totalCount = results.length;
  
  console.log(`\n${BOLD}Summary${RESET}`);
  console.log(`Valid:   ${GREEN}${validCount}${RESET}/${totalCount}`);
  console.log(`Invalid: ${RED}${totalCount - validCount}${RESET}/${totalCount}`);
  
  if (hasErrors) {
    console.log(`\n${YELLOW}Tip: Use 'mcptest schema --examples' to see valid scenario format${RESET}`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}All scenarios are valid!${RESET}`);
  }
}

/**
 * Create validate command
 */
export function validateCommand(): Command {
  const cmd = new Command('validate');

  cmd
    .description('Validate test scenarios against JSON schema')
    .requiredOption('-s, --scenarios <path>', 'Path to scenario file or directory')
    .option('-v, --verbose', 'Enable detailed logging')
    .action(async (options: ValidateOptions) => {
      try {
        await runValidate(options);
      } catch (error) {
        console.error('\n❌ Error:');
        console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  return cmd;
}
