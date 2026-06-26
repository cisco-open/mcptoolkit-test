#!/usr/bin/env node

// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * mcptest - Automated testing framework for MCP servers
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { runCommand } from './commands/run.js';
import { schemaCommand } from './commands/schema.js';
import { agentsCommand } from './commands/agents.js';
import { validateCommand } from './commands/validate.js';
import { completionCommand } from './commands/completion.js';
import { recordCommand } from './commands/record.js';
import { generateCommand } from './commands/generate.js';
import { mergeLogsCommand } from './commands/merge-logs.js';

// Read package.json for version
const packagePath = new URL('../package.json', import.meta.url).pathname;
const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));

const program = new Command();

program
  .name('mcptest')
  .description('Automated testing framework for Model Context Protocol (MCP) servers')
  .version(packageJson.version);

// Add commands
program.addCommand(runCommand());
program.addCommand(recordCommand());
program.addCommand(generateCommand());
program.addCommand(mergeLogsCommand());
program.addCommand(validateCommand());
program.addCommand(schemaCommand());
program.addCommand(agentsCommand());
program.addCommand(completionCommand());

// Parse arguments
program.parse();
