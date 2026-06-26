# MCP Test Implementation Plan

**Date**: December 24, 2025  
**Version**: 1.0  
**Purpose**: Detailed implementation plan for mcptest tooling with chess-coach as proving ground

---

## Executive Summary

This document provides the refined implementation plan for building **mcptest** - a dedicated testing framework for MCP servers. Key decisions:

1. **TypeScript** - Consistency with mcp-contract and mcp-mock
2. **YAML Scenarios** - Declarative, AI-generatable test definitions
3. **MCP Inspector Client** - Reuse official protocol implementation
4. **Dump-Driven** - Contract-first testing using mcpcontract dumps
5. **MCPEval Concepts** - Adopt evaluation methodology, not direct dependency
6. **chess-coach** - Real-world MCP server as implementation proving ground

**Related Documents**:
- [Testing Methodology](./mcp-contract-testing-methodology.md) - Complete testing approach
- [MCPEval & Inspector Analysis](./mcpeval-and-inspector-analysis.md) - Tool integration analysis

---

## Architecture Overview

### Component Stack

```
┌─────────────────────────────────────────────────────────┐
│                    mcptest CLI                           │
│         Standalone Testing Framework                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Command Layer (Commander.js)             │  │
│  │  run | generate | record | diff | report         │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Core Libraries                       │  │
│  │                                                   │  │
│  │  ┌─────────────┐  ┌──────────────┐ ┌──────────┐ │  │
│  │  │ MCP Client  │  │   Scenario   │ │  Golden  │ │  │
│  │  │ (Inspector) │  │   Loader     │ │  Files   │ │  │
│  │  └─────────────┘  └──────────────┘ └──────────┘ │  │
│  │                                                   │  │
│  │  ┌─────────────┐  ┌──────────────┐ ┌──────────┐ │  │
│  │  │ Scenario    │  │     Test     │ │Assertion │ │  │
│  │  │ Generator   │  │   Executor   │ │  Engine  │ │  │
│  │  └─────────────┘  └──────────────┘ └──────────┘ │  │
│  │                                                   │  │
│  │  ┌─────────────┐  ┌──────────────┐              │  │
│  │  │  Metrics    │  │   Report     │              │  │
│  │  │ Collector   │  │  Generator   │              │  │
│  │  └─────────────┘  └──────────────┘              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
            │                                    │
            ▼                                    ▼
    ┌──────────────┐                    ┌──────────────┐
    │ mcpcontract  │                    │ Chess Coach  │
    │   (dumps)    │                    │ MCP Server   │
    └──────────────┘                    └──────────────┘
```

### File Structure

```
mcp-test/
├── package.json
├── tsconfig.json
├── README.md
├── AGENTS.md                    # AI assistant guide
│
├── src/
│   ├── index.ts                 # CLI entry point
│   │
│   ├── commands/                # Command implementations
│   │   ├── run.ts              # Execute test scenarios
│   │   ├── generate.ts         # Auto-generate from dump
│   │   ├── record.ts           # Record golden files
│   │   ├── diff.ts             # Compare results
│   │   └── report.ts           # Generate reports
│   │
│   └── lib/                     # Core libraries
│       ├── mcp-client.ts       # MCP Inspector wrapper
│       ├── scenario-loader.ts  # YAML parsing
│       ├── scenario-generator.ts # Auto-generation
│       ├── test-executor.ts    # Test orchestration
│       ├── assertion-engine.ts # Validation logic
│       ├── golden-file-manager.ts # Baseline management
│       ├── metrics-collector.ts   # Performance tracking
│       ├── report-generator.ts    # Output formatting
│       └── types.ts            # TypeScript types
│
├── schemas/                     # JSON schemas
│   ├── scenario-schema.json    # Test scenario format
│   ├── assertion-schema.json   # Assertion definitions
│   └── report-schema.json      # Report structure
│
├── templates/                   # Report templates
│   ├── html-report.hbs         # Interactive HTML
│   ├── markdown-report.hbs     # Documentation
│   └── junit-report.hbs        # CI/CD format
│
├── scenarios/                   # Example test scenarios
│   └── chess-coach/            # chess-coach examples
│       ├── games.yaml          # Game query tests
│       ├── themes.yaml         # Theme detection tests
│       └── golden/             # Expected responses
│
├── dumps/                       # Test dump files
│   └── chess-coach-v0.4.0.dump.json
│
├── tests/                       # Framework tests
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── fixtures/               # Test data
│
├── docs/
│   └── build/
│       ├── mcp-contract-testing-methodology.md
│       ├── mcpeval-and-inspector-analysis.md
│       └── implementation-plan.md (this file)
│
└── build/                       # TypeScript output (gitignored)
```

