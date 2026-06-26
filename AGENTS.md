# AGENTS.md - Developer Guide for mcptest

Quick reference for AI agents and developers extending this MCP testing toolkit.

## Project Overview

**mcptest** - Automated testing framework for Model Context Protocol (MCP) servers.

**Purpose**: Auto-generate tests from mcpdesc files, execute scenarios, record golden files, detect regressions, and enable fast CI/CD with mocks.

**Tech Stack**: TypeScript, Node.js 18+, Commander.js, yaml, Ajv, MCP SDK

**Version Management**: Follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). All changes must be documented in [CHANGELOG.md](CHANGELOG.md) before release.

**Commands**:
- `run` - Execute test scenarios against live MCP server
- `generate` - Auto-generate scenarios from mcpdesc files
- `record` - Record golden files and mock data from live server
- `merge-logs` - Merge execution logs from different versions
- `validate` - Validate scenarios against JSON Schema
- `schema` - Show scenario schema and examples
- `completion` - Generate shell completion scripts
- `agents` - Show this developer guide

## File Structure

```
mcptoolkit-test/
├── src/
│   ├── index.ts              # CLI entry point (Commander setup)
│   ├── commands/             # Command implementations
│   │   ├── run.ts           # Execute scenarios against server
│   │   ├── generate.ts      # Auto-generate from mcpdesc files
│   │   ├── record.ts        # Record golden files + mock data
│   │   ├── merge-logs.ts    # Merge execution logs
│   │   ├── validate.ts      # Validate scenarios
│   │   ├── schema.ts        # Show schema and examples
│   │   ├── completion.ts    # Shell completions
│   │   └── agents.ts        # Developer guide
│   └── lib/                  # Core libraries
│       ├── types.ts         # Type definitions
│       ├── mcp-client.ts    # MCP client wrapper (from Inspector)
│       ├── scenario-loader.ts    # Load/validate YAML scenarios
│       ├── test-executor.ts      # Execute tests against server
│       ├── golden-file-manager.ts # Record/compare baselines
│       ├── mcpdesc-loader.ts     # Load/parse mcpdesc files
│       ├── scenario-generator.ts  # Auto-generate from mcpdesc files
│       ├── execution-log-writer.ts # Export versioned execution logs
│       └── version-validator.ts    # Validate mcpdesc/log consistency
├── schemas/
│   ├── scenario-schema.json      # YAML scenario validation
│   ├── execution-log-schema.json # Execution log format
│   ├── mcpdesc-schema-v0.6.0.json # mcpdesc reference schema
│   └── dump-schema-v0.3.6.json   # Deprecated dump schema
├── tests/
│   ├── fixtures/
│   │   ├── scenarios/       # Test YAML files
│   └── execution-logs/      # Sample execution logs
├── docs/
│   ├── dump-to-tests-workflow.md   # End-user workflow guide
│   ├── execution-logs-workflow.md  # End-user execution log guide
│   ├── SCENARIO_GENERATION_STRATEGY.md # Scenario authoring guidance
│   ├── maintainers/         # Design and implementation references
│   └── dust/                # Historical planning and archived notes
└── build/                   # TypeScript output (gitignored)
```

## Code Style Guidelines (Match mcpcontract/mcpmock)

### 1. Imports

**Use Node.js built-in prefix** (`node:*`):

```typescript
// ✅ Correct
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// ❌ Incorrect
import { readFile } from 'fs/promises';
```

**Use `.js` extensions** (ES modules):

```typescript
// ✅ Correct
import { ScenarioLoader } from './lib/scenario-loader.js';
import type { Scenario } from './lib/types.js';

// ❌ Incorrect
import { ScenarioLoader } from './lib/scenario-loader';
```

### 2. File Paths

**Use `import.meta.url` for relative paths**:

```typescript
// ✅ Correct
const schemaPath = new URL('../schemas/scenario-schema.json', import.meta.url).pathname;

// ❌ Incorrect
const schemaPath = path.join(__dirname, '../schemas/scenario-schema.json');
```

### 3. Async/Await

**Use async/await consistently** (not callbacks):

```typescript
// ✅ Correct
async function loadScenario(path: string): Promise<Scenario> {
  const content = await readFile(path, 'utf-8');
  return YAML.parse(content);
}

// ❌ Incorrect
function loadScenario(path: string, callback: (err, data) => void): void {
  readFile(path, 'utf-8', (err, content) => {
    if (err) return callback(err, null);
    callback(null, YAML.parse(content));
  });
}
```

### 4. Type Annotations

**Explicit return types** for public functions:

