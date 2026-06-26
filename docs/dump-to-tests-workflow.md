# mcpdesc-to-Tests Workflow: Zero Manual Test Writing

**Goal**: Automatically generate comprehensive tests from your MCP server's mcpdesc file, eliminating manual test authoring.

**Time Required**: 15-30 minutes for initial setup, < 5 minutes for subsequent releases

**Prerequisites**:
- MCP server implemented and running (e.g., chess-coach)
- `mcpcontract` installed (`npm install -g @devnet/mcpcontract`)
- `mcptest` installed (`npm install -g @devnet/mcptest`)
- `mcpmock` installed for CI/CD (`npm install -g @devnet/mcpmock`)

---

## The Value Proposition

**Traditional Approach** 😰:
```
Implement Server → Write Tests Manually → Maintain Tests → Debug Test Code → Update Tests for Every Change
```
**Time**: Days/weeks of test development, ongoing maintenance burden

**mcptest Approach** ✨:
```
Implement Server → Extract mcpdesc → Auto-Generate Tests → Record Golden Files → Fast Regression Testing
```
**Time**: Minutes for initial setup, zero maintenance for standard changes

---

## Chess-Coach Workflow: 30 Minutes → 5 Minutes

### Initial Setup (30 min, one-time)

```bash
# 1. Extract contract dump and convert to mcpdesc (2 min)
mcpcontract dump --config .mcp-config.json --output v0.4.0.dump.json
mcpcontract convert --dump v0.4.0.dump.json --output v0.4.0.mcpdesc.json

# 2. Auto-generate test scenarios (1 min)
mcptest generate --mcpdesc v0.4.0.mcpdesc.json --output scenarios/ --coverage full
# ✅ Result: 27 scenarios auto-generated (8 basic + 12 parameterized + 7 edge cases)

# 3. Record golden files + mock data (5 min)
mcptest record --scenarios scenarios/ --server http://localhost:8000 --golden golden/
# ✅ Result: 27 golden files created

# 4. Initial test run (2 min)
mcptest run --scenarios scenarios/ --server http://localhost:8000 --golden golden/ --verbose
# ✅ Result: 27/27 tests passed
```

**Total**: 30 minutes for complete test suite with zero manual YAML writing

### Subsequent Releases (5 min)

```bash
# 1. Extract new contract (1 min)
mcpcontract dump --output v0.5.0.dump.json
mcpcontract convert --dump v0.5.0.dump.json --output v0.5.0.mcpdesc.json

# 2. Check for breaking changes (30s)
mcpcontract breaking --old v0.4.0.dump.json --new v0.5.0.dump.json --suggest-version
# ✅ Result: No breaking changes, suggested MINOR version

# 3. Re-generate scenarios (1 min)
mcptest generate --mcpdesc v0.5.0.mcpdesc.json --output scenarios/ --merge
# ✅ Result: Added 3 new scenarios, updated 2 existing

# 4. Re-record changed tools (2 min)
mcptest record --scenarios scenarios/ --golden golden/ --incremental
# ✅ Result: 5 new/changed golden files, 22 preserved

# 5. Run regression tests (30s)
mcptest run --scenarios scenarios/ --server http://localhost:8000 --golden golden/ --verbose
# ✅ Result: 30/30 tests passed (3 new, 27 existing)
```

**Total**: 5 minutes for complete regression testing of new release

### Value Summary

- **Zero manual test writing** - All scenarios auto-generated from contract
- **Automatic coverage** - 100% of tools tested with full parameter combinations
- **Fast CI/CD** - 3-5s mock tests vs 30-60s with live server
- **Minimal maintenance** - Automatic regeneration on contract changes
- **Version tracking** - Golden files capture expected behavior per version

---

## Complete Workflow

### Phase 1: Implement Your MCP Server (One-Time)

**Example**: chess-coach MCP server with 8 tools