---

## Design Decisions

### 1. Language: TypeScript

**Decision**: Use TypeScript for consistency

**Rationale**:
- ✅ Matches mcp-contract and mcp-mock
- ✅ Type safety for protocol handling
- ✅ Node.js ecosystem
- ✅ Easy integration with existing tools

**Trade-offs**:
- ❌ Build step required
- ✅ Better IDE support
- ✅ Stronger contracts

### 2. Scenario Format: YAML

**Decision**: YAML for declarative test scenarios

**Rationale**:
- ✅ Human-readable
- ✅ AI can generate from dumps
- ✅ Version control friendly
- ✅ Industry standard (k8s, CI/CD)
- ✅ Easy to tweak manually

**Example**:
```yaml
name: "Chess Coach - Query Games"
version: "1.0"
dump: "../dumps/chess-coach-v0.4.0.dump.json"

server:
  type: "http"
  url: "http://localhost:8000"
  timeout: 5000

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
      - type: "golden-file"
        file: "golden/query_games_blitz.json"
        fuzzy: true
        fuzzy_fields: ["date_played"]
```

**AI Generation Flow**:
```bash
# AI generates from dump
mcptest generate --dump chess-coach.dump.json --output scenarios/

# Developer tweaks
vim scenarios/chess-coach/games.yaml

# AI refines based on feedback
# (future: interactive generation with LLM)
```

### 3. MCP Client: MCP Inspector

**Decision**: Extract and adapt MCP Inspector's client

**Rationale**:
- ✅ Official implementation (Anthropic)
- ✅ Protocol-compliant
- ✅ All transports (stdio, HTTP, SSE, streamable-http)
- ✅ Well-tested
- ✅ Active maintenance

**Implementation**:
```typescript
// src/lib/mcp-client.ts
// Adapted from modelcontextprotocol/inspector

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export class MCPTestClient {
  private client: Client;
  private transport: Transport;
  
  constructor(config: ServerConfig) {
    // Initialize based on transport type
    this.transport = this.createTransport(config);
    this.client = new Client({
      name: 'mcptest',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
  }
  
  private createTransport(config: ServerConfig): Transport {
    switch (config.type) {
      case 'stdio':
        return new StdioClientTransport({
          command: config.command,
          args: config.args
        });
      case 'http':
      case 'sse':
        return new SSEClientTransport(
          new URL(config.url)
        );
      // ... other transports
    }
  }
  
  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }
  
  async callTool(name: string, args: any): Promise<CallToolResult> {
    return await this.client.callTool({ name, arguments: args });
  }
  
  async disconnect(): Promise<void> {
    await this.client.close();
  }
}
```

**License**: ✅ **MIT License Confirmed**
- Source: https://github.com/modelcontextprotocol/inspector
- Allows: Reuse, modification, and distribution with attribution
- Requirements: Include original copyright notice and license text
- Perfect for our use case: Can extract and adapt client code

### 4. Input: Dump-Driven Testing

**Decision**: Dump file is primary input

**Rationale**:
- ✅ Contract-first approach
- ✅ Single source of truth
- ✅ Enables auto-generation
- ✅ Version tracking built-in

**Workflow**:
```bash
# Step 1: Extract contract
cd chess-coach
mcpcontract dump \
  --config .mcp-config.json \
  --output ../mcp-test/dumps/chess-coach-v0.4.0.dump.json

# Step 2: Generate test scenarios
cd ../mcp-test
mcptest generate \
  --dump dumps/chess-coach-v0.4.0.dump.json \
  --output scenarios/chess-coach/ \
  --coverage full

# Step 3: Record golden files
mcptest record \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir scenarios/chess-coach/golden/

# Step 4: Run tests
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir scenarios/chess-coach/golden/
```

### 5. MCPEval: Concepts, Not Dependency

**Decision**: Adopt evaluation methodology, not direct dependency

