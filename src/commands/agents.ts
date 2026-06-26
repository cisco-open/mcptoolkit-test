// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Agents command - Show developer guide for AI assistants and developers
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Show Copilot workflow
 */
function showCopilotWorkflow(): void {
  console.log(`${BOLD}${GREEN}Zero-Manual Test Generation Workflows${RESET}

${YELLOW}## Option A: Auto-Generate from mcpdesc (v0.10.0) ⭐${RESET}

${BOLD}Step 1: Get mcpdesc File${RESET}
   ${CYAN}mcpcontract dump --config .mcp-config.json --output dump.json
   mcpcontract convert --dump dump.json --output server.mcpdesc.json${RESET}

${BOLD}Step 2: Auto-Generate Scenarios${RESET}
   ${CYAN}mcptest generate --mcpdesc server.mcpdesc.json --output scenarios/ --coverage full${RESET}
   
   Coverage strategies:
   - basic: Happy path + minimal (fast)
   - full: + Parameter variations (recommended)
   - edge-cases: + Edge cases (comprehensive)

${BOLD}Step 3: Validate Scenarios${RESET}
   ${CYAN}mcptest validate --scenarios scenarios/${RESET}

${BOLD}Step 4: Run Tests${RESET}
   ${CYAN}mcptest run --scenarios scenarios/ --server <url>${RESET}

${BOLD}Step 5: Record Golden Files${RESET}
   ${CYAN}mcptest record --scenarios scenarios/ --server <url> --golden golden/${RESET}

${YELLOW}## Option B: AI-Assisted with Copilot${RESET}

${BOLD}Step 1: Generate Copilot Prompt${RESET}
   ${CYAN}cd your-mcp-project
   mcptest schema --copilot-prompt${RESET}

   This auto-detects:
   - Your mcpdesc file (e.g., mcpcontract/mcpdesc/*.mcpdesc.json)
   - Test directory structure
   - Tool schemas and requirements

${BOLD}Step 2: Paste to GitHub Copilot${RESET}
   - Copy the entire output
   - Paste into Copilot chat
   - Copilot will read your mcpdesc and generate all test scenarios

${BOLD}Step 3: Validate Scenarios${RESET}
   ${CYAN}mcptest validate --scenarios tests/mcp/${RESET}
   
   Checks all YAML files match the schema

${BOLD}Step 4: Run Tests${RESET}
   ${CYAN}mcptest run --scenarios tests/mcp/ --server <url>${RESET}

${BOLD}Step 5: Iterate${RESET}
   - Fix failing tests
   - Add more test cases
   - Update scenarios as tools evolve

${YELLOW}## Why This Workflow?${RESET}

✓ ${GREEN}Zero manual test writing${RESET} - Copilot reads your mcpdesc
✓ ${GREEN}Complete coverage${RESET} - Generates scenarios for all tools
✓ ${GREEN}Correct format${RESET} - Follows mcptest YAML schema
✓ ${GREEN}Fast iteration${RESET} - Validate before running

${YELLOW}## Example: chess-coach${RESET}

${CYAN}# 1. Generate prompt (30 seconds)
mcptest schema --copilot-prompt

# 2. Paste to Copilot → get 8 test scenarios

# 3. Validate (instant)
mcptest validate --scenarios tests/mcp/

# 4. Run tests (5 seconds)
mcptest run --scenarios tests/mcp/ --server stdio://...

# Result: 8 tools tested in under 1 minute!${RESET}

${GREEN}See other workflows: mcptest agents --workflow${RESET}
`);
}

/**
 * Show quick start guide
 */