```python
# chess_coach/mcp_server/server.py
class ChessCoachMCPServer:
    """MCP server for chess training."""
    
    @mcp.tool()
    async def query_games(
        self,
        player_color: Optional[str] = None,
        time_control: Optional[str] = None,
        opening_name: Optional[str] = None,
        min_rating_diff: Optional[int] = None,
        limit: int = 50
    ) -> List[GameSummary]:
        """Query games with flexible filtering."""
        # Implementation...
    
    @mcp.tool()
    async def detect_themes(
        self,
        time_control: Optional[str] = None,
        min_occurrences: int = 3
    ) -> List[ThemePattern]:
        """Detect recurring tactical/positional patterns."""
        # Implementation...
    
    # ... 6 more tools
```

**Focus**: Just implement the server. Don't worry about tests yet.

---

### Phase 2: Extract mcpdesc (One-Time per Version)

Use `mcpcontract` to extract your server's capabilities and convert to mcpdesc:

```bash
# Navigate to your server directory
cd ~/repos/chess-coach

# Create MCP config (if not already present)
cat > .mcp-config.json << 'EOF'
{
  "mcpServers": {
    "chess-coach": {
      "command": "uv",
      "args": [
        "--directory",
        "/home/daggit/repos/chess-coach",
        "run",
        "chess-coach-mcp"
      ],
      "env": {
        "CHESS_COACH_DB": "/home/daggit/repos/chess-coach/data/chess_coach.db"
      }
    }
  }
}
EOF

# Extract dump and convert to mcpdesc
mcpcontract dump \
  --config .mcp-config.json \
  --server chess-coach \
  --output dumps/chess-coach-v0.4.0.dump.json \
  --format json \
  --pretty

mcpcontract convert \
  --dump dumps/chess-coach-v0.4.0.dump.json \
  --output mcpdesc/chess-coach-v0.4.0.mcpdesc.json

# ✅ Result: Complete contract captured in mcpdesc format
```

**What's in the mcpdesc**:
```json
{
  "version": "https://developer.cisco.com/mcp_contract_dump/schema/0.3.1",
  "toolName": "mcpcontract",
  "toolVersion": "0.14.3",
  "serverInfo": {
    "name": "chess-coach",
    "version": "0.4.0"
  },
  "tools": [
    {
      "name": "query_games",
      "description": "Query games with flexible filtering",
      "inputSchema": {
        "type": "object",
        "properties": {
          "player_color": { "type": "string", "enum": ["white", "black"] },
          "time_control": { "type": "string" },
          "opening_name": { "type": "string" },
          "min_rating_diff": { "type": "integer" },
          "limit": { "type": "integer", "default": 50 }
        }
      }
    },
    {
      "name": "detect_themes",
      "description": "Detect recurring tactical/positional patterns",
      "inputSchema": {
        "type": "object",
        "properties": {
          "time_control": { "type": "string" },
          "min_occurrences": { "type": "integer", "default": 3 }
        }
      }
    }
    // ... 6 more tools
  ]
}
```

**Frequency**: Once per version when mcpdesc changes

---

### Phase 3: Auto-Generate Test Scenarios (One Command)

Let `mcptest` analyze the mcpdesc and generate comprehensive test scenarios:

```bash
# Navigate to test directory
cd ~/repos/mcptoolkit-test

# Auto-generate scenarios with different coverage levels
mcptest generate \
  --mcpdesc ../chess-coach/mcpdesc/chess-coach-v0.4.0.mcpdesc.json \
  --output scenarios/chess-coach/ \
  --coverage full \
  --edge-cases \
  --verbose

# ✅ Result: 20-30 YAML scenarios auto-generated
```

**Coverage Levels**:
- `basic` (5-10 scenarios): Happy path only, one test per tool
- `standard` (10-20 scenarios): Happy path + common errors
- `full` (20-30 scenarios): All parameters, edge cases, error conditions

**What Gets Generated**:

```yaml
# scenarios/chess-coach/query-games-basic.yaml
name: "query_games - basic query all games"
description: "Verify query_games returns games without filters"
tools:
  - name: "query_games"
    arguments: {}
    assertions:
      - type: "response-type"
        expected: "array"
      - type: "response-schema"
        schema:
          type: "array"
          items:
            type: "object"
            required: ["id", "date", "playerColor", "result"]
```

