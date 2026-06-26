# Execution Logs Tutorial

## Overview

Execution logs are a critical feature in mcptest that enable:

1. **Test Result Tracking**: Record actual responses from MCP servers for regression testing
2. **Version Management**: Track test history across multiple mcpdesc versions
3. **Mock Data Generation**: Create realistic mock data for fast CI/CD (integration with mcpmock)
4. **Incremental Updates**: Re-record only changed tests when updating server versions

This tutorial walks through the complete execution log workflow using the `chess-coach` MCP server as an example.

## What You'll Learn

- How to record execution logs from live MCP servers
- How to use incremental recording to update tests efficiently
- How to merge execution logs from different versions
- Understanding the execution log format and metadata
- Best practices for version tracking and test maintenance

## Prerequisites

- mcptest v0.10.0 or later installed
- A working MCP server (we'll use chess-coach v0.7.0)
- Test scenarios generated from an mcpdesc file
- Basic understanding of MCP protocol

## Setup

### 1. Generate Test Scenarios

First, generate scenarios from your MCP server's mcpdesc file:

```bash
cd /path/to/mcptoolkit-test

# Generate scenarios from mcpdesc
mcptest generate \
  --mcpdesc ../chess-coach/mcpcontract/mcpdesc/v0.7.0.mcpdesc.json \
  --output tests/scenarios \
  --coverage basic
```

**Output**:
```
✓ Tools processed: 13
✓ Scenarios generated: 24
✓ Files created: 24
✓ Scenarios saved to: tests/scenarios
```

### 2. Prepare Test Directories

```bash
mkdir -p tests/execution-logs tests/golden
```

## Workflow 1: Initial Recording

Record execution logs from a live MCP server for the first time.

### Command

```bash
mcptest record \
  --scenarios tests/scenarios/list-openings-minimal-arguments.yaml \
  --server stdio:///path/to/venv/bin/python?args=-m,chess_coach.mcp_server.server \
  --golden tests/golden \
  --export tests/execution-logs/v0.7.0.json \
  --env DATABASE_PATH=/path/to/chess_coach.db \
  --verbose
```

### Parameters Explained

- `--scenarios`: Path to scenario file(s) to test
- `--server`: MCP server connection string (stdio transport with python path)
- `--golden`: Directory to save golden files (for regression testing)
- `--export`: Path to save execution log (JSON format)
- `--env`: Environment variables needed by the MCP server
- `--verbose`: Show detailed progress information

### Output

```
[MCPTEST] Recording golden files from scenarios: tests/scenarios/list-openings-minimal-arguments.yaml
[MCPTEST] Server: stdio:///path/to/venv/bin/python?args=-m,chess_coach.mcp_server.server
[MCPTEST] Golden directory: tests/golden
[MCPTEST] Export execution log: tests/execution-logs/v0.7.0.json
[MCPTEST] Loaded 1 scenario(s)
[MCPTEST] Connected to MCP server

Recording: list_openings - minimal arguments
[MCPTEST]   Calling tool: list_openings
  ✓ list_openings (new)

[MCPTEST] Writing execution log...
[MCPTEST] Writing execution log to tests/execution-logs/v0.7.0.json
[MCPTEST] Extracting metadata from ../chess-coach/mcpcontract/dumps/v0.7.0-dump.json
[MCPTEST] Validating execution log against schema
[MCPTEST] Writing 1 executions to file
[MCPTEST] ✓ Execution log written successfully
[MCPTEST]   Version: 1.0.0
[MCPTEST]   Dump Version: https://developer.cisco.com/mcp_contract_dump/schema/0.3.1
[MCPTEST]   Executions: 1
[MCPTEST]   Server: chess-coach v1.25.0

✓ Execution log exported to: tests/execution-logs/v0.7.0.json

Recording Summary
Recorded: 1

Golden files saved to: tests/golden
```

### What Was Created

1. **Golden File**: `tests/golden/list-openings-minimal-arguments.json`
   - Contains expected response for regression testing
   - Used to detect changes in server behavior

2. **Execution Log**: `tests/execution-logs/v0.7.0.json`
   - Complete test execution record
   - Includes version metadata, checksums, and server info
   - Can be used to generate mock data

### Execution Log Structure

```json
{
  "version": "1.0.0",
  "schema": "https://mcptest.dev/schema/execution-log/v1",
  "recordedAt": "2025-12-28T17:32:35.501Z",
  "metadata": {
    "mcptestVersion": "0.5.0",
    "dumpVersion": "https://developer.cisco.com/mcp_contract_dump/schema/0.3.1",
    "dumpFile": "../chess-coach/mcpcontract/dumps/v0.7.0-dump.json",
    "dumpChecksum": "sha256:279c448dae11694ed7f6fbdd065e65487e2d5410b41b96bd15bcbda531471529",
    "serverInfo": {
      "name": "chess-coach",
      "version": "1.25.0"
    },
    "serverUrl": "stdio:///.../venv/bin/python?args=-m,chess_coach.mcp_server.server",
    "transport": "stdio",
    "previousVersions": []
  },
  "executions": [
    {
      "scenarioName": "list_openings - minimal arguments",
      "toolName": "list_openings",
      "arguments": {},
      "response": {
        "success": true,
        "duration": 73,
        "result": "Opening Repertoire (20 openings)..."
      },
      "timestamp": "2025-12-28T17:32:35.308Z",
      "executionHash": "f1e6cba04897fcb256154d0d960f79e8d65b5c806ef5f3bb2e6d887ec996ad8a"
    }
  ]
}
```

**Key Fields**:
- `version`: Execution log format version (semver)
- `metadata.dumpChecksum`: SHA-256 of mcpdesc file for validation
- `metadata.previousVersions`: History of merged versions
- `executions[].executionHash`: SHA-256 of toolName + arguments (for deduplication)

## Workflow 2: Incremental Recording

Update execution logs when scenarios change or server updates.

### Use Cases

- Server updated to new version (v0.7.0 → v0.8.0)
- New scenarios added to test suite
- Scenario arguments modified for better coverage
- Re-run tests after fixing server bugs

### Command

```bash
# Record all scenarios with incremental mode
mcptest record \
  --scenarios tests/scenarios/ \
  --server stdio:///path/to/venv/bin/python?args=-m,chess_coach.mcp_server.server \
  --golden tests/golden \
  --export tests/execution-logs/v0.7.0.json \
  --incremental \
  --env DATABASE_PATH=/path/to/chess_coach.db
```

### What Happens

1. **Load Existing Log**: mcptest loads `v0.7.0.json` if it exists
2. **Hash Comparison**: Each scenario is hashed (toolName + arguments)
3. **Execution Decision**:
   - **Unchanged**: Preserved from existing log (no server call)
   - **Modified**: Re-recorded from server
   - **New**: Recorded from server
4. **Version Validation**: Warns if mcpdesc version/checksum mismatch

### Output

```
[MCPTEST] Loaded existing execution log for incremental recording
[MCPTEST] ✓ Execution log version matches current dump
[MCPTEST] Found 1 existing executions

Recording: analyze_opening - basic test
  ✓ analyze_opening (new)

Recording: analyze_opening - minimal arguments
  ✓ analyze_opening (new)

...

Recording: list_openings - minimal arguments
  ✓ list_openings (unchanged)

...

Recording Summary
Recorded: 23
  New:       23
  Modified:  0
  Unchanged: 1

Golden files saved to: tests/golden
```

### Benefits

- **Speed**: Skips unchanged tests (no server call needed)
- **Reliability**: Preserves known-good responses
- **Efficiency**: Only re-records what changed
- **Safety**: Validates mcpdesc version before recording

## Workflow 3: Merging Version Logs

Combine execution logs from different server versions.

### Use Case

Your server evolved from v0.7.0 to v0.8.0:
- Most tools unchanged (preserve v0.7.0 responses)
- Some tools modified (use v0.8.0 responses)
- Some tools removed (tracked but excluded)

### Step 1: Record New Version

```bash
# Record v0.8.0 execution log
mcptest record \
  --scenarios tests/scenarios/ \
  --server stdio:///path/to/venv/bin/python?args=-m,chess_coach.mcp_server.server \
  --golden tests/golden \
  --export tests/execution-logs/v0.8.0.json \
  --env DATABASE_PATH=/path/to/chess_coach.db
```

### Step 2: Merge Logs

```bash
mcptest merge-logs \
  --old tests/execution-logs/v0.7.0.json \
  --new tests/execution-logs/v0.8.0.json \
  --output tests/execution-logs/merged.json \
  --verbose
```

### Output

```
Merging Execution Logs

[MCPTEST] Loading old log: tests/execution-logs/v0.7.0.json
[MCPTEST] Old version: https://developer.cisco.com/mcp_contract_dump/schema/0.3.1
[MCPTEST] Loading new log: tests/execution-logs/v0.8.0.json
[MCPTEST] New version: https://developer.cisco.com/mcp_contract_dump/schema/0.3.1
[MCPTEST] ✓ New execution log version matches current dump

Merging execution logs...
[MCPTEST] Building hash maps for merge...
[MCPTEST] Old log: 24 executions
[MCPTEST] New log: 1 executions
[MCPTEST] Preserved: 1
[MCPTEST] Added: 0
[MCPTEST] Removed: 23
[MCPTEST] Validating merged log...
[MCPTEST] Writing merged log to: tests/execution-logs/merged.json

Merge Summary
Preserved:  1 (unchanged from old)
Added:      0 (new in current version)
Total:      1 executions

Removed:    23 executions (tools no longer present)
Tools:      analyze_opening, detect_opening_themes, detect_themes, ...
Note:       Removed executions are not included in merged log

Version History
  - https://developer.cisco.com/mcp_contract_dump/schema/0.3.1 (24 executions) - recorded 12/28/2025
  - https://developer.cisco.com/mcp_contract_dump/schema/0.3.1 (current)

✓ Merged log saved to: tests/execution-logs/merged.json
```

### Merge Logic

1. **Preserved**: Tools present in both versions (hash matches)
2. **Added**: Tools only in new version
3. **Removed**: Tools only in old version (not included in output)
4. **Version History**: Tracks all previous versions merged

### Version History in Merged Log

```json
{
  "metadata": {
    "previousVersions": [
      {
        "dumpVersion": "https://developer.cisco.com/mcp_contract_dump/schema/0.3.1",
        "recordedAt": "2025-12-28T17:33:49.658Z",
        "executionCount": 24
      }
    ]
  }
}
```

## Version Validation

mcptest automatically validates execution logs against current mcpdesc files.

### Automatic Validation

During incremental recording or merging:

```
[MCPTEST] ✓ Execution log version matches current dump
```

### Version Mismatch Warning

If mcpdesc file changed:

```
⚠️  Version Mismatch

Execution log was recorded from a different version:

Log Version:
  - Version:  https://developer.cisco.com/mcp_contract_dump/schema/0.3.0
  - Checksum: sha256:abc123...
  - Recorded: 12/20/2025

Current mcpdesc:
  - Version:  https://developer.cisco.com/mcp_contract_dump/schema/0.3.1
  - Checksum: sha256:def456...

Recommendation:
  - Re-record execution log with current mcpdesc version
  - Or use merge-logs to combine old and new versions
```

### What To Do

1. **Re-record**: Use `--incremental` to update changed tests
2. **Merge**: Use `merge-logs` to combine versions
3. **Accept**: Continue with warning (if intentional)

## Best Practices

### 1. Organize by Version

```
tests/execution-logs/
├── v0.7.0.json          # Initial version
├── v0.7.1.json          # Patch update
├── v0.8.0.json          # Minor version
└── merged-v0.8.0.json   # Combined history
```

### 2. Use Incremental Recording

Always use `--incremental` when updating tests:
- Faster execution (skips unchanged)
- Preserves known-good responses
- Clear diff of what changed

### 3. Commit Execution Logs

Version control your execution logs:
- Track test history over time
- Review changes in PRs
- Reproducible test results

### 4. Validate Before Merging

Check version compatibility before merge:
```bash
mcptest merge-logs --old v1.json --new v2.json --output merged.json --verbose
```

### 5. Clean Up Removed Tools

Removed tools are tracked but not included in merged log:
- Review "Removed" section in merge output
- Update scenarios to remove obsolete tests
- Archive old execution logs if needed

## Integration with mcpmock

Execution logs enable fast mock-based testing:

1. **Record**: Generate execution log from live server (`mcptest record --export`)
2. **Import**: Convert to mcpmock JSONL format (`mcpmock import --execution-log`)
3. **Mock**: Run tests against mock server (3-5s vs 30-60s)
4. **CI/CD**: Fast, reliable tests without live server

**Command**:
```bash
# Export from mcptest
mcptest record \
  --scenarios tests/scenarios/ \
  --server http://localhost:8000 \
  --golden tests/golden/ \
  --export tests/execution-logs/v0.7.0.json

# Import to mcpmock
mcpmock import \
  --execution-log tests/execution-logs/v0.7.0.json \
  --output tests/mock-data/chess-coach.jsonl
```

## Troubleshooting

### Issue: Schema Validation Errors

**Symptom**:
```
Failed to load execution log schema: unknown format "date-time" ignored
```

**Solution**: Update to mcptest v0.10.0+ (format validation fixed)

### Issue: Checksum Mismatch

**Symptom**:
```
⚠️  Version Mismatch
Log Checksum: sha256:abc123...
mcpdesc Checksum: sha256:def456...
```

**Cause**: mcpdesc file was modified after recording

**Solution**:
1. Re-generate scenarios from updated mcpdesc
2. Re-record execution log with `--incremental`

### Issue: Merge Removes Too Many Tools

**Symptom**:
```
Removed: 23 executions (tools no longer present)
```

**Cause**: New mcpdesc has fewer tools (API changes)

**Solution**:
1. Review removed tools list
2. Update scenarios to match new API
3. Archive old execution logs for history

## Summary

Execution logs provide:
- **Traceability**: Complete test history with version metadata
- **Efficiency**: Incremental updates skip unchanged tests
- **Flexibility**: Merge logs from multiple versions
- **Integration**: Export to mcpmock for fast CI/CD

### Next Steps

1. Record execution logs for your MCP server
2. Use incremental recording to maintain test suite
3. Merge logs when server versions change
4. Prepare for mcpmock integration (Phase 5)

### Related Documentation

- [Dump-to-Tests Workflow](dump-to-tests-workflow.md)
- [Scenario Generation Strategy](SCENARIO_GENERATION_STRATEGY.md)
- [Mock Integration Design](maintainers/mock-integration-design.md)
- [Execution Log Schema](../schemas/execution-log-schema.json)

## Feedback

Found an issue or have suggestions? Please report:
- GitHub Issues: [mcptoolkit-test/issues](https://github.com/cisco-open/mcptoolkit-test/issues)
- Design Docs: `docs/maintainers/`
