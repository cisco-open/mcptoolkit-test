# MCP Contract Testing Methodology

**Date**: December 24, 2025  
**Version**: 1.0  
**Purpose**: Define repeatable methodology for integration testing MCP servers using contract-based testing principles

## Executive Summary

This document establishes a comprehensive testing methodology for MCP servers inspired by OpenAPI contract testing practices (Pact, Dredd, Postman) but adapted for MCP's unique characteristics as an AI-native protocol. The approach combines:

1. **Contract-First Testing** - Dumps as source of truth
2. **Golden File Testing** - Expected outputs for regression detection
3. **Traffic Recording** - Capture real behavior for replay
4. **AI-Powered Analysis** - Detect behavioral changes and generate test scenarios
5. **Release Cloning** - Create stable test doubles for each version

**Use Case**: Test ChessBoard MCP server (or any MCP server) without source code access, ensuring behavioral consistency across releases.

---

## Table of Contents

1. [Industry Context: Contract Testing](#industry-context-contract-testing)
2. [MCP-Specific Challenges](#mcp-specific-challenges)
3. [Proposed Testing Methodology](#proposed-testing-methodology)
4. [Toolchain Enhancements](#toolchain-enhancements)
5. [Example: ChessBoard Testing Workflow](#example-chessboard-testing-workflow)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Industry Context: Contract Testing

### OpenAPI Contract Testing (Industry Standard)

The OpenAPI ecosystem has mature contract testing practices:

#### 1. **Pact (Consumer-Driven Contracts)**
- **Approach**: Consumers define expected interactions
- **Workflow**:
  1. Consumer writes test defining expected request/response
  2. Pact generates contract file (JSON)
  3. Provider verifies it can fulfill contract
  4. Contract published to Pact Broker for versioning
- **Key Concept**: Consumer expectations drive contract
- **Tooling**: Pact Broker, Pactflow, language-specific DSLs

```javascript
// Example: Pact test
await provider
  .given('user exists')
  .uponReceiving('get user request')
  .withRequest({
    method: 'GET',
    path: '/users/123',
  })
  .willRespondWith({
    status: 200,
    body: { id: 123, name: 'Alice' }
  });
```

#### 2. **Dredd (Provider-Driven Testing)**
- **Approach**: Test provider against OpenAPI spec
- **Workflow**:
  1. Write OpenAPI spec (source of truth)
  2. Dredd reads spec and generates test scenarios
  3. Execute requests against live API
  4. Compare responses to spec expectations
- **Key Concept**: Spec is contract, validate implementation
- **Tooling**: Dredd CLI, hooks for custom logic

```bash
# Example: Dredd testing
dredd openapi.yaml http://localhost:3000 --hookfiles=./hooks.js
```

#### 3. **Postman Contract Testing**
- **Approach**: Collection-based testing with Newman runner
- **Workflow**:
  1. Create Postman collection (manual or from OpenAPI)
  2. Define test assertions in collection
  3. Run with Newman CLI in CI/CD
  4. Generate reports comparing actual vs expected
- **Key Concept**: Collections as executable contracts
- **Tooling**: Postman, Newman, monitors

```javascript
// Example: Postman test assertion
pm.test("Status code is 200", () => {
  pm.response.to.have.status(200);
});
pm.test("User has correct ID", () => {
  const user = pm.response.json();
  pm.expect(user.id).to.equal(123);
});
```

#### 4. **Prism (Mock Server + Validation)**
- **Approach**: OpenAPI-driven mock + contract validation
- **Workflow**:
  1. Generate mock server from OpenAPI spec
  2. Test consumers against mock
  3. Validate provider responses against spec
  4. Switch between mock/live/proxy modes
- **Key Concept**: Spec-driven development and validation
- **Tooling**: Prism CLI, Stoplight platform

```bash
# Example: Prism mock server
prism mock openapi.yaml
prism proxy openapi.yaml http://api.example.com --validate
```

### Key Patterns We Can Adopt

| Pattern | OpenAPI Implementation | MCP Adaptation |
|---------|----------------------|----------------|
| **Contract as Truth** | OpenAPI spec file | MCP dump file |
| **Provider Testing** | Dredd: validate API against spec | Validate MCP server against dump |
| **Consumer Testing** | Pact: mock provider based on expectations | mcpmock: mock MCP server from dump |
| **Golden Files** | Expected response bodies | Expected tool call results |
| **Traffic Recording** | Prism proxy mode | mcpmock record mode |
| **Scenario Testing** | Postman collections | Test scenario definitions |
| **Versioning** | Pact Broker for contract versions | Dump versioning per release |
| **Regression Detection** | Response diff tools | Behavioral change detection |

---

## MCP-Specific Challenges

MCP testing has unique challenges not present in OpenAPI:

### 1. **Stateful Interactions**
- **Challenge**: MCP tools often have state across calls (e.g., chess game state)
- **OpenAPI Parallel**: Session management, but MCP is more conversational
- **Implication**: Tests need context management, sequential scenario support

### 2. **Non-Deterministic Responses**
- **Challenge**: AI-powered tools may return varying outputs for same input
- **OpenAPI Parallel**: Randomized data, but usually deterministic APIs
- **Implication**: Need fuzzy matching, semantic validation, not just exact comparison

### 3. **Complex Input Schemas**
- **Challenge**: MCP tool arguments can be deeply nested JSON with validation rules
- **OpenAPI Parallel**: Request body schemas, but MCP focuses on tool descriptions
- **Implication**: Need intelligent test data generation from JSON schemas

### 4. **Natural Language Descriptions**
- **Challenge**: Tool descriptions are prose, not machine-readable contracts
- **OpenAPI Parallel**: OpenAPI has structured `description` fields
- **Implication**: AI can help generate test scenarios from descriptions

### 5. **Protocol Evolution**
- **Challenge**: MCP protocol versions change (2024-11-05 → 2024-12-01)
- **OpenAPI Parallel**: OpenAPI 3.0 vs 3.1, but more stable
- **Implication**: Tests must be protocol-version agnostic

### 6. **Lack of HTTP Semantics**
- **Challenge**: MCP uses JSON-RPC, no HTTP status codes/headers
- **OpenAPI Parallel**: HTTP provides standard error semantics
- **Implication**: Error handling validation is different (JSON-RPC errors)

---

## Proposed Testing Methodology

### Overview: 5-Layer Testing Pyramid

```
                    /\
                   /  \
                  / AI \           ← AI-powered behavioral analysis
                 /Behav.\
                /________\
               /   E2E    \         ← End-to-end scenario testing
              /____________\
             / Integration  \       ← Multi-tool workflow testing
            /________________\
           /   Contract       \     ← Tool contract verification
          /____________________\
         /    Unit (Tools)      \   ← Individual tool testing
        /________________________\
```

### Layer 1: Unit Testing (Individual Tools)

**Purpose**: Validate each tool in isolation

**Approach**:
1. Extract tool definition from dump
2. Generate test inputs from schema
3. Execute tool call against server
4. Validate response against schema and expectations

**Tools**:
- `mcpcontract dump` - Extract capabilities
- `mcpmock run` - Mock server for controlled testing
- Test framework (Jest, Vitest, Pytest)

**Example Test Structure**:
```typescript
// tests/chessboard/tools/make-move.test.ts
describe('ChessBoard: make_move tool', () => {
  let mockServer: MockServer;
  
  beforeAll(async () => {
    mockServer = await startMockServer('chessboard-v1.0.0.dump.json');
  });
  
  it('should accept valid move in algebraic notation', async () => {
    const result = await mockServer.callTool('make_move', {
      move: 'e4'
    });
    
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('success');
  });
  
  it('should reject invalid move format', async () => {
    await expect(
      mockServer.callTool('make_move', { move: 'invalid' })
    ).rejects.toThrow('Invalid move format');
  });
  
  it('should match golden file for standard opening', async () => {
    const result = await mockServer.callTool('make_move', { move: 'e4' });
    await expect(result).toMatchGoldenFile('make_move_e4.json');
  });
});
```

### Layer 2: Contract Testing (Tool Contracts)

**Purpose**: Ensure server fulfills contract defined in dump

**Approach**:
1. Load dump file (contract)
2. For each tool, validate:
   - Tool exists in server
   - Input schema matches contract
   - Output schema matches contract
   - Required parameters are enforced
3. Record actual responses for regression testing

**Tools**:
- `mcpcontract validate` - Schema validation
- `mcpmock record` - Capture real traffic
- Custom contract validator (NEW)

**Example**:
```typescript
// tests/chessboard/contract.test.ts
describe('ChessBoard Contract Validation', () => {
  it('should provide all tools defined in dump', async () => {
    const dump = loadDump('chessboard-v1.0.0.dump.json');
    const server = connectToServer('http://localhost:3000');
    
    const { tools } = await server.listTools();
    const toolNames = tools.map(t => t.name);
    const expectedTools = dump.tools.definitions.map(t => t.name);
    
    expect(toolNames).toEqual(expect.arrayContaining(expectedTools));
  });
  
  it('should enforce input schema for make_move', async () => {
    const validator = new ContractValidator('chessboard-v1.0.0.dump.json');
    
    // Valid input
    await expect(
      validator.validateToolInput('make_move', { move: 'e4' })
    ).resolves.toBe(true);
    
    // Invalid input (missing required field)
    await expect(
      validator.validateToolInput('make_move', {})
    ).rejects.toThrow('Missing required parameter: move');
  });
});
```

### Layer 3: Integration Testing (Multi-Tool Workflows)

**Purpose**: Test realistic workflows involving multiple tools

**Approach**:
1. Define scenario (e.g., complete chess game)
2. Execute sequence of tool calls
3. Validate state transitions
4. Check workflow completion

**Tools**:
- Test scenario DSL (NEW)
- State tracking (NEW)
- Workflow orchestrator (NEW)

**Example**:
```typescript
// tests/chessboard/workflows/basic-game.test.ts
describe('ChessBoard: Basic Game Workflow', () => {
  it('should play complete game: Scholar\'s Mate', async () => {
    const scenario = new TestScenario('scholars-mate');
    
    await scenario
      .step('Start new game', () => 
        callTool('new_game', { color: 'white' })
      )
      .expect({ state: 'in_progress' })
      
      .step('White opens e4', () => 
        callTool('make_move', { move: 'e4' })
      )
      .expect({ success: true, fen: /^rnbqkbnr\/pppppppp/ })
      
      .step('Black responds e5', () => 
        callTool('make_move', { move: 'e5' })
      )
      
      // ... more moves ...
      
      .step('White delivers checkmate Qxf7#', () => 
        callTool('make_move', { move: 'Qxf7#' })
      )
      .expect({ 
        success: true, 
        game_over: true,
        result: 'checkmate',
        winner: 'white'
      })
      
      .run();
  });
});
```

### Layer 4: End-to-End Testing (Full Scenarios)

**Purpose**: Test complete AI agent interactions

**Approach**:
1. Simulate realistic AI agent behavior
2. Include natural variations (retries, error recovery)
3. Validate end outcomes, not intermediate steps
4. Test with actual AI prompts

**Tools**:
- AI test agent (NEW)
- Prompt-based testing (NEW)
- LangSmith/Braintrust integration (optional)

**Example**:
```typescript
// tests/chessboard/e2e/ai-agent-game.test.ts
describe('ChessBoard: AI Agent Gameplay', () => {
  it('should complete game with AI opponent', async () => {
    const agent = new TestAgent('gpt-4');
    
    const result = await agent.executePrompt(`
      You are playing chess as white. 
      Play an aggressive game trying to checkmate in under 20 moves.
      Use the ChessBoard MCP server tools.
    `);
    
    expect(result.toolCalls).toContain('new_game');
    expect(result.toolCalls).toContain('make_move');
    expect(result.gameOutcome).toMatch(/checkmate|stalemate|draw/);
    expect(result.totalMoves).toBeLessThan(40);
  });
});
```

### Layer 5: Behavioral Analysis (AI-Powered)

**Purpose**: Detect subtle behavioral changes between versions

**Approach**:
1. Record actual responses from multiple test runs
2. Use AI to analyze response patterns
3. Detect semantic changes (not just structural)
4. Flag potential regressions

**Tools**:
- AI diff analyzer (NEW)
- Semantic similarity checker (NEW)
- Behavioral fingerprinting (NEW)

**Example**:
```typescript
// tests/chessboard/behavioral/ai-diff.test.ts
describe('ChessBoard: Behavioral Analysis', () => {
  it('should detect semantic changes in move descriptions', async () => {
    const v1Responses = loadRecordedTraffic('chessboard-v1.0.0.jsonl');
    const v2Responses = loadRecordedTraffic('chessboard-v1.1.0.jsonl');
    
    const analyzer = new AIBehavioralAnalyzer();
    const diff = await analyzer.compare(v1Responses, v2Responses, {
      tool: 'make_move',
      focusAreas: ['move_validation', 'error_messages', 'state_description']
    });
    
    expect(diff.breakingChanges).toHaveLength(0);
    expect(diff.improvements).toContain('Clearer error messages for invalid moves');
  });
});
```

---

## Toolchain Enhancements

To support this methodology, we need enhancements across the toolchain:

### 1. mcpcontract Enhancements

#### A. Test Scenario Export
**Purpose**: Extract test scenarios from dump for automated testing

**New Command**: `mcpcontract export-tests`

```bash
# Generate test fixtures from dump
mcpcontract export-tests \
  --dump chessboard-v1.0.0.dump.json \
  --output tests/fixtures/ \
  --format jest \
  --include-golden-files

# Output structure:
tests/fixtures/
  ├── tool-definitions/
  │   ├── make_move.json
  │   ├── get_board.json
  │   └── new_game.json
  ├── test-inputs/
  │   ├── make_move_valid.json
  │   ├── make_move_invalid.json
  │   └── ...
  └── golden-files/
      ├── make_move_e4.json
      └── ...
```

**Implementation**:
```typescript
// src/commands/export-tests.ts
export async function exportTests(options: ExportTestsOptions): Promise<void> {
  const dump = await loadDump(options.dump);
  
  // Generate test fixtures for each tool
  for (const tool of dump.tools.definitions) {
    // 1. Export tool definition
    await writeToolDefinition(tool, options.output);
    
    // 2. Generate sample inputs from schema
    const inputs = generateTestInputs(tool.inputSchema);
    await writeTestInputs(tool.name, inputs, options.output);
    
    // 3. Create test template
    if (options.format === 'jest') {
      await writeJestTest(tool, options.output);
    }
  }
}
```

#### B. Enhanced Dump Metadata
**Purpose**: Include test-relevant metadata in dumps

**Enhancement**: Extend dump schema with test annotations

```json
{
  "version": "https://developer.cisco.com/mcp_contract_dump/schema/0.4.0",
  "tools": {
    "definitions": [
      {
        "name": "make_move",
        "description": "...",
        "inputSchema": { ... },
        
        // NEW: Test metadata
        "testMetadata": {
          "category": "stateful",
          "deterministic": false,
          "idempotent": false,
          "exampleInputs": [
            { "move": "e4", "description": "Standard opening" },
            { "move": "Nf3", "description": "Knight development" }
          ],
          "expectedBehavior": {
            "validInputs": "Returns success with updated board state",
            "invalidInputs": "Throws error with explanation",
            "edgeCases": "Handles ambiguous notation (Nbd2 vs Nfd2)"
          },
          "dependencies": ["new_game"],
          "stateRequirements": "Active game must exist"
        }
      }
    ]
  }
}
```

### 2. mcpmock Enhancements

#### A. Test Runner Mode
**Purpose**: Run test scenarios directly through mock server

**New Command**: `mcpmock test`

```bash
# Run test scenarios
mcpmock test \
  --dump chessboard-v1.0.0.dump.json \
  --scenarios tests/scenarios/ \
  --compare-golden \
  --report test-report.html

# Scenario file format
# tests/scenarios/basic-game.yaml
name: "Basic Chess Game"
steps:
  - tool: new_game
    input: { color: "white" }
    expect:
      success: true
      state: "in_progress"
  
  - tool: make_move
    input: { move: "e4" }
    expect:
      success: true
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
    goldenFile: "make_move_e4.json"
```

**Implementation**:
```typescript
// src/commands/test.ts
export async function testCommand(options: TestOptions): Promise<void> {
  const server = await startMockServer(options.dump);
  const scenarios = await loadScenarios(options.scenarios);
  
  const results = [];
  for (const scenario of scenarios) {
    const result = await runScenario(server, scenario, options);
    results.push(result);
  }
  
  await generateReport(results, options.report);
  
  const failures = results.filter(r => !r.passed).length;
  process.exit(failures > 0 ? 1 : 0);
}
```

#### B. Golden File Management
**Purpose**: Manage expected responses for regression testing

**New Options**: `--save-golden`, `--compare-golden`

```bash
# First run: Save golden files
mcpmock test \
  --dump chessboard-v1.0.0.dump.json \
  --scenarios tests/scenarios/ \
  --save-golden tests/golden/

# Subsequent runs: Compare against golden
mcpmock test \
  --dump chessboard-v1.1.0.dump.json \
  --scenarios tests/scenarios/ \
  --compare-golden tests/golden/ \
  --report regression-report.html
```

#### C. Behavioral Recording
**Purpose**: Capture rich behavioral data for analysis

**Enhancement**: Extended recording format

```jsonl
{"timestamp":"2025-12-24T10:00:00Z","request":{"id":1,"method":"tools/call","params":{"name":"make_move","arguments":{"move":"e4"}}},"response":{"id":1,"result":{"content":[{"type":"text","text":"Move executed successfully"}]}},"metadata":{"latency_ms":42,"server_version":"1.0.0","protocol_version":"2024-11-05"}}
```

#### D. Diff Mode
**Purpose**: Compare two recordings to detect behavioral changes

**New Command**: `mcpmock diff`

```bash
# Compare recorded traffic from two versions
mcpmock diff \
  --baseline chessboard-v1.0.0.jsonl \
  --current chessboard-v1.1.0.jsonl \
  --output diff-report.html \
  --analyze-with-ai

# Output: Detailed diff with AI analysis
Behavioral Changes Detected:
✓ Compatible: make_move now includes move notation in response
✓ Compatible: Error messages more descriptive
⚠ Potential Breaking: get_board response format changed (array → object)
```

### 3. New Tool: mcptest

**Purpose**: Dedicated test orchestration and analysis tool

**Overview**: While mcpmock handles mocking, mcptest focuses on testing

**Commands**:

```bash
# Initialize test suite from dump
mcptest init --dump chessboard-v1.0.0.dump.json --output tests/

# Generate test scenarios using AI
mcptest generate-scenarios --dump chessboard-v1.0.0.dump.json --ai-model gpt-4

# Run tests against live server
mcptest run --server http://localhost:3000 --scenarios tests/scenarios/

# Run tests against mock
mcptest run --mock --dump chessboard-v1.0.0.dump.json --scenarios tests/scenarios/

# Compare two versions
mcptest compare \
  --baseline-dump v1.0.0.dump.json \
  --current-dump v1.1.0.dump.json \
  --detect-breaking

# Continuous regression testing
mcptest watch \
  --server http://localhost:3000 \
  --scenarios tests/scenarios/ \
  --on-failure notify
```

**Architecture**:
```typescript
// Core components of mcptest

// 1. Scenario Engine
class ScenarioRunner {
  async runScenario(scenario: TestScenario): Promise<TestResult>;
  async runWorkflow(workflow: TestWorkflow): Promise<WorkflowResult>;
  compareWithGolden(actual: any, golden: any): DiffResult;
}

// 2. AI Test Generator
class AITestGenerator {
  async analyzeToolForTestCases(tool: ToolDefinition): Promise<TestCase[]>;
  async generateWorkflows(tools: ToolDefinition[]): Promise<TestWorkflow[]>;
  async suggestEdgeCases(tool: ToolDefinition): Promise<TestCase[]>;
}

// 3. Behavioral Analyzer
class BehavioralAnalyzer {
  async compareVersions(v1: Recording, v2: Recording): Promise<BehaviorDiff>;
  async detectRegressions(baseline: Recording, current: Recording): Promise<Regression[]>;
  async fingerprint(recording: Recording): Promise<BehaviorFingerprint>;
}

// 4. Report Generator
class ReportGenerator {
  generateHTML(results: TestResult[]): string;
  generateMarkdown(results: TestResult[]): string;
  generateJUnit(results: TestResult[]): string; // For CI/CD
}
```

---

## Example: ChessBoard Testing Workflow

Let's walk through testing ChessBoard MCP server across releases:

### Step 1: Initial Setup (v1.0.0)

```bash
# 1. Extract capabilities from live ChessBoard server
mcpcontract dump \
  --server-name "ChessBoard" \
  --url http://localhost:3000/mcp \
  --transport streamable-http \
  --output dumps/chessboard-v1.0.0.dump.json

# 2. Initialize test suite
mcptest init \
  --dump dumps/chessboard-v1.0.0.dump.json \
  --output tests/chessboard/

# Output:
# tests/chessboard/
#   ├── scenarios/
#   │   ├── tool-make_move.yaml
#   │   ├── tool-get_board.yaml
#   │   ├── workflow-basic-game.yaml
#   │   └── workflow-castling.yaml
#   ├── golden/
#   └── config.yaml

# 3. Generate additional scenarios with AI
mcptest generate-scenarios \
  --dump dumps/chessboard-v1.0.0.dump.json \
  --output tests/chessboard/scenarios/ai-generated/ \
  --focus "edge cases,error handling,state transitions"

# 4. Run tests and record baseline
mcptest run \
  --server http://localhost:3000 \
  --scenarios tests/chessboard/scenarios/ \
  --save-golden tests/chessboard/golden/ \
  --record tests/chessboard/recordings/v1.0.0.jsonl

# Results:
# ✓ 45 tests passed
# Golden files saved: tests/chessboard/golden/
```

### Step 2: Testing New Release (v1.1.0)

```bash
# 1. Extract new dump
mcpcontract dump \
  --server-name "ChessBoard" \
  --url http://localhost:3000/mcp \
  --transport streamable-http \
  --output dumps/chessboard-v1.1.0.dump.json

# 2. Detect contract changes
mcpcontract diff \
  --from dumps/chessboard-v1.0.0.dump.json \
  --to dumps/chessboard-v1.1.0.dump.json \
  --output diffs/chessboard-v1.0-to-v1.1.json

mcpcontract breaking \
  --diff diffs/chessboard-v1.0-to-v1.1.json \
  --output diffs/chessboard-breaking-analysis.json

# 3. Run regression tests
mcptest run \
  --server http://localhost:3000 \
  --scenarios tests/chessboard/scenarios/ \
  --compare-golden tests/chessboard/golden/ \
  --record tests/chessboard/recordings/v1.1.0.jsonl \
  --report reports/v1.1.0-regression.html

# 4. Behavioral analysis
mcptest compare \
  --baseline-recording tests/chessboard/recordings/v1.0.0.jsonl \
  --current-recording tests/chessboard/recordings/v1.1.0.jsonl \
  --analyze-with-ai \
  --output reports/v1.1.0-behavioral-diff.html

# Results:
# ✓ 43 tests passed
# ⚠ 2 tests failed (golden file mismatch)
# 
# Failed Tests:
# 1. tool-get_board: Response format changed (array → object)
# 2. workflow-castling: Different notation format
# 
# Behavioral Changes:
# - get_board now returns {squares: [...]} instead of [...]
# - Castling notation changed from "O-O" to "0-0"
# 
# Breaking Changes: 1 (get_board response format)
# Recommendation: MAJOR version bump required (v1.0 → v2.0)
```

### Step 3: Creating Release Clone (Mock Server)

```bash
# Option A: Use recorded traffic for exact replay
mcpmock run \
  --dump dumps/chessboard-v1.0.0.dump.json \
  --replay tests/chessboard/recordings/v1.0.0.jsonl \
  --port 3001

# Option B: Use dump with auto-generated data
mcpmock run \
  --dump dumps/chessboard-v1.0.0.dump.json \
  --data tests/chessboard/mock-data/ \
  --port 3002

# Now clients can test against v1.0.0 mock while v1.1.0 is live on 3000
```

### Step 4: Continuous Integration

```yaml
# .github/workflows/mcp-contract-tests.yml
name: MCP Contract Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Start ChessBoard Server
        run: |
          docker run -d -p 3000:3000 chessboard:${{ github.sha }}
      
      - name: Extract Contract
        run: |
          mcpcontract dump \
            --url http://localhost:3000/mcp \
            --output dumps/current.dump.json
      
      - name: Check for Breaking Changes
        run: |
          mcpcontract diff \
            --from dumps/chessboard-latest.dump.json \
            --to dumps/current.dump.json \
            --output diff.json
          
          mcpcontract breaking \
            --diff diff.json \
            --output breaking.json \
            --exit-code
      
      - name: Run Contract Tests
        run: |
          mcptest run \
            --server http://localhost:3000 \
            --scenarios tests/chessboard/scenarios/ \
            --compare-golden tests/chessboard/golden/ \
            --report reports/contract-tests.html \
            --junit reports/junit.xml
      
      - name: Upload Test Report
        uses: actions/upload-artifact@v4
        with:
          name: test-reports
          path: reports/
      
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const breaking = JSON.parse(fs.readFileSync('breaking.json'));
            
            if (breaking.hasBreakingChanges) {
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                body: '⚠️ **Breaking Changes Detected**\n\n' + 
                      breaking.summary
              });
            }
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Basic contract testing capability

**Deliverables**:
1. ✅ `mcpcontract export-tests` command
   - Export tool definitions as test fixtures
   - Generate sample inputs from schemas
   - Create test templates (Jest, Vitest, Pytest)

2. ✅ `mcpmock test` command (basic)
   - Run YAML scenario files
   - Basic assertion support
   - Simple reporting

3. ✅ Golden file support
   - `--save-golden` flag in mcpmock
   - `--compare-golden` flag
   - Simple diff reporting

**Example Output**:
```bash
mcptest init --dump chessboard.dump.json --output tests/
# → Creates basic test structure

mcpmock test --scenarios tests/scenarios/ --save-golden tests/golden/
# → Runs tests and saves expected outputs
```

### Phase 2: Advanced Testing (Weeks 3-4)

**Goal**: Workflow and behavioral testing

**Deliverables**:
1. ✅ Multi-step scenario support
   - Sequential tool calls
   - State validation between steps
   - Conditional logic (if-then scenarios)

2. ✅ Enhanced recording
   - Rich metadata capture
   - Performance metrics
   - Error details

3. ✅ `mcpmock diff` command
   - Compare two recordings
   - Structural diff report
   - Change categorization

**Example Workflow**:
```bash
# 1. Record baseline responses
mcptest record \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir golden/

# 2. Run tests with golden file comparison
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir golden/ \
  --fuzzy-fields "date_played,timestamp"

# 3. Generate diff report
mcptest diff \
  --baseline golden/v1/ \
  --current golden/v2/ \
  --output diff-report.html
```

### Phase 3: Scenario Generation (Weeks 5-6)

**Goal**: Auto-generate tests from dumps (MCPEval-inspired)

**Deliverables**:
1. ✅ Scenario generator
   - Analyze tool schemas
   - Generate valid test inputs (json-schema-faker)
   - Suggest edge cases
   - Multi-tool workflows

2. ✅ `mcptest generate` command
   - Auto-generate YAML scenarios from dump
   - Coverage analysis
   - Customization options

3. ✅ Template system
   - Scenario templates for common patterns
   - Domain-specific generators
   - Community contributions

**Example Workflow**:
```bash
# Auto-generate comprehensive test suite
mcptest generate \
  --dump chess-coach.dump.json \
  --output scenarios/chess-coach/ \
  --coverage full

# Generates:
# - Happy path tests for all 8 tools
# - Edge case scenarios
# - Error handling tests
# - Multi-tool workflows

# Customize generation
mcptest generate \
  --dump chess-coach.dump.json \
  --output scenarios/custom/ \
  --focus "error-handling,edge-cases" \
  --tools "query_games,get_game_details"
```

### Phase 4: Production Ready (Weeks 7-8)

**Goal**: CI/CD integration and reporting

**Deliverables**:
1. ✅ Multiple report formats
   - JSON (machine-readable)
   - HTML (interactive)
   - JUnit XML (CI/CD)
   - Markdown (documentation)

2. ✅ CI/CD integration
   - GitHub Actions workflow
   - Exit codes for CI
   - Performance benchmarking
   - Trend tracking

3. ✅ Documentation
   - Complete testing guide
   - chess-coach example
   - Best practices
   - Troubleshooting

**Example CI/CD**:
```yaml
# .github/workflows/mcp-test.yml
name: MCP Server Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start MCP Server
        run: npm run start:server &
      
      - name: Run Tests
        run: |
          npx mcptest run \
            --scenarios scenarios/ \
            --server http://localhost:8000 \
            --golden-dir golden/ \
            --junit results/junit.xml \
            --html results/index.html
      
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: results/
```

### Phase 5: MCPEval Integration (Weeks 9-10)

**Goal**: Evaluate and selectively adopt Salesforce MCPEval methodology

**Deliverables**:
1. ✅ Evaluate Salesforce MCPEval with chess-coach
2. ✅ Comparative analysis
3. ✅ Integration strategy (if beneficial)
4. ✅ AI-powered features (semantic analysis, behavioral testing)

**Decision Points**:
- If methodology improves outcomes → Adopt selectively
- If it does not contribute to solution design → Treat as dust
- If complementary → Integrate as optional features

**Focus Areas**:
- Agent behavior evaluation (multi-turn conversations)
- Semantic similarity analysis
- Domain-specific metrics
- LLM-powered test generation

---

## Success Metrics

### Technical Metrics
- **Test Coverage**: >80% of tool definitions have test scenarios
- **Regression Detection Rate**: Catch 95%+ of breaking changes
- **False Positive Rate**: <5% of reported issues are not actual problems
- **Test Execution Time**: <5 minutes for typical test suite
- **Setup Time**: <10 minutes to create test suite for new server

### Business Metrics
- **Adoption**: 10+ MCP servers using this methodology within 3 months
- **Bug Detection**: 50%+ reduction in production issues
- **Release Confidence**: 90%+ of teams feel confident releasing with tests
- **Developer Satisfaction**: >4.5/5 rating for testing experience

---

## Related Work

### Similar Approaches in Other Domains

1. **GraphQL Testing**: Apollo Client Testing, GraphQL Inspector
2. **gRPC Testing**: Postman gRPC, grpcurl with golden files
3. **Protobuf Testing**: Buf conformance testing
4. **WebSocket Testing**: Socket.IO test harness
5. **Event-Driven Testing**: AsyncAPI testing tools

### Academic Research
- **Contract-Based Testing**: Bertrand Meyer's Design by Contract
- **Metamorphic Testing**: For non-deterministic systems (AI outputs)
- **Behavior-Driven Development**: Cucumber, Gherkin scenarios
- **Property-Based Testing**: QuickCheck, Hypothesis

---

## Conclusion

This methodology provides a comprehensive, repeatable approach to MCP server testing inspired by proven practices from the OpenAPI ecosystem but adapted for MCP's unique characteristics as an AI-native protocol.

**Key Innovations**:
1. **Contract-First**: Dumps as source of truth
2. **AI-Powered**: Leverage LLMs for test generation and analysis
3. **Behavioral Focus**: Beyond structural validation to semantic testing
4. **Version Cloning**: Create stable test doubles for each release
5. **Layered Approach**: From unit to behavioral testing

**Next Steps**:
1. Validate approach with ChessBoard server testing
2. Implement Phase 1 enhancements to mcpcontract and mcpmock
3. Gather feedback from early adopters
4. Iterate on AI-powered features
5. Build mcptest as standalone tool

---

**Contributors**: [Your Team]  
**Last Updated**: December 24, 2025  
**Status**: Draft v1.0 - Seeking feedback