**Rationale**:
- ✅ Different focus (contract vs agent evaluation)
- ✅ Simpler implementation
- ✅ Better control
- ❌ Academic code may be complex

**What We Adopt**:
- Scenario generation approach
- Standardized metrics design
- Domain-agnostic patterns
- Multi-turn testing concepts

**What We Build**:
- Contract testing focus
- Golden file regression
- CI/CD integration
- Developer-friendly API

**Future Integration** (Phase 5):
- Evaluate Salesforce MCPEval methodology
- Integrate only if it improves evaluation/arbitration outcomes

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Basic test execution with chess-coach

#### Tasks

**Week 1: Project Setup & MCP Client**
- [ ] Initialize TypeScript project
  ```bash
  npm init -y
  npm install typescript @types/node commander
  npm install @modelcontextprotocol/sdk
  npm install --save-dev jest @types/jest ts-jest
  ```
- [ ] Extract MCP Inspector client code
- [ ] Create `MCPTestClient` wrapper
- [ ] Test connection to chess-coach server
- [ ] Implement basic tool invocation

**Week 2: Scenario Loading & Execution**
- [ ] Design YAML schema (`schemas/scenario-schema.json`)
- [ ] Implement scenario loader (`src/lib/scenario-loader.ts`)
- [ ] Build test executor (`src/lib/test-executor.ts`)
- [ ] Add basic assertions (success, error, contains-text)
- [ ] Create `mcptest run` command
- [ ] Test with 1-2 chess-coach tools

#### Deliverables

1. ✅ Working MCP client
2. ✅ YAML scenario loader
3. ✅ Basic test executor
4. ✅ `mcptest run` command
5. ✅ Tests for 2 chess-coach tools

#### Success Criteria

- [ ] Can connect to chess-coach HTTP server
- [ ] Parse YAML scenarios correctly
- [ ] Execute `query_games` tool successfully
- [ ] Report pass/fail to console
- [ ] Tests complete in <5 seconds

### Phase 2: Golden Files & Regression (Weeks 3-4)

**Goal**: Regression testing with baseline comparison

#### Tasks

**Week 3: Golden File System**
- [ ] Design golden file structure
- [ ] Implement `GoldenFileManager` (`src/lib/golden-file-manager.ts`)
- [ ] Add `mcptest record` command
- [ ] Implement exact comparison
- [ ] Add `--update-golden` flag

**Week 4: Fuzzy Matching & Diff**
- [ ] Implement fuzzy matching for non-deterministic fields
- [ ] Create diff visualization
- [ ] Add `mcptest diff` command
- [ ] Test all 8 chess-coach tools
- [ ] Document fuzzy field patterns

#### Deliverables

1. ✅ Golden file manager
2. ✅ `mcptest record` command
3. ✅ Fuzzy matching engine
4. ✅ `mcptest diff` command
5. ✅ Complete chess-coach test suite (8 tools)

#### Success Criteria

- [ ] Can record all chess-coach tool responses
- [ ] Detect changes when server behavior changes
- [ ] Fuzzy match handles timestamps/dates
- [ ] Visual diff shows exact changes
- [ ] <5% false positives

### Phase 3: Scenario Generation (Weeks 5-6)

**Goal**: Auto-generate tests from dumps

#### Tasks

**Week 5: Generator Core**
- [ ] Implement `ScenarioGenerator` (`src/lib/scenario-generator.ts`)
- [ ] Schema analysis for input generation
- [ ] Happy path scenario generation
- [ ] Edge case detection
- [ ] Error scenario creation

**Week 6: Generator Enhancement**
- [ ] Multi-tool workflow generation
- [ ] Add `mcptest generate` command
- [ ] Template system for patterns
- [ ] Coverage analysis
- [ ] Documentation

#### Deliverables

1. ✅ Scenario generator
2. ✅ `mcptest generate` command
3. ✅ Auto-generated chess-coach scenarios
4. ✅ Workflow scenarios
5. ✅ Generation documentation

#### Success Criteria

- [ ] Generate 20+ scenarios for chess-coach
- [ ] Cover all 8 tools with basic tests
- [ ] Suggest 2-3 multi-tool workflows
- [ ] 80%+ of generated scenarios pass
- [ ] Generation completes in <30 seconds

### Phase 4: Production Ready (Weeks 7-8)

**Goal**: CI/CD integration and professional reporting

#### Tasks