```yaml
# scenarios/chess-coach/query-games-filtered.yaml
name: "query_games - filter by player color"
description: "Verify filtering by player_color=white"
tools:
  - name: "query_games"
    arguments:
      player_color: "white"
      limit: 10
    assertions:
      - type: "response-type"
        expected: "array"
      - type: "array-length-max"
        expected: 10
      - type: "custom"
        expression: "result.every(g => g.playerColor === 'white')"
```

```yaml
# scenarios/chess-coach/query-games-edge-cases.yaml
name: "query_games - edge case invalid color"
description: "Verify error handling for invalid player_color"
tools:
  - name: "query_games"
    arguments:
      player_color: "purple"  # Invalid
    assertions:
      - type: "error"
        expected: true
      - type: "error-code"
        expected: "InvalidParams"
```

**Result**: Complete test suite without writing a single assertion manually

---

### Phase 4: Record Golden Files (One-Time per Version)

Capture real server responses as regression baselines:

```bash
# Start your MCP server (if not already running)
cd ~/repos/chess-coach
uv run chess-coach-mcp &
SERVER_PID=$!

# Record golden responses
cd ~/repos/mcptoolkit-test
mcptest record \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir scenarios/chess-coach/golden/ \
  --fuzzy-match timestamps,ids \
  --verbose

# Stop server
kill $SERVER_PID

# ✅ Result: Golden files + mock data created
```

**What Gets Created**:

1. **Golden Files** (regression baselines):
   ```json
   // scenarios/chess-coach/golden/query-games-basic.golden.json
   {
     "scenarioName": "query_games - basic query all games",
     "recordedAt": "2025-12-24T10:30:00Z",
     "serverVersion": "0.4.0",
     "responses": [
       {
         "toolName": "query_games",
         "success": true,
         "result": [
           {
             "id": 123,
             "date": "2025-12-01",
             "playerColor": "white",
             "result": "1-0",
             "opening": "Sicilian Defense"
           },
           // ... more games
         ]
       }
     ]
   }
   ```

2. **Mock Data** (for fast CI/CD):
   ```jsonl
   {"request":{"method":"tools/call","params":{"name":"query_games","arguments":{}}},"response":{"content":[{"type":"text","text":"[{\"id\":123,\"date\":\"2025-12-01\",...}]"}]}}
   {"request":{"method":"tools/call","params":{"name":"detect_themes","arguments":{"min_occurrences":3}}},"response":{"content":[{"type":"text","text":"[{\"theme\":\"Fork on f7\",...}]"}]}}
   ```

**Frequency**: Once per version when responses change significantly

---

### Phase 5: Run Regression Tests (Every Release)

Test new releases against golden baselines:

```bash
# Test against live server
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden scenarios/chess-coach/golden/ \
  --fuzzy-match timestamps,ids \
  --verbose

# ✅ Result: Pass/fail report + regressions detected
```

**Output**:
```
Testing chess-coach v0.4.0
==========================

✅ query_games - basic query all games (0.12s)
✅ query_games - filter by player color (0.09s)
✅ query_games - edge case invalid color (0.05s)
✅ detect_themes - basic detection (0.45s)
⚠️  detect_themes - filter by time control (0.38s)
   └─ REGRESSION: Expected 5 themes, got 7 (2 new themes added)

26/27 tests passed (96.3%)
1 regression detected (review required)
Total time: 3.2s
```

**Frequency**: Every release, every PR, every commit (fast with mocks)

---

### Phase 6: Fast CI/CD with Mocks (Zero Server Startup)

Use recorded mock data for blazing-fast CI/CD:

