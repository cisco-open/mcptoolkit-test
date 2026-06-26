// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Execution Log Writer
 * Converts test executions to execution log format with version tracking
 */

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import Ajv, { type ValidateFunction } from 'ajv';
import { loadMcpDescFile, type McpDescFormat } from './mcpdesc-loader.js';
import type { 
  ExecutionLog, 
  ExecutionLogMetadata, 
  ExecutionEntry,
  ToolResult,
  McpDescFile 
} from './types.js';

// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

/**
 * Options for writing execution logs
 */
export interface WriteOptions {
  executions: ExecutionEntry[];
  metadata: Partial<ExecutionLogMetadata>;
  mcpdescFile: string;
  serverUrl: string;
  transport: string;
  mcptestVersion: string;
  verbose?: boolean;
}

/**
 * ExecutionLogWriter - Converts test executions to execution log format
 * 
 * Features:
 * - Extracts mcpdesc version and checksum automatically
 * - Validates against JSON Schema
 * - Writes formatted JSON with proper structure
 * - Supports version tracking for upgrades
 */
export class ExecutionLogWriter {
  private schemaValidator: ValidateFunction | null = null;
  private readonly EXECUTION_LOG_VERSION = '1.0.0';
  private readonly EXECUTION_LOG_SCHEMA_URI = 'https://mcptest.dev/schema/execution-log/v1';

  /**
   * Create a new ExecutionLogWriter
   * @param schemaPath Path to execution-log-schema.json
   */
  constructor(private schemaPath: string) {}

