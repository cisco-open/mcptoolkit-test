# Mock Integration Scenario - Complete Workflow

## Goal: Fast CI/CD Testing with Mock Servers

**Problem**: Running tests against live MCP server is slow (30-60s), requires database, network dependencies.

**Solution**: Record test execution once, replay with mock server (3-5s), no dependencies.

---

## Complete Workflow

### Phase 1: Initial Setup (One-Time, ~30 minutes)

#### Step 1: Extract Server Contract
```bash
# Input: Live MCP server
# Output: Contract file (capabilities, tools, schemas)

mcpcontract dump \
  --config .mcp-config.json \
  --output dumps/chess-coach-v0.4.0.dump.json
```

**Produces**: `dumps/chess-coach-v0.4.0.dump.json`
```json
{
  "version": "https://...",
  "serverInfo": { "name": "chess-coach", "version": "0.4.0" },
  "tools": [
    {
      "name": "query_games",
      "description": "...",
      "inputSchema": { "type": "object", "properties": {...} }
    }
  ]
}
```

---

#### Step 2: Generate Test Scenarios
```bash
# Input: Contract dump
# Output: YAML test scenarios

mcptest generate \
  --dump dumps/chess-coach-v0.4.0.dump.json \
  --output scenarios/ \
  --coverage full
```

**Produces**: `scenarios/query-games-basic.yaml`, `scenarios/query-games-filter-by-results.yaml`, etc.
```yaml
name: "query_games - basic test"
description: "Verify query_games returns results"
tools:
  - name: "query_games"
    arguments:
      limit: 10
    assertions:
      - type: "response-type"
        expected: "string"
```

---

#### Step 3: Record Test Execution Against Live Server
```bash
# Input: Scenarios + live server
# Output: Golden files (regression) + execution log (for mock)

mcptest record \
  --scenarios scenarios/ \
  --server http://localhost:8000 \
  --golden golden/ \
  --export execution-log.json
```

**Question**: What should `execution-log.json` contain?

**Option A: Test Execution Log (Proposed)**
```json
{
  "version": "1.0.0",
  "schema": "https://mcptest.dev/schema/execution-log/v1",
  "recordedAt": "2025-12-25T12:00:00Z",
  "metadata": {
    "mcptestVersion": "0.6.0",
    "serverInfo": {
      "name": "chess-coach",
      "version": "0.4.0"
    },
    "serverUrl": "http://localhost:8000",
    "transport": "streamable-http",
    "dumpVersion": "0.4.0",
    "dumpFile": "dumps/chess-coach-v0.4.0.dump.json",
    "dumpChecksum": "sha256:abc123..."
  },
  "executions": [
    {
      "scenarioName": "query_games - basic test",
      "toolName": "query_games",
      "arguments": {
        "limit": 10
      },
      "response": {
        "success": true,
        "result": [
          {
            "type": "text",
            "text": "Found 10 games:\n1. Game #123..."
          }
        ],
        "duration": 145
      },
      "timestamp": "2025-12-25T12:00:01.234Z"
    },
    {
      "scenarioName": "query_games - filter by results",
      "toolName": "query_games",
      "arguments": {
        "limit": 5,
        "result": "win"
      },
      "response": {
        "success": true,
        "result": [
          {
            "type": "text",
            "text": "Found 5 wins..."
          }
        ],
        "duration": 98
      },
      "timestamp": "2025-12-25T12:00:02.567Z"
    }
  ]
}
```

**What's included**:
- Test execution metadata (when, what version, which server)
- Each scenario executed (name, tool, arguments)
- Actual responses from server (success/error, result data, timing)
- Timestamps for audit trail

**What's NOT included**:
- Raw MCP protocol messages (initialize, tools/list, etc.)
- Low-level transport details
- Assertion results (pass/fail)

**Purpose**: Provide data for mock generation, not test results

**Also Produces**: `golden/query-games-basic__query_games.golden.json` (separate, for regression)

---

#### Step 4: Generate Mock Data from Execution Log
```bash
# Input: Test execution log (mcptest format)
# Output: Mock data (mcpmock format)

mcpmock import \
  --from-mcptest execution-log.json \
  --output mock-data.jsonl
```

