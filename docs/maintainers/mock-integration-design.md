# Mock Integration Design for mcptest

**Date**: December 24, 2025  
**Version**: 1.0  
**Purpose**: Design document for mcptest + mcpmock integration

---

## Executive Summary

mcptest will integrate with mcpmock to enable **record/replay testing** - a proven pattern for fast, deterministic, offline testing. This is essential for practical CI/CD workflows.

**Key Features**:
1. ✅ **Record** live server responses → dual output (golden files + mock data)
2. ✅ **Replay** via mcpmock → fast, deterministic tests
3. ✅ **Test Modes** → live (slow, accurate) vs mock (fast, offline)
4. ✅ **CI/CD Ready** → no database/infrastructure needed for fast tests

---

## Why Mock Integration?

### Industry Standard Pattern

Every mature testing framework has record/replay:
- **Ruby**: VCR (HTTP interactions)
- **Node.js**: nock (HTTP mocking)
- **Python**: responses, vcrpy (HTTP recording)
- **HTTP APIs**: Postman, Prism (mock servers)

### Real-World Benefits

| Benefit | Live Testing | Mock Testing |
|---------|-------------|--------------|
| **Speed** | Slow (DB + network) | Fast (in-memory) |
| **Setup** | Complex (DB, server) | Simple (files only) |
| **Determinism** | Flaky (data changes) | Stable (locked) |
| **Offline** | ❌ Needs infrastructure | ✅ Works anywhere |
| **CI/CD Cost** | High (compute + time) | Low (seconds) |
| **Accuracy** | ✅ Real behavior | ⚠️ Locked snapshot |

**Best Practice**: Use both
- Mock for fast feedback (every commit)
- Live for confidence (nightly, release)

---

## Architecture

### Recording Flow

```
┌─────────────────────────────────────────────────┐
│  Step 1: Record from Live Server                │
├─────────────────────────────────────────────────┤
│                                                  │
│  mcptest record                                 │
│    --scenarios scenarios/                       │
│    --server http://localhost:8000               │
│    --output test-data/v0.4.0/                   │
│                                                  │
│            │                                     │
│            ▼                                     │
│  ┌─────────────────────────────┐               │
│  │   Live MCP Server           │               │
│  │   (chess-coach)             │               │
│  └─────────────────────────────┘               │
│            │                                     │
│            ▼                                     │
│  ┌─────────────────────────────┐               │
│  │   Dual Output:              │               │
│  │                             │               │
│  │   1. Golden Files           │               │
│  │      (fuzzy comparison)     │               │
│  │                             │               │
│  │   2. Mock Data              │               │
│  │      (exact replay)         │               │
│  └─────────────────────────────┘               │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Testing Flow

```
┌─────────────────────────────────────────────────┐
│  Step 2: Test with Mock                         │
├─────────────────────────────────────────────────┤
│                                                  │
│  mcptest run                                    │
│    --mode mock                                  │
│    --mock-data test-data/v0.4.0/mock-data/     │
│                                                  │
│            │                                     │
│            ▼                                     │
│  ┌─────────────────────────────┐               │
│  │   mcpmock (auto-started)    │               │
│  │   --data mock-data/         │               │
│  │   --port 3001               │               │
│  └─────────────────────────────┘               │
│            │                                     │
│            ▼                                     │
│  ┌─────────────────────────────┐               │
│  │   Test Results              │               │
│  │   - Fast (seconds)          │               │
│  │   - Deterministic           │               │
│  │   - Offline                 │               │
│  └─────────────────────────────┘               │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Data Formats

### Recording Format

```json
// test-data/v0.4.0/recordings/query_games_blitz.json
{
  "scenario": "Query recent blitz games",
  "tool": "query_games",
  "request": {
    "args": {
      "time_controls": ["blitz"],
      "limit": 5
    }
  },
  "response": {
    "content": [
      {
        "type": "text",
        "text": "Found 5 games:\n\n[game data...]"
      }
    ]
  },
  "metadata": {
    "recorded_at": "2025-12-24T10:00:00Z",
    "server_version": "0.4.0",
    "server_url": "http://localhost:8000",
    "duration_ms": 123,
    "source": "mcptest record"
  }
}
```