**Week 7: Reporting**
- [ ] Implement `ReportGenerator` (`src/lib/report-generator.ts`)
- [ ] HTML report template (Handlebars)
- [ ] JUnit XML format
- [ ] JSON format
- [ ] Markdown format

**Week 8: CI/CD & Documentation**
- [ ] GitHub Actions workflow template
- [ ] Performance benchmarking
- [ ] Exit codes for CI
- [ ] Complete README
- [ ] Tutorial: Testing chess-coach
- [ ] Best practices guide

#### Deliverables

1. ✅ Multiple report formats
2. ✅ GitHub Actions template
3. ✅ Performance metrics
4. ✅ Complete documentation
5. ✅ chess-coach testing tutorial

#### Success Criteria

- [ ] Professional HTML reports
- [ ] JUnit XML works in GitHub Actions
- [ ] Performance trends tracked
- [ ] Documentation covers 80%+ use cases
- [ ] External users can follow tutorial

### Phase 5: Advanced Features (Weeks 9-10)

**Goal**: Add AI-powered and advanced testing features

**Note**: External third-party eval tooling is out of scope unless it clearly improves outcomes.

#### Tasks

**Week 9: Advanced Assertions & AI Features**
- [ ] Implement semantic similarity assertions
- [ ] Add fuzzy matching enhancements
- [ ] Build AI-powered scenario refinement
- [ ] Custom assertion framework
- [ ] Advanced golden file comparison

**Week 10: Behavioral Testing & Optional Research**
- [ ] Multi-turn conversation testing
- [ ] State management for workflows
- [ ] Performance benchmarking
- [ ] **Optional**: Review Salesforce MCPEval paper (if it informs arbitration quality)
- [ ] Plan Phase 6 (community features)

#### Deliverables

1. ✅ Advanced assertion types
2. ✅ AI scenario refinement
3. ✅ Behavioral testing support
4. ✅ Enhanced documentation
5. ✅ Phase 6 roadmap

#### Success Criteria

- [ ] Semantic validation handles non-deterministic responses
- [ ] AI features improve test creation workflow
- [ ] Behavioral patterns well-documented
- [ ] Ready for community contributions

---

## Test Scenario Examples

### Example 1: Simple Tool Test

```yaml
# scenarios/chess-coach/query-games-simple.yaml
name: "Query Recent Games - Simple"
version: "1.0"
dump: "../../dumps/chess-coach-v0.4.0.dump.json"

server:
  type: "http"
  url: "http://localhost:8000"

scenarios:
  - name: "Query last 5 games"
    tool: "query_games"
    args:
      limit: 5
    expectations:
      - type: "success"
      - type: "response-type"
        value: "text"
      - type: "contains-text"
        text: "Found"
```

### Example 2: Golden File Comparison

```yaml
# scenarios/chess-coach/query-games-golden.yaml
name: "Query Games - Golden File"
version: "1.0"

scenarios:
  - name: "Query blitz games"
    tool: "query_games"
    args:
      time_controls: ["blitz"]
      limit: 10
    expectations:
      - type: "success"
      - type: "golden-file"
        file: "golden/query_games_blitz.json"
        fuzzy: true
        fuzzy_fields:
          - "date_played"
          - "opponent_name"
          - "timestamp"
      - type: "array-length"
        min: 1
        max: 10
```

### Example 3: Multi-Tool Workflow

```yaml
# scenarios/chess-coach/workflow-analysis.yaml
name: "Game Analysis Workflow"
version: "1.0"

scenarios:
  - name: "Complete analysis workflow"
    workflow:
      - step: "Query recent games"
        tool: "query_games"
        args:
          limit: 5
          analyzed_only: false
        save_result_as: "games"
        expectations:
          - type: "success"
      
      - step: "Get first game details"
        tool: "get_game_details"
        args:
          game_id: "${games[0].id}"  # Reference previous result
          include_pgn: true
        save_result_as: "game_details"
        expectations:
          - type: "success"
          - type: "has-field"
            field: "pgn"
      
      - step: "Get game analysis"
        tool: "get_game_analysis"
        args:
          game_id: "${games[0].id}"
        expectations:
          - type: "success"
          - type: "has-field"
            field: "evaluations"
```

### Example 4: Error Handling