```yaml
# .github/workflows/mcp-test.yml
name: MCP Contract Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install mcptest
        run: npm install -g @devnet/mcptest
      
      - name: Run tests
        run: |
          mcptest run \
            --scenarios scenarios/chess-coach/ \
            --server http://localhost:8000 \
            --golden scenarios/chess-coach/golden/ \
            --verbose
      
      - name: Publish test results
        uses: EnricoMi/publish-unit-test-result-action@v2
        if: always()
        with:
          files: reports/junit.xml
```

**Speed Comparison**:
- Live server: 5-10s (actual server execution)
- With golden files: Fast comparison for regression detection

**Benefit**: Fast regression detection, no need for complex assertions

---

## Version Upgrade Workflow

When you release a new version with contract changes:

```bash
# 1. Extract new dump and convert to mcpdesc
mcpcontract dump \
  --config .mcp-config.json \
  --server chess-coach \
  --output dumps/chess-coach-v0.5.0.dump.json

mcpcontract convert \
  --dump dumps/chess-coach-v0.5.0.dump.json \
  --output mcpdesc/chess-coach-v0.5.0.mcpdesc.json

# 2. Compare contracts (detect breaking changes)
mcpcontract diff \
  --old dumps/chess-coach-v0.4.0.dump.json \
  --new dumps/chess-coach-v0.5.0.dump.json \
  --output diffs/v0.4.0-to-v0.5.0.diff.json

mcpcontract breaking \
  --diff diffs/v0.4.0-to-v0.5.0.diff.json \
  --suggest-version

# Output:
# ✅ No breaking changes detected
# 💡 Suggested version: v0.5.0 (MINOR)
# New tools: analyze_endgame
# Updated tools: query_games (new parameter: outcome_type)

# 3. Re-generate scenarios (captures new features)
mcptest generate \
  --mcpdesc mcpdesc/chess-coach-v0.5.0.mcpdesc.json \
  --output scenarios/chess-coach/ \
  --coverage full \
  --merge  # Keep existing scenarios, add new ones

# 4. Re-record golden files (only for changed tools)
mcptest record \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir scenarios/chess-coach/golden/ \
  --incremental  # Only record new/changed scenarios

# 5. Test regression (should pass with new baselines)
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden scenarios/chess-coach/golden/ \
  --verbose
```

**Time**: 5-10 minutes for minor releases, 15-20 for major

---

## Real-World Example: chess-coach v0.4.0

### Initial Setup (30 minutes)

```bash
# Step 1: Extract dump and convert (2 min)
cd ~/repos/chess-coach
mcpcontract dump --config .mcp-config.json --output dumps/v0.4.0.dump.json
mcpcontract convert --dump dumps/v0.4.0.dump.json --output mcpdesc/v0.4.0.mcpdesc.json

# Step 2: Auto-generate tests (1 min)
cd ~/repos/mcptoolkit-test
mcptest generate \
  --mcpdesc ../chess-coach/mcpdesc/v0.4.0.mcpdesc.json \
  --output scenarios/chess-coach/ \
  --coverage full

# Output:
# ✅ Generated 27 scenarios
#    - 8 basic (one per tool)
#    - 12 parameterized (coverage of all parameters)
#    - 7 edge cases (errors, boundaries)

# Step 3: Record golden files (5 min)
mcptest record \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir scenarios/chess-coach/golden/

# ✅ 27 golden files created
# ✅ mock/chess-coach-v0.4.0.jsonl created (115 KB)

# Step 4: Initial test run (2 min)
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden scenarios/chess-coach/golden/ \
  --verbose

# ✅ 27/27 tests passed
```

**Result**: Complete test suite in 30 minutes, zero manual YAML writing

### Subsequent Releases (5 minutes)