### Mock Data Format (mcpmock compatible)

```json
// test-data/v0.4.0/mock-data/query_games.json
{
  "tool": "query_games",
  "scenarios": [
    {
      "match": {
        "args": {
          "time_controls": ["blitz"],
          "limit": 5
        }
      },
      "response": {
        "content": [
          {
            "type": "text",
            "text": "Found 5 games:\n\n[game data...]"
          }
        ]
      },
      "metadata": {
        "recorded_at": "2025-12-24T10:00:00Z",
        "server_version": "0.4.0"
      }
    }
  ]
}
```

---

## Commands

### 1. Record (Dual Output)

```bash
# Record from live server
mcptest record \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --output test-data/v0.4.0/

# Creates:
# test-data/v0.4.0/
#   ├── golden/          # For fuzzy comparison
#   │   ├── query_games_blitz.json
#   │   ├── get_game_details_123.json
#   │   └── ...
#   └── mock-data/       # For exact replay (mcpmock format)
#       ├── query_games.json
#       ├── get_game_details.json
#       └── ...
```

### 2. Run (Live Mode)

```bash
# Test against live server (slow, requires DB)
mcptest run \
  --mode live \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir test-data/v0.4.0/golden/ \
  --fuzzy-fields "date_played,timestamp" \
  --html results/live-report.html

# Use when:
# - Validating contract compliance
# - Generating new golden files
# - Integration testing with real data
```

### 3. Run (Mock Mode)

```bash
# Test against mock (fast, offline)
mcptest run \
  --mode mock \
  --scenarios scenarios/chess-coach/ \
  --mock-data test-data/v0.4.0/mock-data/ \
  --html results/mock-report.html

# Use when:
# - CI/CD pipelines (fast feedback)
# - Offline development
# - Deterministic testing
# - Performance baselines
```

### 4. Run (Auto-Mock)

```bash
# Auto-start mcpmock with recordings
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --mock-auto \
  --mock-data test-data/v0.4.0/mock-data/

# Equivalent to:
# 1. mcpmock run --data test-data/v0.4.0/mock-data/ --port 3001 &
# 2. mcptest run --server http://localhost:3001
# 3. kill mcpmock
```

### 5. Export Mock Data (Optional)

```bash
# Convert existing recordings to mock format
mcptest export-mock-data \
  --recordings test-data/v0.4.0/recordings/ \
  --output test-data/v0.4.0/mock-data/ \
  --format mcpmock

# Use when:
# - Record command doesn't auto-generate mock data
# - Converting old recordings
# - Custom mock data transformations
```

### 6. Verify (Live vs Mock)

```bash
# Verify consistency between live and mock
mcptest verify \
  --scenarios scenarios/chess-coach/ \
  --live http://localhost:8000 \
  --mock http://localhost:3001 \
  --diff-report results/live-vs-mock.html

# Detects:
# - Mock data drift from live behavior
# - Inconsistencies between modes
# - Need to refresh recordings
```

---

## Test Modes

### Mode Configuration

```yaml
# scenarios/chess-coach/games.yaml
name: "Chess Coach - Game Tools"
version: "1.0"

# Mode-specific settings
modes:
  live:
    server: "http://localhost:8000"
    golden_files: true
    fuzzy_matching: true
    fuzzy_fields:
      - "date_played"
      - "timestamp"
      - "opponent_name"
    
  mock:
    server: "http://localhost:3001"
    golden_files: false  # Mock is exact
    fuzzy_matching: false
    auto_start: true
    mock_data: "../test-data/v0.4.0/mock-data/"
    
  ci:
    mode: "mock"  # Use mock for CI
    fast: true
    parallel: true
    junit: "results/junit.xml"

scenarios:
  - name: "Query recent blitz games"
    tool: "query_games"
    args:
      time_controls: ["blitz"]
      limit: 5
    expectations:
      - type: "success"
      - type: "array-length"
        max: 5
```

### Running Different Modes

```bash
# Development: Live server with fuzzy matching
mcptest run --mode live --scenarios scenarios/

# CI/CD: Fast mock tests
mcptest run --mode ci --scenarios scenarios/

# Explicit mock
mcptest run --mode mock --scenarios scenarios/
```