function showQuickStart(): void {
  console.log(`${BOLD}${GREEN}mcptest - Quick Start Guide${RESET}

${YELLOW}## What is mcptest?${RESET}

Automated testing framework for MCP (Model Context Protocol) servers.
Test your MCP tools with YAML scenarios, validate responses, detect regressions.

${YELLOW}## Quick Usage${RESET}

${BOLD}1. Auto-generate scenarios from mcpdesc${RESET} ⭐:
   ${CYAN}mcptest generate --mcpdesc server.mcpdesc.json --output scenarios/ --coverage full${RESET}
   Or use AI: ${CYAN}mcptest schema --copilot-prompt${RESET}
   Or manual: ${CYAN}mcptest schema --examples${RESET}

${BOLD}2. Validate scenarios${RESET}:
   ${CYAN}mcptest validate --scenarios scenarios/${RESET}

${BOLD}3. Run tests${RESET}:
   ${CYAN}mcptest run --scenarios scenarios/ --server <url>${RESET}

${BOLD}4. Record baselines${RESET}:
   ${CYAN}mcptest record --scenarios scenarios/ --server <url> --golden golden/${RESET}

${BOLD}5. Review results${RESET}:
   Tests show pass/fail with detailed assertion failures

${YELLOW}## Supported Transports${RESET}

- ${BOLD}stdio${RESET}: Local command-line servers
  ${CYAN}stdio:///path/to/python?args=-m,my_server${RESET}

- ${BOLD}streamable-http${RESET}: Modern HTTP servers (default for http://)
  ${CYAN}http://localhost:3000${RESET}

- ${BOLD}sse${RESET}: Legacy Server-Sent Events
  ${CYAN}sse://localhost:3000${RESET}

${YELLOW}## Environment Variables${RESET}

Pass config to stdio servers:
   ${CYAN}mcptest run --server stdio://... --env DATABASE_PATH=/path/to/db${RESET}

${YELLOW}## Example Workflow${RESET}

${BOLD}Step 1: Get server capabilities${RESET}
\`\`\`bash
mcpcontract dump --server <url> --output dump.json
mcpcontract convert --dump dump.json --output server.mcpdesc.json
\`\`\`

${BOLD}Step 2: Auto-generate scenarios${RESET} ⭐
\`\`\`bash
mcptest generate \\
  --mcpdesc server.mcpdesc.json \\
  --output scenarios/ \\
  --coverage full
\`\`\`

${BOLD}Step 3: Validate scenarios${RESET}
\`\`\`bash
mcptest validate --scenarios scenarios/
\`\`\`

${BOLD}Step 4: Run tests${RESET}
\`\`\`bash
mcptest run \\
  --scenarios scenarios/ \\
  --server http://localhost:3000 \\
  --verbose
\`\`\`

${BOLD}Step 5: Record golden files${RESET}
\`\`\`bash
mcptest record \\
  --scenarios scenarios/ \\
  --server http://localhost:3000 \\
  --golden golden/
\`\`\`

${YELLOW}## Scenario Structure${RESET}

\`\`\`yaml
name: "tool_name - test description"
description: "What this test validates"
tools:
  - name: "tool_name"
    arguments:
      param1: value1
    assertions:
      - type: "response-type"
        expected: "string"
      - type: "contains-text"
        expected: "success"
\`\`\`

${YELLOW}## Available Assertions${RESET}

- ${BOLD}response-type${RESET}: Check type (string, number, boolean, object, array)
- ${BOLD}contains-text${RESET}: Verify text content
- ${BOLD}error${RESET}: Expect error response
- ${BOLD}error-code${RESET}: Expect specific error code
- ${BOLD}array-length${RESET}: Exact array length
- ${BOLD}array-length-max${RESET}: Maximum array length

${YELLOW}## More Information${RESET}

- Full guide: ${CYAN}mcptest agents --full${RESET}
- Schema reference: ${CYAN}mcptest schema --ai-guide${RESET}
- Examples: ${CYAN}mcptest schema --examples${RESET}
- GitHub: https://github.com/cisco-open/mcptoolkit-test

${GREEN}Ready to test your MCP server!${RESET}
`);
}

/**
 * Show full developer guide
 */
async function showFullGuide(): Promise<void> {
  try {
    const agentsPath = new URL('../../AGENTS.md', import.meta.url).pathname;
    const content = await readFile(agentsPath, 'utf-8');
    console.log(content);
  } catch (error) {
    console.error(`${YELLOW}Warning: Could not read AGENTS.md${RESET}`);
    showQuickStart();
  }
}