```typescript
// ✅ Correct
export async function executeScenario(scenario: Scenario): Promise<TestResult> {
  // ...
}

export function formatResult(result: TestResult, pretty: boolean = true): string {
  // ...
}

// ❌ Incorrect (implicit return type)
export async function executeScenario(scenario: Scenario) {
  // ...
}
```

### 5. Error Handling

**Throw typed errors, handle with instanceof**:

```typescript
// ✅ Correct
if (!scenario.tools || scenario.tools.length === 0) {
  throw new ScenarioValidationError('Scenario must contain at least one tool call');
}

// Error handler
if (error instanceof ScenarioValidationError) {
  console.error(`Validation error: ${error.message}`);
}

// ❌ Incorrect
if (!scenario.tools) {
  throw new Error('No tools');
}
```

### 6. Logging Pattern

**Use ANSI colors, log to stderr** (same as mcpcontract/mcpmock):

```typescript
// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

// Log to stderr (respects verbose flag)
function log(message: string, verbose: boolean): void {
  if (verbose) {
    console.error(`${GREEN}[MCPTEST]${RESET} ${message}`);
  }
}

// Warning messages (always shown)
function warn(message: string): void {
  console.error(`${YELLOW}[WARN]${RESET} ${message}`);
}

// Error messages (always shown)
function error(message: string): void {
  console.error(`${RED}[ERROR]${RESET} ${message}`);
}
```

**Why stderr?** Keeps stdout clean for test results (JSON/YAML output).

## Command Syntax & Style

Follow mcpcontract/mcpmock patterns:

```bash
# Execute scenarios (similar to mcpcontract dump)
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden golden/ \
  --verbose

# Generate scenarios from mcpdesc
mcptest generate \
  --mcpdesc chess-coach.mcpdesc.json \
  --output scenarios/ \
  --coverage full \
  --verbose

# Record baselines (similar to mcpmock record)
mcptest record \
  --scenarios scenarios/ \
  --server http://localhost:8000 \
  --golden golden/ \
  --mock-data mock.jsonl \
  --verbose

# Merge execution logs
mcptest merge-logs \
  --old execution-logs/v0.4.0.json \
  --new execution-logs/v0.5.0.json \
  --output execution-logs/merged.json \
  --verbose
```

**Conventions**:
- `--scenarios <path>` for scenario directory/file
- `--mcpdesc <path>` for mcpdesc files
- `--server <url>` for MCP server connection
- `--golden <path>` for golden file directory
- `--export <path>` for execution log export
- `--output <path>` for output files/directories
- `--format <type>` for output format (json, yaml, html, junit)
- `--verbose` for detailed logging
- `--pretty` for formatted output

## Key Technical Choices

### 1. MCP Inspector Client (MIT Licensed)

**Source**: `@modelcontextprotocol/sdk` - official Anthropic implementation

**Why**: Proven, maintained, official protocol support

**Usage**: Wrap in `MCPTestClient` for test-specific needs:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export class MCPTestClient {
  private client: Client;
  
  async connect(serverUrl: string): Promise<void> {
    // Wrap MCP client with test-friendly API
  }
  
  async callTool(name: string, args: unknown): Promise<ToolResult> {
    // Execute tool and capture timing/metrics
  }
}
```

### 2. YAML Scenarios (AI-Generatable)

**Format**: Declarative, human-readable, LLM-friendly

**Schema**: `schemas/scenario-schema.json` (JSON Schema validation)

```yaml
name: "query_games - basic test"
description: "Verify query_games returns results"
tools:
  - name: "query_games"
    arguments:
      limit: 10
    assertions:
      - type: "response-type"
        expected: "array"
      - type: "array-length-max"
        expected: 10
```

### 3. mcpdesc-Driven Testing

**Contract**: mcpdesc (MCP Server Description) file as source of truth

**Flow**: mcpdesc → Generate Scenarios → Execute → Compare Golden Files

**Why**: Zero manual test writing, automatic coverage

**Note**: The dump format is deprecated. Use `mcpcontract convert` to convert existing dump files to mcpdesc format.

### 4. Golden Files (Regression Detection)

**Format**: JSON with metadata (timestamp, version, fuzzy fields)

**Comparison**: Exact match by default, fuzzy matching for timestamps/IDs

**Updates**: `--update-golden` flag to refresh baselines

### 5. Mock Integration (Fast CI/CD)

**Source**: mcpmock for record/replay

**Dual Output**: Golden files (regression) + Mock data (speed)

**Speed**: 3-5s mock tests vs 30-60s live server

## Development Workflow

```bash
# Build
npm run build

# Watch mode
npm run watch

# Run all tests
npm test

# Watch mode for tests
npm run test:watch

# Coverage report
npm run test:coverage