---

## Use Cases

### 1. Offline Development

**Problem**: Developer doesn't have chess database setup  
**Solution**: Use pre-recorded mock data

```bash
# No database needed!
git clone project
cd mcp-test
npm install

# Mock data is in repo
mcptest run \
  --mode mock \
  --scenarios scenarios/chess-coach/

# Works immediately, offline
```

### 2. Fast CI/CD

**Problem**: CI tests take 10+ minutes (DB setup + execution)  
**Solution**: Mock tests run in seconds

```yaml
# .github/workflows/test.yml
jobs:
  test-fast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # No DB, no server setup needed!
      - name: Run Mock Tests
        run: |
          npm run test:mock
        timeout-minutes: 2  # Fast!
```

### 3. Edge Case Testing

**Problem**: Hard to reproduce error conditions  
**Solution**: Create custom mock data for errors

```bash
# Create error scenarios
mkdir test-data/error-cases/

# Custom mock data with errors
cat > test-data/error-cases/game_not_found.json <<EOF
{
  "tool": "get_game_details",
  "scenarios": [
    {
      "match": { "args": { "game_id": 999999 } },
      "response": {
        "content": [{
          "type": "text",
          "text": "Game with ID 999999 not found."
        }]
      }
    }
  ]
}
EOF

# Test error handling
mcptest run \
  --scenarios scenarios/error-handling/ \
  --mock-data test-data/error-cases/
```

### 4. Regression Testing

**Problem**: Need to verify v0.5.0 doesn't break v0.4.0 behavior  
**Solution**: Test new version against old recordings

```bash
# Lock v0.4.0 behavior
mcptest record \
  --scenarios scenarios/ \
  --server http://localhost:8000 \
  --output test-data/v0.4.0/

# Later: Test v0.5.0 against v0.4.0 mock
mcptest run \
  --scenarios scenarios/v0.5.0/ \
  --mock-data test-data/v0.4.0/mock-data/ \
  --report reports/backward-compat.html

# Detects: Breaking changes in v0.5.0
```

### 5. Performance Baseline

**Problem**: Network/DB variance makes perf testing unreliable  
**Solution**: Mock eliminates external variability

```bash
# Consistent performance baseline
mcptest run \
  --scenarios scenarios/performance/ \
  --mode mock \
  --mock-data test-data/baseline/ \
  --benchmark \
  --iterations 100

# Only measures mcptest + protocol overhead
# No DB/network noise
```

---

## CI/CD Integration

### Fast Mock Tests (Always Run)

```yaml
# .github/workflows/test-mock.yml
name: Mock Tests

on: [push, pull_request]

jobs:
  test-mock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install Dependencies
        run: |
          cd mcp-test
          npm ci
      
      - name: Run Mock Tests
        run: |
          cd mcp-test
          npm run test:mock
        timeout-minutes: 5
      
      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: mock-test-results
          path: mcp-test/results/
```

### Live Tests (Nightly/Release Only)

```yaml
# .github/workflows/test-live.yml
name: Live Tests

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:     # Manual trigger
  push:
    branches: [main]
    tags: ['v*']

jobs:
  test-live:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Database
        run: |
          cd chess-coach
          make setup-test-db
      
      - name: Start MCP Server
        run: |
          cd chess-coach
          python -m chess_coach.mcp_server.server &
          sleep 5
      
      - name: Run Live Tests
        run: |
          cd mcp-test
          npm run test:live
        timeout-minutes: 15
      
      - name: Update Recordings
        if: success() && github.ref == 'refs/heads/main'
        run: |
          cd mcp-test
          npm run record
          
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add test-data/
          git commit -m "Update test recordings [skip ci]"
          git push
```

---

## Implementation Details

### Recording Implementation