```yaml
# scenarios/chess-coach/error-handling.yaml
name: "Error Handling Tests"
version: "1.0"

scenarios:
  - name: "Invalid game ID"
    tool: "get_game_details"
    args:
      game_id: 999999
      include_pgn: false
    expectations:
      - type: "success"  # Should not throw
      - type: "contains-text"
        text: "not found"
  
  - name: "Invalid date format"
    tool: "query_games"
    args:
      since_date: "invalid-date"
    expectations:
      - type: "error"
      - type: "error-message-contains"
        text: "Invalid date"
```

---

## Mock Integration Design

### Recording Format

```typescript
// recordings/chess-coach-v0.4.0/query_games_blitz.json
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
        "text": "Found 5 games:\n\n[...]"
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

### Mock Data Export

```typescript
// src/lib/mock-data-exporter.ts
export class MockDataExporter {
  /**
   * Convert mcptest recordings to mcpmock data format
   */
  async exportToMockFormat(
    recordingsDir: string,
    outputDir: string
  ): Promise<void> {
    const recordings = await this.loadRecordings(recordingsDir);
    
    // Group by tool
    const byTool = new Map<string, Recording[]>();
    for (const recording of recordings) {
      if (!byTool.has(recording.tool)) {
        byTool.set(recording.tool, []);
      }
      byTool.get(recording.tool)!.push(recording);
    }
    
    // Convert to mcpmock format (one file per tool)
    for (const [tool, recordings] of byTool) {
      const mockData = {
        tool,
        scenarios: recordings.map(r => ({
          match: { args: r.request.args },
          response: r.response,
          metadata: r.metadata
        }))
      };
      
      await writeFile(
        join(outputDir, `${tool}.json`),
        JSON.stringify(mockData, null, 2)
      );
    }
  }
}
```

### Test Modes

```typescript
// src/lib/types.ts
export type TestMode = 'live' | 'mock' | 'ci';

export interface TestModeConfig {
  mode: TestMode;
  server?: string;
  mockData?: string;
  autoStartMock?: boolean;
  fuzzyMatching?: boolean;
  goldenFiles?: boolean;
}

// src/lib/test-executor.ts
export class TestExecutor {
  async run(
    scenarios: TestScenario[],
    mode: TestModeConfig
  ): Promise<TestResults> {
    let client: MCPTestClient;
    let mockProcess: ChildProcess | null = null;
    
    if (mode.mode === 'mock' && mode.autoStartMock) {
      // Auto-start mcpmock with recorded data
      mockProcess = await this.startMockServer(mode.mockData);
      client = await this.createClient('http://localhost:3001');
    } else {
      client = await this.createClient(mode.server);
    }
    
    try {
      return await this.executeScenarios(scenarios, client, mode);
    } finally {
      if (mockProcess) {
        mockProcess.kill();
      }
    }
  }
  
  private async startMockServer(mockData: string): Promise<ChildProcess> {
    return spawn('mcpmock', [
      'run',
      '--data', mockData,
      '--port', '3001'
    ]);
  }
}
```

## Key Components Design

### 1. Scenario Loader

```typescript
// src/lib/scenario-loader.ts
import { readFile } from 'node:fs/promises';
import yaml from 'yaml';
import Ajv from 'ajv';

export interface ScenarioFile {
  name: string;
  version: string;
  dump?: string;
  server: ServerConfig;
  variables?: Record<string, any>;
  scenarios: TestScenario[];
}

export interface TestScenario {
  name: string;
  tool?: string;
  workflow?: WorkflowStep[];
  args?: Record<string, any>;
  expectations: Expectation[];
}

export class ScenarioLoader {
  private ajv: Ajv;
  
  constructor(schemaPath: string) {
    this.ajv = new Ajv();
    const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));
    this.ajv.compile(schema);
  }
  
  async load(path: string): Promise<ScenarioFile> {
    const content = await readFile(path, 'utf-8');
    const data = yaml.parse(content);
    
    // Validate schema
    if (!this.ajv.validate(data)) {
      throw new ValidationError('Invalid scenario file', this.ajv.errors);
    }
    
    // Substitute variables
    return this.substituteVariables(data);
  }
  
  private substituteVariables(data: ScenarioFile): ScenarioFile {
    // Replace ${variable} references
    const varPattern = /\$\{([^}]+)\}/g;
    // ... implementation
  }
}
```

### 2. Test Executor

```typescript
// src/lib/test-executor.ts
export interface ExecutionOptions {
  failFast?: boolean;
  timeout?: number;
  parallel?: boolean;
  retries?: number;
}

