// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Core type definitions for mcptest
 */

// ============================================================================
// Error Types
// ============================================================================

export class ScenarioValidationError extends Error {
  constructor(message: string, public filePath?: string) {
    super(message);
    this.name = 'ScenarioValidationError';
  }
}

export class MCPConnectionError extends Error {
  constructor(message: string, public serverUrl?: string) {
    super(message);
    this.name = 'MCPConnectionError';
  }
}

export class TestExecutionError extends Error {
  constructor(message: string, public scenarioName?: string) {
    super(message);
    this.name = 'TestExecutionError';
  }
}

// ============================================================================
// CLI Options
// ============================================================================

export interface RunOptions {
  scenarios: string;
  server?: string;
  golden?: string;
  mode?: 'live' | 'mock' | 'ci';
  mockData?: string;
  format?: 'json' | 'yaml' | 'junit' | 'html';
  output?: string;
  env?: string[];
  header?: string[];
  verbose: boolean;
  pretty: boolean;
}

export interface GenerateOptions {
  mcpdesc: string;
  output: string;
  coverage?: 'basic' | 'standard' | 'full';
  edgeCases: boolean;
  merge: boolean;
  verbose: boolean;
  pretty: boolean;
}

export interface RecordOptions {
  scenarios: string;
  server: string;
  golden: string;
  mockData?: string;
  export?: string;
  incremental: boolean;
  fuzzyMatch?: string;
  env?: string[];
  header?: string[];
  verbose: boolean;
}

// ============================================================================
// Scenario Types
// ============================================================================

export interface Scenario {
  name: string;
  description?: string;
  tags?: string[];
  tools: ToolCall[];
  mockOverride?: MockOverride;
}

export interface ToolCall {
  name: string;
  arguments?: Record<string, unknown>;
  assertions?: Assertion[];
}

export interface Assertion {
  type: 'response-type' | 'error' | 'contains-text' | 'golden-file' | 'json-schema' | 'custom' | 'array-length' | 'array-length-max' | 'error-code';
  expected?: unknown;
  schema?: Record<string, unknown>;
  expression?: string;
}

export interface MockOverride {
  toolName: string;
  response: ToolResponse;
}

// ============================================================================
// Test Execution Types
// ============================================================================

export interface TestResult {
  scenarioName: string;
  passed: boolean;
  duration: number;
  toolResults: ToolResult[];
  error?: string;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  duration: number;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
  assertions?: AssertionResult[];
}

export interface AssertionResult {
  type: string;
  passed: boolean;
  message?: string;
  expected?: unknown;
  actual?: unknown;
}

export interface ToolResponse {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

// ============================================================================
// Golden File Types
// ============================================================================

export interface GoldenFile {
  scenarioName: string;
  toolName: string;
  recordedAt: string;
  serverVersion?: string;
  response: ToolResult;
  fuzzyFields?: string[];  // Fields to ignore during comparison (e.g., ['timestamp', 'id'])
  metadata?: Record<string, unknown>;
}

export interface ComparisonResult {
  match: boolean;
  differences?: Difference[];
  fuzzyMatched?: string[];  // Fields that matched with fuzzy logic
}

export interface Difference {
  path: string;  // JSON path to the difference (e.g., 'content[0].text')
  expected: unknown;
  actual: unknown;
  type: 'missing' | 'extra' | 'type-mismatch' | 'value-mismatch';
}

export interface FuzzyMatchOptions {
  ignoreTimestamps?: boolean;  // Ignore ISO timestamp differences
  ignoreIds?: boolean;  // Ignore numeric/UUID ID differences
  customFields?: string[];  // Custom fields to ignore
  timestampTolerance?: number;  // Max milliseconds difference for timestamps
}

// ============================================================================
// Execution Log Types
// ============================================================================

export interface PreviousVersion {
  mcpdescVersion: string;  // mcpdesc version identifier
  recordedAt: string;   // ISO 8601 timestamp when this version was recorded
  executionCount?: number;  // Number of executions from this version
}

export interface ExecutionLog {
  version: string;  // Semver version of execution log format (e.g., "1.0.0")
  schema: string;   // Schema URI
  recordedAt: string;  // ISO 8601 timestamp
  metadata: ExecutionLogMetadata;
  executions: ExecutionEntry[];
}

export interface ExecutionLogMetadata {
  mcptestVersion: string;  // Version of mcptest that recorded this
  mcpdescVersion: string;  // Version from mcpdesc file
  mcpdescFile: string;     // Path to mcpdesc file
  mcpdescChecksum: string; // SHA-256 checksum of mcpdesc file
  serverInfo: ServerInfo;  // Server name and version
  serverUrl: string;       // Server URL used for recording
  transport: string;       // Transport type (stdio, http, sse, streamable-http)
  previousVersions?: PreviousVersion[];  // Array of previous version metadata (for merged logs)
}

export interface ExecutionEntry {
  scenarioName: string;
  toolName: string;
  arguments: Record<string, unknown>;
  response: {
    success: boolean;
    duration: number;
    result?: unknown;
    error?: {
      code: string;
      message: string;
    };
  };
  timestamp: string;  // ISO 8601 timestamp
  executionHash?: string;  // SHA-256 hash of tool name + arguments
}

// ============================================================================
// MCP Client Types
// ============================================================================

export interface MCPClientConfig {
  serverUrl: string;
  transport: 'stdio' | 'http' | 'sse' | 'streamable-http';
  timeout?: number;
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

// ============================================================================
// MCP Description File Types (from mcpcontract)
// ============================================================================

export interface McpDescFile {
  mcpdesc: string;
  info: McpDescInfo;
  transports?: McpDescTransport[];
  capabilities?: Record<string, unknown>;
  tools?: Tool[];
  prompts?: Prompt[];
  resources?: Resource[];
  resourceTemplates?: ResourceTemplate[];
}

export interface McpDescInfo {
  name: string;
  version: string;
  title?: string;
  description?: string;
  protocolVersion?: string;
  id?: string;
  contact?: Record<string, string>;
  license?: { name: string; url?: string };
}

export interface McpDescTransport {
  type: 'streamable-http' | 'stdio' | 'sse';
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ServerInfo {
  name: string;
  version: string;
  protocolVersion?: string;
  capabilities?: string[];
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema?: ToolInputSchema;
}

export interface ToolInputSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
}

export interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}
