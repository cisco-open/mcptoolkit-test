# MCP Toolkit: Test Servers

Test MCP servers with declarative YAML scenarios auto-generated from MCP Descriptions ([mcpdesc](https://github.com/cisco-open/mcptoolkit-contract) files).

You may use `mcptest` for:
- **Validation**: Verify your MCP server responds correctly to all tool calls
- **Regression detection**: Record golden files and catch unintended changes automatically
- **CI/CD integration**: Export execution logs for fast mock-based testing with [mcpmock](https://github.com/cisco-open/mcptoolkit-mock)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: pre-release](https://img.shields.io/badge/status-1.0.0--rc.1-orange.svg)](CHANGELOG.md)
[![Node.js: >=20.x](https://img.shields.io/badge/Node.js-%3E%3D20.x-brightgreen.svg)](https://nodejs.org/)

> **⚠️ Pre-release notice**: the mcptest CLI is functional but has seen limited real-world testing compared to other MCP Toolkit tools. Core workflows (generate, run, record) have been validated against the chess-coach example server; broader compatibility and edge cases are still being hardened. Feedback and bug reports are welcome.

## Features

- ✅ Auto-generate test scenarios from mcpdesc files (zero manual work)
- ✅ AI-assisted scenario generation with GitHub Copilot
- ✅ Golden file regression detection with fuzzy matching (timestamps, UUIDs, IDs)
- ✅ Export execution logs for mock integration and fast CI/CD
- ✅ Supports stdio and streamable-http transports (legacy SSE supported)
- ✅ Three coverage strategies: basic, full, edge-cases

## Quick Start

```bash
npm install -g @cisco_open/mcptoolkit-test

# Generate test scenarios from your server description
mcptest generate --mcpdesc server.mcpdesc.json --output scenarios/ --coverage full

# Run tests against your server
mcptest run --scenarios scenarios/ --server http://localhost:8000
```

For a complete walkthrough, see **[Tutorial: Chess Coach](docs/chess-coach-tutorial.md)**.

## Installation

```bash
npm install -g @cisco_open/mcptoolkit-test

# Verify
mcptest --help
```

**For development / local builds**:
```bash
git clone https://github.com/cisco-open/mcptoolkit-test.git
cd mcptoolkit-test
npm install && npm run build && npm link
```

## Workflows

### 1. Generate Test Scenarios

Auto-generate a complete test suite from an mcpdesc file:

```bash
mcptest generate \
  --mcpdesc server.mcpdesc.json \
  --output scenarios/ \
  --coverage full
```

Or use GitHub Copilot for AI-assisted generation:

```bash
# Generate a Copilot prompt auto-configured for your project
mcptest schema --copilot-prompt
```

Paste the output into GitHub Copilot chat — it reads your mcpdesc and generates realistic scenarios with proper assertions for all tools.

👉 [Tutorial: Chess Coach](docs/chess-coach-tutorial.md)

### 2. Run Tests

Execute scenarios against your MCP server:

```bash
# HTTP server
mcptest run --scenarios scenarios/ --server http://localhost:8000

# Stdio server with environment variables
mcptest run \
  --scenarios scenarios/ \
  --server stdio:///path/to/python?args=-m,my_mcp_server \
  --env DATABASE_PATH=/path/to/db
```

Results show pass/fail with timing and detailed failure context:

```
Test Results: 3/4 passed (75%)

✓ query_games - basic test (9ms)
✓ query_games - with filters (7ms)
✓ detect_themes - basic test (647ms)
✗ get_statistics - basic test (FAILED)
  Tool: get_statistics
  Error: Parameter validation failed
```

### 3. Record & Detect Regressions

Capture baseline responses, then compare on every run:

```bash
# Record baselines
mcptest record \
  --scenarios scenarios/ \
  --server http://localhost:8000 \
  --golden golden/

# Run with regression detection
mcptest run \
  --scenarios scenarios/ \
  --server http://localhost:8000 \
  --golden golden/
```

Golden files automatically normalize non-deterministic values during comparison: ISO-8601 timestamps → `<TIMESTAMP>`, UUIDs → `<UUID>`, and `id`-like properties (e.g. `id`, `sessionId`, `user_id`) → `<ID>`. To ignore additional volatile fields, pass their names to `--fuzzy-match` when recording (e.g. `--fuzzy-match createdAt,requestId`); those fields are then ignored by name wherever they appear in the response, including nested objects and arrays. Use `--incremental` to skip re-recording unchanged scenarios.

👉 [Execution Logs Workflow](docs/execution-logs-workflow.md)

## CLI Commands

### `mcptest generate` — Auto-Generate Scenarios

```bash
mcptest generate --mcpdesc <path> --output <path> [options]

Options:
  -d, --mcpdesc <path>       mcpdesc file (JSON or YAML)
  -o, --output <path>        Output directory for scenarios
  -c, --coverage <strategy>  basic | full | edge-cases  (default: basic)
  -m, --merge                Preserve existing manual tests
  -v, --verbose              Detailed logging
```

### `mcptest run` — Execute Tests

```bash
mcptest run --scenarios <path> --server <url> [options]

Options:
  -s, --scenarios <path>   Scenario file or directory
  -S, --server <url>       MCP server URL
  -g, --golden <path>      Golden files directory (enables regression detection)
  -t, --transport <type>   Transport type (auto-detected from URL)
  -e, --env <KEY=VALUE>    Environment variables (repeatable)
  -v, --verbose            Detailed logging
  --pretty                 Pretty-print JSON output
```

### `mcptest record` — Record Golden Files

```bash
mcptest record --scenarios <path> --server <url> --golden <path> [options]

Options:
  -s, --scenarios <path>   Scenario file or directory
  -S, --server <url>       MCP server URL
  -g, --golden <path>      Golden files directory
  --export <path>          Export execution log for mcpmock integration
  -i, --incremental        Skip existing golden files
  --fuzzy-match <fields>   Comma-separated field names to ignore during
                           comparison (e.g. createdAt,requestId); the built-in
                           timestamp / UUID / id rules always apply
  -e, --env <KEY=VALUE>    Environment variables (repeatable)
  -v, --verbose            Detailed logging
```

### `mcptest validate` — Validate Scenarios

```bash
mcptest validate --scenarios <path> [--verbose]
```

### `mcptest merge-logs` — Merge Execution Logs

```bash
mcptest merge-logs --old <path> --new <path> --output <path> [--verbose]
```

### `mcptest schema` — Show Schema and Examples

```bash
mcptest schema [--json] [--examples] [--ai-guide] [--copilot-prompt]
```

### `mcptest completion` — Shell Completion

```bash
eval "$(mcptest completion bash)"   # Bash — add to ~/.bashrc for persistence
```

### `mcptest agents` — Developer Reference

```bash
mcptest agents [--workflow] [--copilot] [--full]
```

## Scenario Format

Scenarios are YAML files:

```yaml
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
        expected: "expected text"
```

**Available assertion types**: `response-type`, `contains-text`, `error`, `error-code`, `array-length`, `array-length-max`, `golden-file`

> **Note**: MCP servers return TextContent (strings), not direct JSON. Use `response-type: "string"` for tool responses.

```bash
mcptest schema --examples   # See full examples
```

## Supported Transports

| Transport | URL pattern | Notes |
|---|---|---|
| Streamable HTTP | `http://...` or `https://...` | Modern MCP servers |
| Stdio | `stdio:///path/to/bin?args=...` | Local command-line servers |
| SSE | `sse://...` | Legacy, still supported |

## Troubleshooting

**Scenarios fail to validate**:
```bash
mcptest validate --scenarios scenarios/ --verbose
```

**Connection issues with stdio server**:
```bash
# Verify the server starts correctly
mcptest run --scenarios scenarios/ --server stdio:///path/to/server --verbose
```

**Golden file mismatches after expected changes**:
```bash
# Re-record only changed scenarios
mcptest record --scenarios scenarios/ --server http://localhost:8000 --golden golden/ --incremental
```

## Development

```bash
npm install           # Install dependencies
npm run build         # Build TypeScript
npm run watch         # Watch mode
npm test              # Run tests
npm run test:watch    # Watch mode for tests
npm run test:coverage # Coverage report
```

## Related Projects

- **[mcptoolkit-contract](https://github.com/cisco-open/mcptoolkit-contract)** — Extract mcpdesc files from MCP servers
- **[mcptoolkit-mock](https://github.com/cisco-open/mcptoolkit-mock)** — Mock server with recording/replay

## License

This software is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