export class TestExecutor {
  constructor(
    private client: MCPTestClient,
    private assertionEngine: AssertionEngine,
    private goldenManager?: GoldenFileManager
  ) {}
  
  async executeScenarios(
    scenarios: TestScenario[],
    options: ExecutionOptions = {}
  ): Promise<TestResults> {
    const results: TestResult[] = [];
    const startTime = Date.now();
    
    for (const scenario of scenarios) {
      if (options.parallel && !scenario.workflow) {
        // Run in parallel (simple scenarios only)
        continue;
      }
      
      const result = await this.executeScenario(scenario, options);
      results.push(result);
      
      if (!result.passed && options.failFast) {
        break;
      }
    }
    
    return {
      results,
      summary: this.calculateSummary(results),
      duration: Date.now() - startTime
    };
  }
  
  private async executeScenario(
    scenario: TestScenario,
    options: ExecutionOptions
  ): Promise<TestResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | null = null;
    
    while (attempts <= (options.retries || 0)) {
      try {
        const response = await this.callTool(scenario, options.timeout);
        const assertions = await this.assertionEngine.check(
          response,
          scenario.expectations
        );
        
        return {
          scenario: scenario.name,
          passed: assertions.every(a => a.passed),
          duration: Date.now() - startTime,
          attempts: attempts + 1,
          response,
          assertions
        };
      } catch (error) {
        lastError = error;
        attempts++;
        
        if (attempts <= (options.retries || 0)) {
          await this.delay(1000 * attempts); // Exponential backoff
        }
      }
    }
    
    return {
      scenario: scenario.name,
      passed: false,
      duration: Date.now() - startTime,
      attempts,
      error: lastError?.message,
      assertions: []
    };
  }
}
```

### 3. Assertion Engine

```typescript
// src/lib/assertion-engine.ts
export interface Expectation {
  type: string;
  [key: string]: any;
}

export interface AssertionResult {
  type: string;
  passed: boolean;
  message: string;
  expected?: any;
  actual?: any;
}

export abstract class Assertion {
  abstract type: string;
  abstract check(response: any, expectation: Expectation): AssertionResult;
}

export class AssertionEngine {
  private assertions: Map<string, Assertion> = new Map();
  
  constructor() {
    // Register built-in assertions
    this.register(new SuccessAssertion());
    this.register(new ErrorAssertion());
    this.register(new ContainsTextAssertion());
    this.register(new GoldenFileAssertion());
    this.register(new JsonSchemaAssertion());
    this.register(new HasFieldAssertion());
    this.register(new ArrayLengthAssertion());
    this.register(new CustomExpressionAssertion());
  }
  
  register(assertion: Assertion): void {
    this.assertions.set(assertion.type, assertion);
  }
  
  async check(
    response: any,
    expectations: Expectation[]
  ): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];
    
    for (const expectation of expectations) {
      const assertion = this.assertions.get(expectation.type);
      
      if (!assertion) {
        results.push({
          type: expectation.type,
          passed: false,
          message: `Unknown assertion type: ${expectation.type}`
        });
        continue;
      }
      
      const result = await assertion.check(response, expectation);
      results.push(result);
    }
    
    return results;
  }
}

// Example assertions
class SuccessAssertion extends Assertion {
  type = 'success';
  
  check(response: any): AssertionResult {
    const isSuccess = response.content && !response.isError;
    
    return {
      type: this.type,
      passed: isSuccess,
      message: isSuccess ? 'Tool call succeeded' : 'Tool call failed'
    };
  }
}

class GoldenFileAssertion extends Assertion {
  type = 'golden-file';
  
  constructor(private goldenManager: GoldenFileManager) {
    super();
  }
  
  async check(response: any, expectation: Expectation): Promise<AssertionResult> {
    const comparison = await this.goldenManager.compare(
      expectation.file,
      response,
      {
        fuzzy: expectation.fuzzy || false,
        fuzzyFields: expectation.fuzzy_fields || []
      }
    );
    
    return {
      type: this.type,
      passed: comparison.passed,
      message: comparison.passed 
        ? 'Response matches golden file' 
        : `Differences found: ${comparison.differences.length}`,
      expected: comparison.expected,
      actual: response
    };
  }
}
```

### 4. Scenario Generator

```typescript
// src/lib/scenario-generator.ts
import jsf from 'json-schema-faker';