/**
 * Show workflow guide
 */
function showWorkflow(): void {
  console.log(`${BOLD}${GREEN}mcptest - Recommended Workflow${RESET}

${YELLOW}## Phase 1: Setup${RESET}

${BOLD}1. Install mcptest${RESET}
\`\`\`bash
npm install -g mcptest
\`\`\`

${BOLD}2. Get MCP server description${RESET} (tool definitions):
\`\`\`bash
mcpcontract dump \\
  --server http://localhost:3000 \\
  --output dump.json
mcpcontract convert --dump dump.json --output server.mcpdesc.json
\`\`\`

${YELLOW}## Phase 2: Create Scenarios${RESET}

${BOLD}Option A: AI-Assisted Generation (Recommended)${RESET}

1. Get schema guide:
   \`\`\`bash
   mcptest schema --ai-guide
   \`\`\`

2. Ask AI (GitHub Copilot, Claude, ChatGPT):
   \`\`\`
   "Create mcptest YAML scenarios for these MCP tools:
   [paste mcpdesc excerpt]
   
   Test cases:
   - Basic functionality
   - Filtered queries
   - Error handling"
   \`\`\`

3. Save as \`scenarios/toolname-test.yaml\`

${BOLD}Option B: Manual Creation${RESET}

1. View examples:
   \`\`\`bash
   mcptest schema --examples
   \`\`\`

2. Copy/modify for your tools

${YELLOW}## Phase 3: Run Tests${RESET}

${BOLD}Single scenario:${RESET}
\`\`\`bash
mcptest run \\
  --scenarios scenarios/query-games.yaml \\
  --server http://localhost:3000
\`\`\`

${BOLD}All scenarios:${RESET}
\`\`\`bash
mcptest run \\
  --scenarios scenarios/ \\
  --server http://localhost:3000 \\
  --verbose
\`\`\`

${BOLD}With environment variables (stdio):${RESET}
\`\`\`bash
mcptest run \\
  --scenarios scenarios/ \\
  --server "stdio:///path/to/python?args=-m,server" \\
  --env DATABASE_PATH=/path/to/db \\
  --env API_KEY=secret
\`\`\`

${YELLOW}## Phase 4: Iterate${RESET}

1. ${BOLD}Review failures${RESET} - mcptest shows detailed assertion errors
2. ${BOLD}Adjust assertions${RESET} - Fix expected values
3. ${BOLD}Add edge cases${RESET} - Test error conditions
4. ${BOLD}Re-run${RESET} - Verify fixes

${YELLOW}## Tips${RESET}

- ${BOLD}MCP servers return TextContent${RESET} (strings), not direct JSON
  Use \`response-type: "string"\` and \`contains-text\`

- ${BOLD}Use --verbose${RESET} to see detailed execution logs

- ${BOLD}Test error cases${RESET} with \`error\` and \`error-code\` assertions

- ${BOLD}Organize scenarios${RESET} by feature/tool:
  \`\`\`
  scenarios/
  ├── games/
  │   ├── query-basic.yaml
  │   └── query-filtered.yaml
  └── themes/
      └── detect-themes.yaml
  \`\`\`

${GREEN}See full guide: mcptest agents --full${RESET}
`);
}

/**
 * Create agents command
 */
export function agentsCommand(): Command {
  const cmd = new Command('agents');

  cmd
    .description('Show developer guide for using mcptest')
    .option('--full', 'Show complete AGENTS.md developer guide')
    .option('--workflow', 'Show recommended workflow')
    .option('--copilot', 'Show Copilot-assisted test generation workflow')
    .action(async (options) => {
      try {
        if (options.full) {
          await showFullGuide();
        } else if (options.copilot) {
          showCopilotWorkflow();
        } else if (options.workflow) {
          showWorkflow();
        } else {
          // Default: quick start
          showQuickStart();
        }
      } catch (error) {
        console.error('\n❌ Error:');
        console.error(`   ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  return cmd;
}
