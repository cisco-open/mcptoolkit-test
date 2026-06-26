# Tutorial: Testing the Chess Coach MCP Server

This tutorial walks through testing [chess-coach](https://github.com/cisco-open/chess-coach), a sample MCP server with 8 tools. It demonstrates the full mcptest workflow: AI-assisted scenario generation, validation, and test execution.

## Prerequisites

- `mcptest` installed (`npm install -g @cisco_open/mcptoolkit-test`)
- `mcpcontract` installed (`npm install -g @cisco_open/mcptoolkit-contract`)
- chess-coach server running locally

## Step 1: Extract the Server Description

Use `mcpcontract` to dump the server's capabilities into an mcpdesc file:

```bash
mcpcontract dump \
  --server stdio:///usr/bin/python?args=-m,chess_coach.mcp_server \
  --env CHESS_COACH_DB=/path/to/chess_coach.db \
  --output chess-coach.mcpdesc.json
```

## Step 2: Auto-Generate Test Scenarios

### Option A: AI-Assisted with GitHub Copilot

Generate a ready-to-paste Copilot prompt:

```bash
cd chess-coach
mcptest schema --copilot-prompt
```

Copy the output and paste it into GitHub Copilot chat. Copilot will:
- Read the mcpdesc file
- Generate realistic test scenarios for all 8 tools
- Use correct YAML format with proper assertions
- Create both success and error test cases

Example generated scenario (`tests/mcp/query-games-basic.yaml`):

```yaml
name: "query_games - basic test"
description: "Verify query_games returns game data"
tools:
  - name: "query_games"
    arguments:
      limit: 10
    assertions:
      - type: "response-type"
        expected: "string"
      - type: "contains-text"
        expected: "games"
```

### Option B: Automated Generation

Let mcptest generate scenarios directly from the mcpdesc file:

```bash
mcptest generate \
  --mcpdesc chess-coach.mcpdesc.json \
  --output tests/mcp/ \
  --coverage full
```

## Step 3: Validate Scenarios

Before running tests, validate the YAML structure:

```bash
mcptest validate --scenarios tests/mcp/
```

Expected output:
```
Validation Results

✓ query-games-basic.yaml
✓ detect-themes-basic.yaml
✓ get-statistics-basic.yaml
...

Summary
Valid:   8/8
Invalid: 0/8

All scenarios are valid!
```

## Step 4: Run Tests

Execute scenarios against the chess-coach server:

```bash
mcptest run \
  --scenarios tests/mcp/ \
  --server stdio:///usr/bin/python?args=-m,chess_coach.mcp_server \
  --env CHESS_COACH_DB=/path/to/chess_coach.db
```

Expected output:
```
Test Results: 8/8 passed (100%)

✓ query_games - basic test (9ms)
✓ query_games - with filters (7ms)
✓ detect_themes - basic test (647ms)
✓ analyze_opening - basic test (312ms)
✓ get_statistics - basic test (88ms)
...
```

**Result**: 8 tools tested with 24 scenarios in under 5 seconds!

## Step 5: Record Golden Files (Regression Detection)

Capture baseline responses for future regression testing:

```bash
mcptest record \
  --scenarios tests/mcp/ \
  --server stdio:///usr/bin/python?args=-m,chess_coach.mcp_server \
  --env CHESS_COACH_DB=/path/to/chess_coach.db \
  --golden golden/
```

This creates golden files like `query_games__basic-test.golden.json`. On future runs:

```bash
mcptest run \
  --scenarios tests/mcp/ \
  --server stdio:///usr/bin/python?args=-m,chess_coach.mcp_server \
  --env CHESS_COACH_DB=/path/to/chess_coach.db \
  --golden golden/
```

Tests fail automatically if responses change unexpectedly.

## Step 6: Export for Mock Integration

Export an execution log to generate fast mock data with `mcpmock`:

```bash
mcptest record \
  --scenarios tests/mcp/ \
  --server stdio:///usr/bin/python?args=-m,chess_coach.mcp_server \
  --env CHESS_COACH_DB=/path/to/chess_coach.db \
  --golden golden/ \
  --export execution-logs/chess-coach.json
```

Then import into mcpmock for 3-5 second CI/CD tests (vs 30-60 seconds live):

```bash
mcpmock import execution-logs/chess-coach.json traffic.jsonl
mcpmock run chess-coach.mcpdesc.json --replay traffic.jsonl
```

## Related

- [Execution Logs Workflow](execution-logs-workflow.md) — Full mock integration guide
- [Scenario Generation Strategy](tests-generation-strategy-guide.md) — AI vs automated generation
- [mcptoolkit-mock](https://github.com/cisco-open/mcptoolkit-mock) — Mock server with replay