export interface GenerationOptions {
  coverage?: 'basic' | 'full' | 'comprehensive';
  focus?: string[];  // e.g., ['edge-cases', 'error-handling']
  tools?: string[];  // Generate for specific tools only
}

export class ScenarioGenerator {
  constructor(private dump: DumpFile) {}
  
  async generate(options: GenerationOptions = {}): Promise<ScenarioFile[]> {
    const files: ScenarioFile[] = [];
    
    // Group tools by category
    const toolsByCategory = this.categorizeTools();
    
    for (const [category, tools] of toolsByCategory) {
      const scenarios: TestScenario[] = [];
      
      for (const tool of tools) {
        // Skip if specific tools requested
        if (options.tools && !options.tools.includes(tool.name)) {
          continue;
        }
        
        // Generate scenarios based on coverage level
        scenarios.push(...this.generateForTool(tool, options));
      }
      
      files.push({
        name: `${category} Tests`,
        version: '1.0',
        dump: this.dump.metadata?.sourcePath,
        server: this.getDefaultServerConfig(),
        scenarios
      });
    }
    
    return files;
  }
  
  private generateForTool(
    tool: ToolDefinition,
    options: GenerationOptions
  ): TestScenario[] {
    const scenarios: TestScenario[] = [];
    
    // 1. Happy path (always)
    scenarios.push(this.generateHappyPath(tool));
    
    // 2. Edge cases (full/comprehensive)
    if (options.coverage !== 'basic') {
      scenarios.push(...this.generateEdgeCases(tool));
    }
    
    // 3. Error handling (comprehensive)
    if (options.coverage === 'comprehensive') {
      scenarios.push(...this.generateErrorCases(tool));
    }
    
    return scenarios;
  }
  
  private generateHappyPath(tool: ToolDefinition): TestScenario {
    // Use json-schema-faker to generate valid input
    const args = jsf.generate(tool.inputSchema);
    
    return {
      name: `${tool.name} - Happy Path`,
      tool: tool.name,
      args,
      expectations: [
        { type: 'success' },
        { type: 'response-type', value: 'text' }
      ]
    };
  }
  
  private generateEdgeCases(tool: ToolDefinition): TestScenario[] {
    const scenarios: TestScenario[] = [];
    
    // Analyze schema for edge cases
    const edgeCases = this.detectEdgeCases(tool.inputSchema);
    
    for (const edgeCase of edgeCases) {
      scenarios.push({
        name: `${tool.name} - ${edgeCase.description}`,
        tool: tool.name,
        args: edgeCase.input,
        expectations: [
          { type: 'success' }
        ]
      });
    }
    
    return scenarios;
  }
}
```

---

## Integration with chess-coach

### Setup

```bash
# 1. Build chess-coach MCP server
cd chess-coach
source venv/bin/activate
pip install -e .

# 2. Start server
python -m chess_coach.mcp_server.server &
SERVER_PID=$!

# 3. Generate dump
cd ../mcp-contract
npm run build
node build/index.js dump \
  --config ../chess-coach/.mcp-config.json \
  --output ../mcp-test/dumps/chess-coach-v0.4.0.dump.json

# 4. Initialize test project
cd ../mcp-test
npm init -y
npm install typescript @types/node commander
```

### Test All 8 Tools

```bash
# Generate scenarios
mcptest generate \
  --dump dumps/chess-coach-v0.4.0.dump.json \
  --output scenarios/chess-coach/ \
  --coverage full

# Expected output:
# scenarios/chess-coach/
#   ├── games.yaml          # 5 game query tools
#   ├── themes.yaml         # 3 theme tools
#   └── workflows.yaml      # Multi-tool scenarios

# Record golden files
mcptest record \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir scenarios/chess-coach/golden/

# Run tests
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --server http://localhost:8000 \
  --golden-dir scenarios/chess-coach/golden/ \
  --html results/report.html \
  --junit results/junit.xml