```bash
# v0.5.0 released: Added analyze_endgame tool, updated query_games

# 1. Extract new dump and convert
mcpcontract dump --config .mcp-config.json --output dumps/v0.5.0.dump.json
mcpcontract convert --dump dumps/v0.5.0.dump.json --output mcpdesc/v0.5.0.mcpdesc.json

# 2. Check for breaking changes
mcpcontract breaking \
  --old dumps/v0.4.0.dump.json \
  --new dumps/v0.5.0.dump.json \
  --suggest-version
# ✅ No breaking changes (MINOR version)

# 3. Re-generate (merge new scenarios)
mcptest generate \
  --mcpdesc mcpdesc/v0.5.0.mcpdesc.json \
  --output scenarios/chess-coach/ \
  --merge

# Output:
# ✅ Added 3 new scenarios for analyze_endgame
# ✅ Updated 2 scenarios for query_games

# 4. Re-record (incremental)
mcptest record \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir scenarios/chess-coach/golden/ \
  --incremental

# ✅ Recorded 5 new/changed scenarios
# ✅ Preserved 22 existing golden files

# 5. Run regression tests
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden scenarios/chess-coach/golden/ \
  --verbose

# ✅ 30/30 tests passed (3 new, 27 existing)
```

**Result**: New release tested in 5 minutes, zero manual updates

---

## Benefits Summary

### Traditional Manual Testing

❌ **Time**: Days/weeks to write comprehensive tests  
❌ **Maintenance**: Every contract change requires test updates  
❌ **Coverage**: Hard to achieve 100% tool coverage  
❌ **Consistency**: Test quality varies by author  
❌ **CI/CD**: Slow (need live server for every run)  

### mcptest Auto-Generated Testing

✅ **Time**: 30 minutes initial setup, 5 minutes per release  
✅ **Maintenance**: Automatic regeneration on contract changes  
✅ **Coverage**: 100% tool coverage guaranteed  
✅ **Consistency**: Generated from schema, always complete  
✅ **Regression**: Automatic detection via golden files  
✅ **Documentation**: YAML scenarios serve as executable docs  

---

## Advanced Patterns

### Pattern 1: Multi-Environment Testing

Test same scenarios against different environments:

```bash
# Development (live)
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden golden/dev/ \
  --verbose

# Staging (live)
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server https://staging.chess-coach.dev \
  --golden golden/staging/ \
  --verbose

# Production (golden comparison only)
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server https://api.chess-coach.dev \
  --golden golden/prod/ \
  --verbose
```

### Pattern 2: Selective Testing

Run subset of tests for faster feedback:

```bash
# Test only specific tools
mcptest run \
  --scenarios scenarios/chess-coach/query-games-*.yaml \
  --server http://localhost:8000
```

---

## Troubleshooting

### Issue: Generated scenarios fail

**Cause**: Server implementation doesn't match schema  
**Solution**: Fix implementation or update schema in mcpdesc

### Issue: Too many regressions on upgrade

**Cause**: Legitimate response changes (new features)  
**Solution**: Re-record golden files after verifying changes are intentional

### Issue: Slow CI/CD

**Cause**: Testing many scenarios against live server  
**Solution**: Focus on critical scenarios, use parallel execution (future feature)

### Issue: Golden files show false positives

**Cause**: Timestamps, random IDs causing mismatches  
**Solution**: Use `--fuzzy-match timestamps,ids,uuids` flag

---

## Next Steps

1. **Start with basic coverage**: Generate basic scenarios, validate core functionality
2. **Iterate to full coverage**: Add edge cases as you discover them
3. **Integrate CI/CD**: Use mock mode for fast PR checks
4. **Automate version workflow**: Script the mcpdesc → generate → record → test pipeline

---

## Related Documentation

- [mcp-contract-testing-methodology.md](maintainers/mcp-contract-testing-methodology.md) - Complete testing approach
- [implementation-plan.md](maintainers/implementation-plan.md) - Technical architecture
- [mock-integration-design.md](maintainers/mock-integration-design.md) - Record/replay details
- [mcptoolkit-contract](https://github.com/cisco-open/mcptoolkit-contract) - mcpdesc generation
- [mcptoolkit-mock](https://github.com/cisco-open/mcptoolkit-mock) - Mock server usage

---

**Version**: 0.1.0 (Design Phase)  
**Status**: Implementation starting Phase 1  
**Feedback**: Open issues at [mcptoolkit-test repository](https://github.com/cisco-open/mcptoolkit-test)
