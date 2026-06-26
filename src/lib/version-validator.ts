// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Version Validation Utility
 * Validates execution logs against mcpdesc files for version consistency
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadMcpDescFile, type McpDescFormat } from './mcpdesc-loader.js';
import type { McpDescFile, ExecutionLog } from './types.js';

const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Result of version validation
 */
export interface ValidationResult {
  valid: boolean;
  versionMatch: boolean;
  checksumMatch: boolean;
  mcpdescVersion?: string;
  logVersion?: string;
  mcpdescChecksum?: string;
  logChecksum?: string;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

/**
 * Validate execution log against mcpdesc file
 * 
 * @param executionLog The execution log to validate
 * @param mcpdescPath Path to the mcpdesc file
 * @returns Validation result with warnings and recommendations
 */
export async function validateExecutionLog(
  executionLog: ExecutionLog,
  mcpdescPath: string,
  mcpdescFormat: McpDescFormat = 'auto'
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    versionMatch: false,
    checksumMatch: false,
    warnings: [],
    errors: [],
    recommendations: []
  };

  try {
    // Read and parse mcpdesc file (supports JSON and YAML)
    const { mcpdesc, rawContent } = await loadMcpDescFile(mcpdescPath, mcpdescFormat);

    // Calculate mcpdesc checksum
    const hash = createHash('sha256');
    hash.update(rawContent);
    const mcpdescChecksum = `sha256:${hash.digest('hex')}`;

    // Extract versions
    result.mcpdescVersion = mcpdesc.mcpdesc;
    result.logVersion = executionLog.metadata.mcpdescVersion;
    result.mcpdescChecksum = mcpdescChecksum;
    result.logChecksum = executionLog.metadata.mcpdescChecksum;

    // Check version match
    if (mcpdesc.mcpdesc === executionLog.metadata.mcpdescVersion) {
      result.versionMatch = true;
    } else {
      result.valid = false;
      result.warnings.push(
        `mcpdesc version mismatch: mcpdesc=${mcpdesc.mcpdesc}, log=${executionLog.metadata.mcpdescVersion}`
      );
    }

    // Check checksum match
    if (mcpdescChecksum === executionLog.metadata.mcpdescChecksum) {
      result.checksumMatch = true;
    } else {
      result.valid = false;
      result.warnings.push(
        'mcpdesc checksum mismatch - mcpdesc file has been modified since log was recorded'
      );
    }

    // Generate recommendations based on validation
    if (!result.valid) {
      if (!result.versionMatch) {
        result.recommendations.push(
          'The execution log was recorded with a different mcpdesc version.'
        );
        result.recommendations.push(
          'Options:'
        );
        result.recommendations.push(
          `  1. Use incremental recording: mcptest record --incremental --export <path>`
        );
        result.recommendations.push(
          `  2. Generate fresh scenarios: mcptest generate --mcpdesc ${mcpdescPath}`
        );
        result.recommendations.push(
          `  3. Merge logs manually: mcptest merge-logs --old <old> --new <new> --output <merged>`
        );
      }
      
      if (!result.checksumMatch && result.versionMatch) {
        result.recommendations.push(
          'The mcpdesc file has been modified but version is unchanged.'
        );
        result.recommendations.push(
          'This may indicate manual edits. Consider re-recording execution log.'
        );
      }
    }

  } catch (error) {
    result.valid = false;
    result.errors.push(
      `Failed to validate: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

/**
 * Display validation warnings to console
 * 
 * @param result Validation result
 * @param verbose Whether to show detailed output
 */
export function displayValidationWarnings(result: ValidationResult, verbose: boolean = false): void {
  if (result.valid && verbose) {
    console.error(`✓ Version validation passed`);
    return;
  }

  if (!result.valid) {
    console.error(`\n${YELLOW}${BOLD}⚠ Version Mismatch Detected${RESET}\n`);

    // Show warnings
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.error(`${YELLOW}Warning:${RESET} ${warning}`);
      }
      console.error('');
    }

    // Show version details
    if (result.mcpdescVersion && result.logVersion) {
      console.error(`mcpdesc version:  ${result.mcpdescVersion}`);
      console.error(`Log version:      ${result.logVersion}`);
      console.error(`Match:            ${result.versionMatch ? '✓' : '✗'}`);
      console.error('');
    }

    // Show checksum details if verbose
    if (verbose && result.mcpdescChecksum && result.logChecksum) {
      console.error(`mcpdesc checksum: ${result.mcpdescChecksum.substring(0, 20)}...`);
      console.error(`Log checksum:     ${result.logChecksum.substring(0, 20)}...`);
      console.error(`Match:            ${result.checksumMatch ? '✓' : '✗'}`);
      console.error('');
    }

    // Show recommendations
    if (result.recommendations.length > 0) {
      console.error(`${BOLD}Recommendations:${RESET}`);
      for (const rec of result.recommendations) {
        console.error(`  ${rec}`);
      }
      console.error('');
    }

    // Show errors
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        console.error(`${RED}Error:${RESET} ${error}`);
      }
    }
  }
}

/**
 * Check if version validation should fail the operation
 * 
 * @param result Validation result
 * @param strict Whether to enforce strict validation (fail on any mismatch)
 * @returns true if operation should fail
 */
export function shouldFailOperation(result: ValidationResult, strict: boolean = false): boolean {
  if (strict) {
    return !result.valid;
  }
  
  // Only fail on critical errors (file read failures, etc.)
  return result.errors.length > 0;
}