# Expected: 20+ tests, all passing
```

### Tool Coverage

1. **query_games** - Filter games by various criteria
2. **get_game_details** - Get specific game information
3. **get_game_pgn** - Retrieve game in PGN format
4. **get_game_analysis** - Get Stockfish analysis
5. **get_recent_games** - Quick recent games query
6. **detect_themes** - Pattern detection with filters
7. **list_themes** - View detected themes
8. **get_theme_details** - Get theme information

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/mcp-test.yml
name: MCP Server Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd chess-coach
          python -m venv venv
          source venv/bin/activate
          pip install -e .
      
      - name: Start MCP Server
        run: |
          cd chess-coach
          source venv/bin/activate
          python -m chess_coach.mcp_server.server &
          echo $! > server.pid
          sleep 5  # Wait for server to start
      
      - name: Install mcptest
        run: |
          cd mcp-test
          npm install
          npm run build
      
      - name: Run Tests
        run: |
          cd mcp-test
          npm run test:integration -- \
            --scenarios scenarios/chess-coach/ \
            --server http://localhost:8000 \
            --golden-dir scenarios/chess-coach/golden/ \
            --junit results/junit.xml \
            --html results/report.html
      
      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: mcp-test/results/
      
      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: 'mcp-test/results/junit.xml'
      
      - name: Cleanup
        if: always()
        run: |
          if [ -f chess-coach/server.pid ]; then
            kill $(cat chess-coach/server.pid) || true
          fi
```

---

## Success Metrics

### Technical Metrics (Phase 1-4)

- **Setup Time**: <10 minutes for new project
- **Test Execution**: <5 minutes for chess-coach (8 tools)
- **Coverage**: 100% of tools have basic tests
- **Regression Detection**: 95%+ catch breaking changes
- **False Positives**: <5% of failures are not real issues

### Developer Experience

- **Documentation**: Complete examples for chess-coach
- **YAML Simplicity**: Non-developers can write scenarios
- **Auto-Generation**: 80%+ scenarios auto-generated
- **CI/CD Ready**: Works out-of-box with GitHub Actions

### Community Adoption (6 months)

- **Open Source**: GitHub, MIT license
- **Examples**: 3+ MCP servers tested (chess-coach + 2 others)
- **Contributors**: 5+ external contributors
- **GitHub Stars**: 100+ stars

---

## Risk Mitigation

### Risk 1: MCP Inspector License ✅ RESOLVED
**Risk**: Inspector code may not be reusable  
**Status**: ✅ **MIT License confirmed** - Full reuse allowed with attribution  
**Action**: Include MIT license notice in extracted code  
**No fallback needed**: Can freely extract and adapt client code

### Risk 2: Schema Complexity
**Risk**: chess-coach schemas too complex for generation  
**Mitigation**: Start with simple tools, iterate  
**Fallback**: Manual scenario creation for complex cases

### Risk 3: Non-Determinism
**Risk**: Database state causes test flakiness  
**Mitigation**: Fuzzy matching, test isolation  
**Fallback**: Mock mode with mcpmock

### Risk 4: External Eval Dependency Drift ✅ RESOLVED
**Risk**: Third-party evaluation tools may not provide practical value  
**Decision**: Build independently with MCP Inspector + custom logic  
**Status**: Use Salesforce MCPEval only as methodology input when it improves outcomes  
**Optional**: Archive non-contributing external-tool notes as dust

---

## Next Steps

### Immediate Actions (This Week)

1. ✅ Review this implementation plan
2. ✅ Finalize architecture decisions
3. ✅ **Check MCP Inspector license** - CONFIRMED: MIT License ✅
4. ⏳ Initialize mcp-test project structure
5. ⏳ Update methodology document

### Phase 1 Start (Week 1)

1. Extract MCP Inspector client
2. Create basic TypeScript project
3. Implement scenario loader (YAML)
4. Test connection to chess-coach
5. Execute first tool call

---

## Related Documents

- [Testing Methodology](./mcp-contract-testing-methodology.md) - Complete testing approach
- [MCPEval & Inspector Analysis](./mcpeval-and-inspector-analysis.md) - Tool integration analysis
- [chess-coach AGENTS.md](../../../chess-coach/AGENTS.md) - chess-coach development guide
- [mcp-contract AGENTS.md](../../../mcp-contract/AGENTS.md) - mcp-contract development guide

---

**Status**: Ready for Implementation  
**Next Review**: After Phase 1 completion (Week 2)  
**Last Updated**: December 24, 2025