  /**
   * Initialize schema validator
   */
  private async initializeValidator(): Promise<void> {
    if (this.schemaValidator) return;

    try {
      const schemaContent = await readFile(this.schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);
      
      const ajv = new Ajv({ 
        allErrors: true,
        verbose: true,
        validateFormats: false  // Disable format validation for date-time, uri
      });
      
      this.schemaValidator = ajv.compile(schema);
    } catch (error) {
      throw new Error(
        `Failed to load execution log schema from ${this.schemaPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Extract metadata from mcpdesc file
   * @param mcpdescPath Path to mcpdesc file
   * @returns mcpdesc version, checksum, and server info
   */
  private async extractMcpDescMetadata(mcpdescPath: string, mcpdescFormat: McpDescFormat = 'auto'): Promise<{
    mcpdescVersion: string;
    mcpdescChecksum: string;
    serverInfo: { name: string; version: string };
  }> {
    try {
      // Load mcpdesc file (supports JSON, YAML, auto-detect)
      const { mcpdesc, rawContent } = await loadMcpDescFile(mcpdescPath, mcpdescFormat);
      
      // Calculate SHA-256 checksum from raw content
      const hash = createHash('sha256');
      hash.update(rawContent);
      const mcpdescChecksum = `sha256:${hash.digest('hex')}`;
      
      if (!mcpdesc.mcpdesc) {
        throw new Error('mcpdesc file missing mcpdesc version field');
      }
      
      if (!mcpdesc.info?.name || !mcpdesc.info?.version) {
        throw new Error('mcpdesc file missing info.name or info.version');
      }
      
      return {
        mcpdescVersion: mcpdesc.mcpdesc,
        mcpdescChecksum,
        serverInfo: {
          name: mcpdesc.info.name,
          version: mcpdesc.info.version
        }
      };
    } catch (error) {
      throw new Error(
        `Failed to extract metadata from mcpdesc file ${mcpdescPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validate execution log against schema
   * @param executionLog The execution log to validate
   * @throws Error if validation fails
   */
  private validateExecutionLog(executionLog: ExecutionLog): void {
    if (!this.schemaValidator) {
      throw new Error('Schema validator not initialized');
    }

    const valid = this.schemaValidator(executionLog);
    
    if (!valid && this.schemaValidator.errors) {
      const errorMessages = this.schemaValidator.errors
        .map(err => `  - ${err.instancePath || '/'}: ${err.message}`)
        .join('\n');
      
      throw new Error(
        `Execution log validation failed:\n${errorMessages}`
      );
    }
  }

  /**
   * Write execution log to file
   * 
   * @param outputPath Path to write execution log (JSON format)
   * @param options Write options including executions and metadata
   * @returns Path to written file
   */
  async write(outputPath: string, options: WriteOptions): Promise<string> {
    const { 
      executions, 
      metadata, 
      mcpdescFile, 
      serverUrl, 
      transport,
      mcptestVersion,
      verbose = false 
    } = options;

    // Initialize validator
    await this.initializeValidator();

    // Log start
    if (verbose) {
      console.error(`${GREEN}[MCPTEST]${RESET} Writing execution log to ${outputPath}`);
    }

    // Extract mcpdesc metadata
    if (verbose) {
      console.error(`${GREEN}[MCPTEST]${RESET} Extracting metadata from ${mcpdescFile}`);
    }
    const mcpdescMetadata = await this.extractMcpDescMetadata(mcpdescFile);

    // Build complete metadata
    const completeMetadata: ExecutionLogMetadata = {
      mcptestVersion,
      mcpdescVersion: mcpdescMetadata.mcpdescVersion,
      mcpdescFile,
      mcpdescChecksum: mcpdescMetadata.mcpdescChecksum,
      serverInfo: mcpdescMetadata.serverInfo,
      serverUrl,
      transport,
      previousVersions: metadata.previousVersions || []
    };

    // Build execution log
    const executionLog: ExecutionLog = {
      version: this.EXECUTION_LOG_VERSION,
      schema: this.EXECUTION_LOG_SCHEMA_URI,
      recordedAt: new Date().toISOString(),
      metadata: completeMetadata,
      executions
    };

    // Validate against schema
    if (verbose) {
      console.error(`${GREEN}[MCPTEST]${RESET} Validating execution log against schema`);
    }
    this.validateExecutionLog(executionLog);

    // Write to file with pretty formatting
    if (verbose) {
      console.error(`${GREEN}[MCPTEST]${RESET} Writing ${executions.length} executions to file`);
    }
    const jsonContent = JSON.stringify(executionLog, null, 2);
    await writeFile(outputPath, jsonContent, 'utf-8');

    if (verbose) {
      console.error(`${GREEN}[MCPTEST]${RESET} ✓ Execution log written successfully`);
      console.error(`${GREEN}[MCPTEST]${RESET}   Version: ${this.EXECUTION_LOG_VERSION}`);
      console.error(`${GREEN}[MCPTEST]${RESET}   mcpdesc Version: ${mcpdescMetadata.mcpdescVersion}`);
      console.error(`${GREEN}[MCPTEST]${RESET}   Executions: ${executions.length}`);
      console.error(`${GREEN}[MCPTEST]${RESET}   Server: ${mcpdescMetadata.serverInfo.name} v${mcpdescMetadata.serverInfo.version}`);
    }

    return outputPath;
  }

  /**
   * Convert ToolResult to ExecutionEntry format
   * @param scenarioName Name of the test scenario
   * @param toolResult Test execution result
   * @returns ExecutionEntry for execution log
   */
  static convertToExecutionEntry(
    scenarioName: string,
    toolResult: ToolResult
  ): ExecutionEntry {
    // Calculate execution hash (tool name + arguments)
    const hashInput = JSON.stringify({
      tool: toolResult.toolName,
      // Extract arguments from result if available
      // Note: arguments should be passed separately in real usage
    });
    const hash = createHash('sha256');
    hash.update(hashInput);
    const executionHash = hash.digest('hex');

    return {
      scenarioName,
      toolName: toolResult.toolName,
      arguments: {},  // Should be passed from scenario
      response: {
        success: toolResult.success,
        duration: toolResult.duration,
        result: toolResult.result,
        error: toolResult.error
      },
      timestamp: new Date().toISOString(),
      executionHash
    };
  }

  /**
   * Log helper - respects verbose flag
   */
  private log(message: string, verbose: boolean): void {
    if (verbose) {
      console.error(`${GREEN}[MCPTEST]${RESET} ${message}`);
    }
  }

  /**
   * Warning helper - always shown
   */
  private warn(message: string): void {
    console.error(`${YELLOW}[WARN]${RESET} ${message}`);
  }

  /**
   * Error helper - always shown
   */
  private error(message: string): void {
    console.error(`${RED}[ERROR]${RESET} ${message}`);
  }
}
