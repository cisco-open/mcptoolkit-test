// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Schema command - Show scenario schema and examples for AI-assisted generation
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Generate Copilot prompt for current project
 */
async function showCopilotPrompt(): Promise<void> {
  // Try to find mcpdesc file
  const possibleDescs = [
    'mcpcontract/mcpdesc/latest.mcpdesc.json',
    'mcpdesc/latest.mcpdesc.json',
    'server.mcpdesc.json',
    '.mcp/server.mcpdesc.json'
  ];
  
  const descFile = possibleDescs.find(p => existsSync(resolve(process.cwd(), p)));
  const descPath = descFile || '[path-to-your-mcpdesc.json]';
  
  // Try to find test directory
  const possibleTestDirs = ['tests/mcp/', 'tests/scenarios/', 'scenarios/', 'test/'];
  const testDir = possibleTestDirs.find(p => existsSync(resolve(process.cwd(), p))) || 'tests/mcp/';
  
  console.log(`Create mcptest YAML test scenarios for all MCP server tools.

Context:
- mcpdesc file: ${descPath}
- MCP servers return TextContent (strings), not direct JSON
- Save scenarios in: ${testDir}

Requirements:
- Use response-type: "string" for all tool responses
- Use contains-text for content validation  
- Create realistic test cases with proper arguments
- Include both success and error test cases
- Follow naming pattern: toolname-testcase.yaml

Example scenario format:
\`\`\`yaml
name: "tool_name - test description"
description: "What this test validates"
tools:
  - name: "tool_name"
    arguments:
      param1: value1
      param2: value2
    assertions:
      - type: "response-type"
        expected: "string"
      - type: "contains-text"
        expected: "expected text in response"
\`\`\`

Available assertion types:
- response-type: "string" | "number" | "boolean" | "object" | "array"
- contains-text: Check if response contains specific text
- error: Expect an error response
- error-code: Expect specific error code (e.g., "INVALID_PARAMS")
- array-length: Exact array length
- array-length-max: Maximum array length

Instructions:
1. Read the mcpdesc file to get all available tools and their schemas
2. For each tool, create 2-3 test scenarios:
   - Basic happy path test
   - Test with filters/options (if applicable)
   - Error case test (invalid arguments)
3. Use realistic argument values based on the tool's purpose
4. Save each scenario as ${testDir}toolname-testcase.yaml

Create comprehensive test coverage for all tools in the mcpdesc file.`);
}

/**
 * Show scenario schema
 */
async function showSchema(): Promise<void> {
  const schemaPath = new URL('../../schemas/scenario-schema.json', import.meta.url).pathname;
  const schema = await readFile(schemaPath, 'utf-8');
  
  console.log(JSON.parse(schema));
}

/**
 * Show example scenarios
 */
function showExamples(): Promise<void> {
  console.log(`${BOLD}${GREEN}Example Test Scenario:${RESET}

${YELLOW}# Basic tool test${RESET}
name: "query_games - basic query"
description: "Verify query_games returns results"
tools:
  - name: "query_games"
    arguments:
      limit: 5
    assertions:
      - type: "response-type"
        expected: "string"
      - type: "contains-text"
        expected: "Found"

${YELLOW}# Test with error expectation${RESET}
name: "invalid_tool - error handling"
description: "Verify proper error handling"
tools:
  - name: "invalid_tool"
    arguments: {}
    assertions:
      - type: "error"
      - type: "error-code"
        expected: "TOOL_NOT_FOUND"

${YELLOW}# Available assertion types:${RESET}
- response-type: Check result type (string, number, boolean, object, array)
- contains-text: Verify text content includes expected string
- error: Expect an error response
- error-code: Expect specific error code
- array-length: Expect exact array length
- array-length-max: Expect array length <= max

${GREEN}See docs/ for more examples${RESET}
`);
  return Promise.resolve();
}

/**
 * Show AI assistant guide
 */
function showAIGuide(): Promise<void> {
  console.log(`${BOLD}${GREEN}AI Assistant Scenario Generation Guide${RESET}

${YELLOW}## Context You Need:${RESET}

1. ${BOLD}MCP Server Description${RESET} - Tool definitions with schemas
   Example: mcpcontract convert --dump <dump-file> --output server.mcpdesc.json

2. ${BOLD}Tool Documentation${RESET} - What each tool does
   Usually in README.md or API docs

3. ${BOLD}Example Usage${RESET} - Real-world use cases
   From source code, tests, or user stories

${YELLOW}## Recommended Workflow:${RESET}

${BOLD}Step 1: Get mcpdesc${RESET}
\`\`\`bash
mcpcontract convert --dump <dump-file> --output server.mcpdesc.json
# Review tools list and input schemas
\`\`\`

${BOLD}Step 2: Create Scenarios (AI-Assisted)${RESET}
Ask your AI coding assistant:
"Create mcptest scenarios for these MCP tools:
- Tool: query_games
- Schema: [paste from mcpdesc]
- Purpose: [describe what it does]
- Test cases: basic query, filtered query, empty results"

${BOLD}Step 3: Run Tests${RESET}
\`\`\`bash
mcptest run --scenarios scenarios/ --server <url>
\`\`\`

${BOLD}Step 4: Iterate${RESET}
- Review failures
- Adjust assertions
- Add edge cases

${YELLOW}## AI Assistant Prompt Template:${RESET}

"Create a mcptest YAML scenario for the following MCP tool:

Tool Name: [tool_name]
Input Schema: [from mcpdesc]
Purpose: [what it does]
Test Case: [specific scenario to test]

Use the mcptest schema:
- response-type for type checking
- contains-text for content validation
- error/error-code for error cases

MCP servers return TextContent (strings), not direct JSON."

${GREEN}For automated generation from mcpdesc files, use:${RESET}
  ${BOLD}mcptest generate --mcpdesc server.mcpdesc.json --output scenarios/${RESET}
  (Coming in Phase 3)
`);
  return Promise.resolve();
}

/**
 * Create schema command
 */
export function schemaCommand(): Command {
  const cmd = new Command('schema');

  cmd
    .description('Show scenario schema and generation guidance')
    .option('--json', 'Output schema as JSON')
    .option('--examples', 'Show example scenarios')
    .option('--ai-guide', 'Show AI assistant generation guide')
    .option('--copilot-prompt', 'Generate project-specific Copilot prompt')
    .action(async (options) => {
      try {
        if (options.copilotPrompt) {
          await showCopilotPrompt();
        } else if (options.examples) {
          await showExamples();
        } else if (options.aiGuide) {
          await showAIGuide();
        } else if (options.json) {
          await showSchema();
        } else {
          // Default: show guide
          await showAIGuide();
        }
      } catch (error) {
        console.error('\n❌ Error:');
        console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  return cmd;
}