# Manual CLI tests
node build/index.js run --help
node build/index.js generate --mcpdesc test.mcpdesc.json --output scenarios/
```

## Testing Requirements

**Testing framework**: Jest with ES modules support (`jest.config.js`)

**Test structure**:
- `tests/unit/` - Unit tests (fast, isolated)
- `tests/integration/` - Integration tests (full workflows)
- `tests/fixtures/` - Test data (scenarios, mcpdesc files, golden files)

**Coverage goals**:
- Phase 1: 70% (focus on core logic)
- Phase 2: 75% (add recording tests)
- Phase 3: 80% (match mcpcontract)

**For new features**:
1. Add unit tests in `tests/unit/`
2. Add integration tests in `tests/integration/` (for full workflows)
3. Add test fixtures in `tests/fixtures/` (when applicable)

## Feature Status & Roadmap

### Implemented Features ✅ (v0.10.0)

#### Core Testing
- ✅ MCP client wrapper (from Inspector)
- ✅ YAML scenario loader with JSON Schema validation
- ✅ Test executor with assertion engine
- ✅ Multiple transport types (stdio, streamable-http, sse)
- ✅ Environment variable support for stdio servers
- ✅ `mcptest run` command
- ✅ `mcptest validate` command

#### Auto-Generation
- ✅ Scenario generator from mcpdesc files
- ✅ `mcptest generate` command
- ✅ Three coverage strategies (basic, full, edge-cases)
- ✅ Smart parameter value generation
- ✅ AI-assisted generation support

#### Regression Detection
- ✅ Golden file manager with fuzzy matching
- ✅ `mcptest record` command
- ✅ Timestamp/UUID/ID normalization
- ✅ Deep comparison with detailed diffs
- ✅ Incremental recording mode

#### Mock Integration
- ✅ Execution log export (`--export` flag)
- ✅ Execution log schema with version tracking
- ✅ Hash-based incremental recording
- ✅ Version validation (mcpdesc checksum)
- ✅ `mcptest merge-logs` command
- ✅ mcpmock integration (import via `mcpmock import --execution-log`)
- ✅ Full workflow: test → export log → import to mcpmock → mock data
- ✅ Fast CI/CD (3-5s mock vs 30-60s live)
- ✅ Tutorial: [Execution Logs Workflow](docs/execution-logs-workflow.md)

#### Developer Experience
- ✅ Shell completion scripts
- ✅ Copilot prompt generator
- ✅ Developer guide (`mcptest agents`)
- ✅ ANSI color output
- ✅ TypeScript with ES modules

### Planned Features 📋

#### Production Features (Next)
- 📋 Multiple report formats (HTML, JUnit, JSON)
- 📋 CI/CD templates and GitHub Actions workflows
- 📋 Performance metrics and benchmarking
- 📋 Extended assertion types (json-schema, regex, custom)
- 📋 Report generator with Handlebars templates

#### Future Enhancements
- 📋 Zsh and Fish completion scripts
- 📋 Advanced fuzzy matching patterns
- 📋 Parallel test execution
- 📋 Test coverage reports

## Release Process

When implementing features or fixes:

1. **Update version** in `package.json` following semantic versioning:
   - MAJOR (X.0.0): Breaking changes to CLI or scenario format
   - MINOR (0.X.0): New commands/features (backward-compatible)
   - PATCH (0.0.X): Bug fixes, docs (non-breaking)

2. **Update CHANGELOG.md** with changes under appropriate section:
   - `### Added` - New features
   - `### Changed` - Changes to existing functionality
   - `### Fixed` - Bug fixes

3. **Test thoroughly** before committing

4. **Commit and tag**:
   ```bash
   git add .
   git commit -m "Release v0.X.Y"
   git tag v0.X.Y
   git push && git push --tags
   ```

## Quick Start for Development

```bash
# Build project
npm run build

# Watch mode (auto-rebuild)
npm run watch

# Run tests
npm test

# Test CLI commands
node build/index.js --help
node build/index.js agents
node build/index.js completion bash
```

## References

- **Maintainer References**: `docs/maintainers/`
- **User Guides**: 
  - [mcpdesc to Tests Workflow](docs/dump-to-tests-workflow.md)
  - [Execution Logs Workflow](docs/execution-logs-workflow.md) ⭐ NEW
  - [Scenario Generation Strategy](docs/SCENARIO_GENERATION_STRATEGY.md)
- **mcpcontract**: Source of mcpdesc files (use `mcpcontract convert` for dump→mcpdesc)
- **mcpmock**: Mock server integration (Phase 5)
- **chess-coach**: Example MCP server for testing
- **MCP Spec**: https://spec.modelcontextprotocol.io/
- **Version History**: [CHANGELOG.md](CHANGELOG.md)

---

**Keep this file updated** as new commands and patterns are added.
