// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * MCP Description File Loader
 * 
 * Loads mcpdesc (MCP Server Description) files in JSON or YAML format.
 * Supports auto-detection based on file extension.
 * 
 * Note: The mcpdesc format replaces the deprecated dump format.
 * Use `mcpcontract convert` to convert dump files to mcpdesc format.
 */

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import YAML from 'yaml';
import type { McpDescFile } from './types.js';

/**
 * Supported mcpdesc file formats
 */
export type McpDescFormat = 'json' | 'yaml' | 'auto';

/**
 * Result of loading an mcpdesc file, including raw content for checksum calculation
 */
export interface McpDescLoadResult {
  mcpdesc: McpDescFile;
  rawContent: string;
}

/**
 * Detect file format from file extension
 */
function detectFormat(filePath: string): 'json' | 'yaml' {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case '.json':
      return 'json';
    case '.yaml':
    case '.yml':
      return 'yaml';
    default:
      // Default to JSON for unknown extensions (backward-compatible)
      return 'json';
  }
}

/**
 * Parse mcpdesc file content based on format
 */
function parseMcpDescContent(content: string, format: 'json' | 'yaml', filePath: string): McpDescFile {
  try {
    if (format === 'json') {
      return JSON.parse(content) as McpDescFile;
    } else {
      return YAML.parse(content) as McpDescFile;
    }
  } catch (error) {
    const formatLabel = format.toUpperCase();
    throw new Error(
      `Failed to parse mcpdesc file as ${formatLabel}: ${filePath}\n` +
      `  ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load an mcpdesc file from disk, supporting JSON, YAML, or auto-detection.
 * 
 * @param filePath - Path to the mcpdesc file
 * @param format - Format to use: 'json', 'yaml', or 'auto' (detect from extension)
 * @returns The parsed McpDescFile and raw content
 */
export async function loadMcpDescFile(filePath: string, format: McpDescFormat = 'auto'): Promise<McpDescLoadResult> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to read mcpdesc file: ${filePath}\n` +
      `  ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const resolvedFormat = format === 'auto' ? detectFormat(filePath) : format;
  const mcpdesc = parseMcpDescContent(content, resolvedFormat, filePath);

  return { mcpdesc, rawContent: content };
}