```typescript
// src/lib/test-recorder.ts
export class TestRecorder {
  async record(
    scenarios: TestScenario[],
    serverUrl: string,
    outputDir: string
  ): Promise<RecordingResults> {
    const recordings: Recording[] = [];
    
    for (const scenario of scenarios) {
      const startTime = Date.now();
      
      // Execute against live server
      const response = await this.client.callTool(
        scenario.tool,
        scenario.args
      );
      
      const recording: Recording = {
        scenario: scenario.name,
        tool: scenario.tool,
        request: { args: scenario.args },
        response,
        metadata: {
          recorded_at: new Date().toISOString(),
          server_version: await this.getServerVersion(),
          server_url: serverUrl,
          duration_ms: Date.now() - startTime,
          source: 'mcptest record'
        }
      };
      
      recordings.push(recording);
      
      // Save as golden file (for fuzzy matching)
      await this.saveGoldenFile(recording, outputDir);
      
      // Save as mock data (for exact replay)
      await this.saveMockData(recording, outputDir);
    }
    
    return { recordings, count: recordings.length };
  }
  
  private async saveGoldenFile(
    recording: Recording,
    outputDir: string
  ): Promise<void> {
    const goldenPath = join(
      outputDir,
      'golden',
      `${recording.scenario}.json`
    );
    
    await writeFile(goldenPath, JSON.stringify(recording, null, 2));
  }
  
  private async saveMockData(
    recording: Recording,
    outputDir: string
  ): Promise<void> {
    const mockDataPath = join(
      outputDir,
      'mock-data',
      `${recording.tool}.json`
    );
    
    // Load existing or create new
    let mockData: MockDataFile;
    try {
      mockData = JSON.parse(await readFile(mockDataPath, 'utf-8'));
    } catch {
      mockData = { tool: recording.tool, scenarios: [] };
    }
    
    // Add scenario
    mockData.scenarios.push({
      match: { args: recording.request.args },
      response: recording.response,
      metadata: recording.metadata
    });
    
    await writeFile(mockDataPath, JSON.stringify(mockData, null, 2));
  }
}
```

### Mock Mode Implementation

```typescript
// src/lib/test-executor.ts
export class TestExecutor {
  async run(
    scenarios: TestScenario[],
    mode: TestModeConfig
  ): Promise<TestResults> {
    let client: MCPTestClient;
    let mockProcess: ChildProcess | null = null;
    
    try {
      if (mode.mode === 'mock' && mode.autoStartMock) {
        // Auto-start mcpmock
        mockProcess = await this.startMockServer(
          mode.mockData,
          mode.port || 3001
        );
        
        // Wait for mock to be ready
        await this.waitForServer('http://localhost:3001');
        
        client = await this.createClient('http://localhost:3001');
      } else {
        client = await this.createClient(mode.server);
      }
      
      return await this.executeScenarios(scenarios, client, mode);
    } finally {
      if (mockProcess) {
        mockProcess.kill();
      }
    }
  }
  
  private async startMockServer(
    mockData: string,
    port: number
  ): Promise<ChildProcess> {
    const args = [
      'run',
      '--data', mockData,
      '--port', port.toString()
    ];
    
    return spawn('mcpmock', args, {
      stdio: 'inherit'
    });
  }
  
  private async waitForServer(
    url: string,
    timeout: number = 5000
  ): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        await fetch(url);
        return;
      } catch {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    throw new Error(`Server not ready at ${url}`);
  }
}
```

---

## Benefits Summary

| Aspect | Without Mock | With Mock |
|--------|-------------|-----------|
| **CI/CD Time** | 10-15 min | 1-2 min |
| **Setup Complexity** | High (DB, server) | Low (files only) |
| **Flakiness** | High (data changes) | None (deterministic) |
| **Offline Work** | ❌ Impossible | ✅ Fully supported |
| **Cost (compute)** | High | Low |
| **Edge Cases** | Hard to test | Easy (custom data) |
| **Performance Tests** | Unreliable | Consistent |
| **Contract Testing** | ✅ Accurate | ⚠️ Snapshot only |

**Recommendation**: Use both
- Mock: Fast feedback (every commit)
- Live: Ground truth (nightly, release)

---

## Implementation Timeline

**Phase 2 (Weeks 3-4)**:
- Week 3: Recording (dual output)
- Week 4: Mock integration + verification

**Estimated Effort**: 2 weeks

---

## Status

- ✅ Design approved
- ⏳ Implementation pending (Phase 2)
- 🎯 Target: chess-coach as proving ground

---

**Last Updated**: December 24, 2025