**Produces**: `mock-data.jsonl` (mcpmock's internal format)
```jsonl
{"method":"tools/call","params":{"name":"query_games","arguments":{"limit":10}},"result":{"content":[{"type":"text","text":"Found 10 games:\n1. Game #123..."}]}}
{"method":"tools/call","params":{"name":"query_games","arguments":{"limit":5,"result":"win"}},"result":{"content":[{"type":"text","text":"Found 5 wins..."}]}}
```

**Transformation**:
- mcptest execution log → mcpmock JSONL format
- Maps test scenarios to MCP protocol messages
- Handles MCP-specific structure (tools/call, result format)

---

### Phase 2: Fast CI/CD Testing (~5 seconds)

#### Step 5: Run Tests with Mock Server
```bash
# Start mock server (background)
mcpmock run --replay mock-data.jsonl --port 8001 &

# Run tests against mock (fast)
mcptest run \
  --scenarios scenarios/ \
  --server http://localhost:8001 \
  --golden golden/

# Exit code: 0 = pass, 1 = regression detected
```

**Benefits**:
- ✅ Fast: 3-5 seconds vs 30-60 seconds
- ✅ No database required
- ✅ No network dependencies
- ✅ Deterministic responses
- ✅ Perfect for CI/CD pipelines

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Initial Setup (One-Time, ~30 min)                      │
└─────────────────────────────────────────────────────────────────┘

mcpcontract dump
    │
    ├─→ dumps/contract.json
    │
    v
mcptest generate
    │
    ├─→ scenarios/*.yaml
    │
    v
mcptest record (live server)
    │
    ├─→ golden/*.golden.json (regression baselines)
    ├─→ execution-log.json (test execution data)
    │
    v
mcpmock import
    │
    └─→ mock-data.jsonl (mcpmock format)


┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Fast CI/CD Testing (~5 seconds)                        │
└─────────────────────────────────────────────────────────────────┘

mcpmock run --replay mock-data.jsonl
    │
    └─→ Mock MCP server (http://localhost:8001)
         │
         v
mcptest run --server localhost:8001 --golden golden/
    │
    └─→ Exit code: 0 = pass, 1 = fail
```

---

## Key Questions to Answer

### 1. What should `execution-log.json` contain?

**Current Proposal (Test-Centric)**:
- Scenario name + tool name
- Arguments used in test
- Response received from server
- Timing metadata

**Alternative (Protocol-Centric)**:
- Raw MCP messages (initialize, tools/list, tools/call)
- Full protocol conversation
- Lower-level transport details

**Decision**: ?

### 2. Should mcptest and mcpmock be completely independent?

**Yes**:
- mcpmock has `import` command for mcptest exports
- mcptest doesn't know about mcpmock's JSONL format
- Clean separation of concerns

**Advantage**: Tools can evolve independently

### 3. What's the minimal export schema?

**Required fields**:
- Tool name
- Arguments
- Response (success/error + result)

**Optional fields**:
- Scenario name (for debugging)
- Timestamp (for audit)
- Duration (for performance tracking)
- Server metadata (for documentation)

**Decision**: ?

### 4. Should golden files and execution log be separate?

**Current Design**: Yes, separate
- Golden files: Regression detection (one per scenario)
- Execution log: Mock generation (all executions in one file)

**Alternative**: Combine into one export
- Pro: Single file to manage
- Con: Mixed concerns (testing vs mocking)

**Decision**: ?

### 5. **Version Tracking and Consistency** ⚠️ CRITICAL

**Problem**: Execution logs are tied to specific dump versions
- Server capabilities change between versions
- Tool schemas evolve (new parameters, removed fields)
- Running old mock data against new scenarios = errors

**Solution**: Track dump version in execution log
```json
{
  "metadata": {
    "dumpVersion": "0.4.0",
    "dumpFile": "dumps/chess-coach-v0.4.0.dump.json",
    "dumpChecksum": "sha256:abc123..."
  }
}
```

**Validation**:
- mcptest warns if dump version mismatch
- mcpmock validates execution log against current scenarios
- Clear error messages when versions don't align

---

## Recommended Architecture

### mcptest responsibilities:
1. Generate test scenarios from contracts
2. Execute tests against MCP servers (live or mock)
3. Record golden files (regression baselines)
4. **Export execution log** (for mock generation)
5. Compare results against golden files

### mcpmock responsibilities:
1. **Import** execution logs from mcptest
2. Transform to internal JSONL format
3. Serve mock MCP server
4. Replay recorded responses

### Independence:
- mcptest doesn't know about mcpmock's JSONL format
- mcpmock reads mcptest's execution log via `import` command
- Both tools have clear, documented schemas
- Tools can evolve independently

---

---

## Version Upgrade Workflow

### Scenario: Server Upgrade (v0.4.0 → v0.5.0)

**What Changed**:
- New tool added: `analyze_opening`
- Existing tool modified: `query_games` added `opening` parameter
- Tool removed: `deprecated_tool`

#### Step 1: Extract New Dump
```bash
mcpcontract dump \
  --config .mcp-config.json \
  --output dumps/chess-coach-v0.5.0.dump.json
```

#### Step 2: Generate New Scenarios (Incremental)
```bash
# Option A: Full regeneration
mcptest generate \
  --dump dumps/chess-coach-v0.5.0.dump.json \
  --output scenarios/ \
  --coverage full

# Option B: Merge mode (preserve manual tests)
mcptest generate \
  --dump dumps/chess-coach-v0.5.0.dump.json \
  --output scenarios/ \
  --coverage full \
  --merge
```

**Result**:
- ✅ New scenarios: `analyze-opening-*.yaml` (3 new files)
- ✅ Updated scenarios: `query-games-*.yaml` (updated with new parameter)
- ⚠️ Stale scenarios: `deprecated-tool-*.yaml` (warning: tool removed)

#### Step 3: Record New Execution Data (Incremental)
```bash
# Incremental recording (only new/modified scenarios)
mcptest record \
  --scenarios scenarios/ \
  --server http://localhost:8000 \
  --golden golden/ \
  --export execution-log-v0.5.0.json \
  --incremental
```

**Behavior**:
- ✅ Records new tool: `analyze_opening`
- ✅ Re-records modified tool: `query_games` with new parameter
- ⚠️ Skips unchanged tools (uses existing data)
- ❌ Warns about removed tool: `deprecated_tool`

#### Step 4: Merge Execution Logs
```bash
# Option A: Manual merge (preserve old data)
mcptest merge-logs \
  --old execution-log-v0.4.0.json \
  --new execution-log-v0.5.0.json \
  --output execution-log-merged.json

# Option B: Replace entirely (fresh start)
mv execution-log-v0.5.0.json execution-log.json
```

**Merge Strategy**:
- Keep old tool data (if tool still exists)
- Add new tool data
- Update modified tool data
- Remove deprecated tool data (with warning)

#### Step 5: Update Mock Data
```bash
# Reimport merged execution log
mcpmock import \
  --from-mcptest execution-log-merged.json \
  --output mock-data.jsonl
```

**Result**: Updated mock with v0.5.0 capabilities

---

## Version Mismatch Detection

### Scenario: Using Old Mock with New Scenarios

```bash
# Execution log from v0.4.0
execution-log.json:
  "metadata": { "dumpVersion": "0.4.0" }

# Scenarios from v0.5.0
scenarios/analyze-opening-basic.yaml  # Tool doesn't exist in v0.4.0 log!

# Run tests with mock
mcptest run \
  --scenarios scenarios/ \
  --server http://localhost:8001 \
  --golden golden/
```

**Expected Behavior**:
```
❌ Error: Version mismatch detected
   Execution log version: 0.4.0
   Dump version: 0.5.0
   
   Missing tools in execution log:
   - analyze_opening (added in 0.5.0)
   
   Recommendation:
   Run incremental recording to update execution log:
   mcptest record --scenarios scenarios/ --server <url> --export execution-log.json --incremental
```

### Validation Points

**mcptest record --export**:
- Embed dump version in execution log
- Include dump checksum for validation
- Record which scenarios were executed

**mcptest run --mock**:
- Check dump version in execution log
- Warn if scenarios reference tools not in log
- Suggest incremental recording if mismatch

**mcpmock import**:
- Validate execution log schema
- Warn about version mismatches
- Provide clear error messages

---

## Incremental Recording Strategy

### Goal: Add New Test Data Without Re-Running Everything

```bash
# Initial recording (v0.4.0, 17 scenarios)
mcptest record \
  --scenarios scenarios/ \
  --server http://localhost:8000 \
  --export execution-log.json

# After upgrade (v0.5.0, 3 new scenarios + 2 modified)
mcptest record \
  --scenarios scenarios/ \
  --server http://localhost:8000 \
  --export execution-log.json \
  --incremental
```

**Incremental Logic**:
1. Load existing `execution-log.json`
2. Compare scenarios to existing executions:
   - **New scenario**: Record it
   - **Modified scenario**: Check if tool schema changed → re-record
   - **Unchanged scenario**: Skip (use existing data)
3. Merge results into execution log
4. Preserve old executions (for historical data)

**Detection of Changes**:
- Tool name + arguments hash → unique execution ID
- Compare against existing executions
- If hash matches, skip recording
- If hash differs, re-record

**Example**:
```bash
# Incremental recording output
[MCPTEST] Loading existing execution log...
[MCPTEST] Found 17 existing executions (v0.4.0)
[MCPTEST] 
[MCPTEST] Analyzing scenarios...
[MCPTEST] ✓ Unchanged: 12 scenarios (skipping)
[MCPTEST] ⟳ Modified: 2 scenarios (re-recording)
[MCPTEST] + New: 3 scenarios (recording)
[MCPTEST] 
[MCPTEST] Recording 5 scenarios against http://localhost:8000...
[MCPTEST] ✓ analyze_opening - basic (new)
[MCPTEST] ✓ analyze_opening - common openings (new)
[MCPTEST] ✓ analyze_opening - invalid opening (new)
[MCPTEST] ✓ query_games - filter by opening (modified)
[MCPTEST] ✓ query_games - opening with result filter (modified)
[MCPTEST] 
[MCPTEST] Summary:
[MCPTEST]   Recorded: 5
[MCPTEST]   Preserved: 12
[MCPTEST]   Total executions: 17
[MCPTEST] 
[MCPTEST] ✓ Execution log updated: execution-log.json
[MCPTEST]   Version: 0.5.0
[MCPTEST]   Dump: dumps/chess-coach-v0.5.0.dump.json
```

---

## Execution Log Versioning

### File Naming Convention
```bash
# Option A: Version in filename
execution-logs/
  chess-coach-v0.4.0.json
  chess-coach-v0.5.0.json
  chess-coach-v0.6.0.json

# Option B: Single file, version in metadata
execution-log.json  # Contains version field
```

### Metadata Structure
```json
{
  "version": "1.0.0",
  "schema": "https://mcptest.dev/schema/execution-log/v1",
  "recordedAt": "2025-12-25T12:00:00Z",
  "metadata": {
    "mcptestVersion": "0.6.0",
    "dumpVersion": "0.5.0",
    "dumpFile": "dumps/chess-coach-v0.5.0.dump.json",
    "dumpChecksum": "sha256:abc123...",
    "serverInfo": {
      "name": "chess-coach",
      "version": "0.5.0"
    },
    "previousVersions": [
      {
        "dumpVersion": "0.4.0",
        "recordedAt": "2025-12-20T10:00:00Z",
        "executionCount": 17
      }
    ]
  },
  "executions": [...]
}
```

### Version History Tracking
- Track all previous dump versions
- Record when each version was recorded
- Enable rollback to previous version if needed
- Audit trail for test data

---

## Mock Data Upgrade Workflow

### Scenario: Update Mock from v0.4.0 to v0.5.0

```bash
# Step 1: Incremental recording
mcptest record \
  --scenarios scenarios/ \
  --server http://localhost:8000 \
  --export execution-log.json \
  --incremental

# Step 2: Reimport to mcpmock (replaces old mock data)
mcpmock import \
  --from-mcptest execution-log.json \
  --output mock-data-v0.5.0.jsonl

# Step 3: Validate mock data
mcpmock validate \
  --mock mock-data-v0.5.0.jsonl \
  --dump dumps/chess-coach-v0.5.0.dump.json

# Step 4: Test with updated mock
mcpmock run --replay mock-data-v0.5.0.jsonl --port 8001 &
mcptest run --scenarios scenarios/ --server http://localhost:8001 --golden golden/
```

### Mock Data Versioning
```bash
# Keep historical mock data
mock-data/
  chess-coach-v0.4.0.jsonl
  chess-coach-v0.5.0.jsonl
  chess-coach-v0.6.0.jsonl
```

**Benefit**: Rollback capability for testing

---

## Next Steps

1. **Define execution-log.json schema** (with version tracking)
2. **Implement version validation** in mcptest record/run
3. **Implement incremental recording** (--incremental flag)
4. **Implement log merging** (mcptest merge-logs command?)
5. **Implement `mcpmock import --from-mcptest`** (transform to JSONL)
6. **Implement `mcpmock validate`** (check mock against dump)
7. **Test end-to-end** with chess-coach v0.4.0 → v0.5.0 upgrade
8. **Document schemas** in both repos

---

## Open Questions

1. Should execution log include all MCP protocol details or just tool calls?
2. Should we version the execution log schema separately? **YES - critical for compatibility**
3. Should mcpmock validate the execution log schema? **YES - prevent version mismatches**
4. Should execution log be JSONL (streaming) or JSON (complete)? **JSON - easier validation**
5. Should we support incremental recording (append to existing log)? **YES - essential for upgrades**
6. **NEW**: Should mcptest have `merge-logs` command or auto-merge on `--incremental`?
7. **NEW**: Should we keep historical execution logs or single versioned file?
8. **NEW**: How to handle removed tools in execution log (preserve for rollback or delete)?
