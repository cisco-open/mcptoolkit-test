# MCPEval & MCP Inspector Integration Analysis

**Date**: December 24, 2025  
**Version**: 1.0  
**Purpose**: Analyze how MCPEval frameworks and MCP Inspector complement our testing methodology

---

## Executive Summary

This document analyzes two complementary tools for MCP server testing:

1. **Salesforce MCPEval** - Academic framework for automated agent evaluation
2. **MCP Inspector** - Interactive debugging and testing tool

**Recommendation**: Use MCP Inspector as the foundation for test execution, with MCPEval concepts informing our evaluation metrics and methodology.

---

## Table of Contents

1. [MCPEval Framework Analysis](#mcpeval-framework-analysis)
2. [MCP Inspector Analysis](#mcp-inspector-analysis)
3. [Integration Strategy](#integration-strategy)
4. [Revised Architecture](#revised-architecture)
5. [Implementation Recommendations](#implementation-recommendations)

---

## MCPEval Framework Analysis

### Salesforce MCPEval (Academic)

**Source**: https://arxiv.org/abs/2507.12806  
**GitHub**: https://github.com/SalesforceAIResearch/MCPEval  
**Authors**: Salesforce AI Research team

#### Key Concepts from Paper

**Problem Statement**:
- Existing LLM agent evaluation relies on static benchmarks
- Labor-intensive data collection limits practical assessment
- Need for automated, scalable evaluation frameworks

**MCPEval Solution**:
- **Automatic Task Generation**: Creates evaluation tasks from MCP servers
- **End-to-End Evaluation**: Tests complete agent workflows, not just individual calls
- **Domain-Agnostic**: Works across diverse MCP server implementations
- **Standardized Metrics**: Consistent measurement across domains
- **Native Tool Integration**: Uses MCP protocol directly (not mocked)

#### Architecture (Inferred)

```
┌─────────────────────────────────────────────────┐
│              MCPEval Framework                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐      ┌──────────────┐        │
│  │   Task       │      │  Evaluation   │        │
│  │  Generator   │─────▶│   Pipeline    │        │
│  └──────────────┘      └──────────────┘        │
│         │                      │                 │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌──────────────┐      ┌──────────────┐        │
│  │ MCP Server   │      │   Metrics     │        │
│  │  Discovery   │      │   Reporter    │        │
│  └──────────────┘      └──────────────┘        │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Key Features**:
1. **Task Generation**:
   - Analyzes MCP server capabilities (tools, prompts, resources)
   - Generates evaluation tasks automatically
   - Creates test scenarios covering tool interactions

2. **Deep Evaluation**:
   - Multi-turn conversations
   - Complex tool sequences
   - Error recovery patterns
   - Domain-specific metrics

3. **Standardized Metrics**:
   - Success rate
   - Task completion time
   - Tool usage efficiency
   - Error handling quality
   - Domain-specific KPIs

#### Strengths
- ✅ Academic rigor and reproducibility
- ✅ Automated task generation (reduces manual work)
- ✅ Domain-agnostic approach
- ✅ Focus on agent behavior (not just tool correctness)
- ✅ Standardized metrics for comparison

#### Limitations
- ❌ Academic focus (may be over-engineered for practical use)
- ❌ Requires LLM agent for evaluation (overhead)
- ❌ Focus on end-to-end scenarios (not unit/contract testing)
- ❌ May not address regression testing needs
- ❌ Limited documentation on practical implementation

---

## MCP Inspector Analysis

**GitHub**: https://github.com/modelcontextprotocol/inspector  
**Maintainer**: MCP Core Team (Anthropic)

### Purpose

Interactive debugging and testing tool for MCP servers:
- Manual server inspection
- Tool invocation testing
- Protocol debugging
- Schema validation

### Architecture

```
┌─────────────────────────────────────────────────┐
│              MCP Inspector                       │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐      ┌──────────────┐        │
│  │   Web UI     │      │  MCP Client   │        │
│  │  (Browser)   │◀────▶│   Wrapper     │        │
│  └──────────────┘      └──────────────┘        │
│         │                      │                 │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌──────────────┐      ┌──────────────┐        │
│  │  Tool        │      │   Server      │        │
│  │  Invocation  │      │  Connection   │        │
│  └──────────────┘      └──────────────┘        │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Key Features

1. **Server Connection**:
   - Stdio transport
   - HTTP/SSE transport
   - Streamable HTTP transport
   - Configuration management

2. **Capability Discovery**:
   - List all tools, prompts, resources
   - View schemas
   - Protocol version detection

3. **Interactive Testing**:
   - Invoke tools with custom arguments
   - See real-time responses
   - Protocol message inspection
   - Error handling visualization

4. **Debugging**:
   - Request/response logging
   - Schema validation
   - Performance metrics
   - Connection diagnostics

### Strengths
- ✅ Official MCP tooling (authoritative)
- ✅ Protocol-compliant
- ✅ All transport modes supported
- ✅ Interactive debugging
- ✅ Real-time testing
- ✅ Well-maintained

### Limitations
- ❌ Manual interaction only (not automated)
- ❌ No test scenario support
- ❌ No assertion framework
- ❌ No CI/CD integration
- ❌ No golden file comparison
- ❌ No regression testing

---

## Integration Strategy

### How These Tools Complement Each Other

```
┌────────────────────────────────────────────────────────┐
│                   Testing Ecosystem                     │
├────────────────────────────────────────────────────────┤
│                                                         │
│  MCPEval Concepts          mcptest             MCP     │
│  (Evaluation               (Execution)      Inspector  │
│   Methodology)                                (Debug)  │
│        │                       │                 │     │
│        │                       │                 │     │
│        ▼                       ▼                 ▼     │
│  ┌──────────┐         ┌──────────────┐   ┌──────────┐│
│  │ Metrics  │────────▶│  Test Runner │◀──│  Client  ││
│  │ Design   │         │  & Scenarios │   │  Wrapper ││
│  └──────────┘         └──────────────┘   └──────────┘│
│                               │                        │
│                               ▼                        │
│                       ┌──────────────┐                │
│                       │   Reports    │                │
│                       └──────────────┘                │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### Proposed Architecture: mcptest

**Use MCP Inspector as Foundation**:
- Leverage its MCP client implementation
- Use its transport handling
- Extend its protocol support
- Add automation layer on top

**Adopt MCPEval Concepts**:
- Task generation from dumps
- Standardized metrics
- Domain-agnostic evaluation
- Agent behavior testing

**Build New Capabilities**:
- YAML scenario DSL
- Golden file comparison
- Regression testing
- CI/CD integration

---

## Revised Architecture

### mcptest: Automated Testing Framework

```
┌─────────────────────────────────────────────────────────┐
│                    mcptest CLI                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Commands:                                               │
│  - run        Execute test scenarios                     │
│  - record     Generate golden files                      │
│  - generate   Auto-generate scenarios from dump          │
│  - report     Generate test reports                      │
│  - inspect    Launch interactive inspector               │
│                                                          │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                   Core Modules                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │  Scenario        │      │  MCP Client      │        │
│  │  Generator       │      │  (from Inspector)│        │
│  │  (MCPEval-style) │      └──────────────────┘        │
│  └──────────────────┘               │                   │
│           │                          │                   │
│           ▼                          ▼                   │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │  Scenario        │      │  Test Executor   │        │
│  │  Loader (YAML)   │─────▶│  (New)           │        │
│  └──────────────────┘      └──────────────────┘        │
│                                      │                   │
│                                      ▼                   │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │  Golden File     │◀─────│  Assertion       │        │
│  │  Manager         │      │  Engine          │        │
│  └──────────────────┘      └──────────────────┘        │
│                                      │                   │
│                                      ▼                   │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │  Report          │◀─────│  Metrics         │        │
│  │  Generator       │      │  Collector       │        │
│  └──────────────────┘      └──────────────────┘        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. **MCP Client (from Inspector)**
- **Source**: Adapt from MCP Inspector codebase
- **Purpose**: Handle all MCP protocol communication
- **Features**:
  - All transport modes (stdio, HTTP, SSE, streamable-http)
  - Protocol version negotiation
  - Tool/prompt/resource invocation
  - Error handling

**Why Inspector?**
- ✅ Official implementation (authoritative - Anthropic/MCP Core Team)
- ✅ Battle-tested (8k+ GitHub stars, 799 dependents)
- ✅ Protocol-compliant (all transport modes)
- ✅ Well-maintained (122 contributors, active development)
- ✅ All features supported (stdio, HTTP, SSE, streamable-http)
- ✅ **MIT Licensed** - Free to reuse with attribution

**Implementation**:
```typescript
// src/lib/mcp-client.ts
// Adapted from MCP Inspector (MIT License)
// Source: https://github.com/modelcontextprotocol/inspector
export class MCPTestClient {
  constructor(config: ServerConfig) {
    // Use Inspector's client wrapper
  }
  
  async connect(): Promise<void> {
    // Establish connection
  }
  
  async listTools(): Promise<Tool[]> {
    // Get capabilities
  }
  
  async callTool(name: string, args: any): Promise<CallToolResult> {
    // Invoke tool
  }
  
  async disconnect(): Promise<void> {
    // Clean up
  }
}
```

**License**: ✅ MIT License - Allows reuse, modification, and distribution with attribution

#### 2. **Scenario Generator (MCPEval-style)**
- **Inspiration**: MCPEval's task generation
- **Purpose**: Auto-generate test scenarios from dumps
- **Features**:
  - Analyze tool schemas
  - Generate valid test inputs
  - Create multi-tool workflows
  - Suggest edge cases

**Implementation**:
```typescript
// src/lib/scenario-generator.ts
export class ScenarioGenerator {
  constructor(private dump: DumpFile) {}
  
  async generateScenarios(options: GenerationOptions): Promise<TestScenario[]> {
    const scenarios: TestScenario[] = [];
    
    // For each tool, generate scenarios
    for (const tool of this.dump.tools.definitions) {
      // Basic happy path
      scenarios.push(this.generateHappyPath(tool));
      
      // Edge cases
      scenarios.push(...this.generateEdgeCases(tool));
      
      // Error scenarios
      scenarios.push(...this.generateErrorCases(tool));
    }
    
    // Multi-tool workflows
    scenarios.push(...this.generateWorkflows());
    
    return scenarios;
  }
  
  private generateHappyPath(tool: ToolDefinition): TestScenario {
    // Use json-schema-faker to generate valid inputs
    const args = generateFromSchema(tool.inputSchema);
    
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
}
```

#### 3. **Scenario Loader (YAML)**
- **Purpose**: Parse and validate test scenarios
- **Features**:
  - YAML parsing
  - Schema validation
  - Variable substitution
  - Scenario composition

**YAML Format**:
```yaml
# scenarios/chess-coach/games.yaml
version: "1.0"
name: "Chess Coach - Game Tools"
server: 
  dump: "dumps/chess-coach-v0.4.0.dump.json"
  connection:
    type: "http"
    url: "http://localhost:8000"

variables:
  test_game_id: 12345
  recent_limit: 5

scenarios:
  - name: "Query recent blitz games"
    tool: "query_games"
    args:
      time_controls: ["blitz"]
      limit: ${recent_limit}
    expectations:
      - type: "success"
      - type: "json-schema"
        schema: "games-list.json"
      - type: "array-length"
        max: ${recent_limit}
      - type: "golden-file"
        file: "golden/query_games_blitz.json"
        fuzzy: true
        fuzzy_fields: ["date_played", "opponent_name"]
    
  - name: "Get game details"
    tool: "get_game_details"
    args:
      game_id: ${test_game_id}
      include_pgn: false
    expectations:
      - type: "success"
      - type: "contains-text"
        text: "Game #${test_game_id}"
      - type: "has-fields"
        fields: 
          - "date_played"
          - "result"
          - "player_rating"
      - type: "custom"
        expression: "response.player_rating >= 0"
```

#### 4. **Test Executor**
- **Purpose**: Run scenarios against servers
- **Features**:
  - Sequential/parallel execution
  - State management
  - Retry logic
  - Timeout handling
  - Error recovery

**Implementation**:
```typescript
// src/lib/test-executor.ts
export class TestExecutor {
  constructor(
    private client: MCPTestClient,
    private scenarios: TestScenario[]
  ) {}
  
  async run(options: ExecutionOptions): Promise<TestResults> {
    const results: TestResult[] = [];
    
    for (const scenario of this.scenarios) {
      const result = await this.executeScenario(scenario, options);
      results.push(result);
      
      if (!result.passed && options.failFast) {
        break;
      }
    }
    
    return { results, summary: this.calculateSummary(results) };
  }
  
  private async executeScenario(
    scenario: TestScenario,
    options: ExecutionOptions
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Execute tool call
      const response = await this.client.callTool(
        scenario.tool,
        scenario.args
      );
      
      // Run assertions
      const assertions = await this.assertionEngine.check(
        response,
        scenario.expectations
      );
      
      return {
        scenario: scenario.name,
        passed: assertions.every(a => a.passed),
        duration: Date.now() - startTime,
        response,
        assertions
      };
    } catch (error) {
      return {
        scenario: scenario.name,
        passed: false,
        duration: Date.now() - startTime,
        error: error.message,
        assertions: []
      };
    }
  }
}
```

#### 5. **Assertion Engine**
- **Purpose**: Validate responses against expectations
- **Features**:
  - Multiple assertion types
  - Fuzzy matching
  - Custom validators
  - Semantic comparison

**Assertion Types**:
```typescript
// src/lib/assertions.ts
export interface AssertionType {
  type: string;
  check(response: any, expected: any): AssertionResult;
}

// Built-in assertions
export const assertions = {
  'success': new SuccessAssertion(),
  'error': new ErrorAssertion(),
  'contains-text': new ContainsTextAssertion(),
  'json-schema': new JsonSchemaAssertion(),
  'golden-file': new GoldenFileAssertion(),
  'has-fields': new HasFieldsAssertion(),
  'array-length': new ArrayLengthAssertion(),
  'response-type': new ResponseTypeAssertion(),
  'custom': new CustomExpressionAssertion(),
  'fuzzy-match': new FuzzyMatchAssertion(),
  'semantic-similarity': new SemanticSimilarityAssertion()
};
```

#### 6. **Golden File Manager**
- **Purpose**: Store/compare expected responses
- **Features**:
  - Save baseline responses
  - Diff comparison
  - Fuzzy matching
  - Update mode

**Implementation**:
```typescript
// src/lib/golden-file-manager.ts
export class GoldenFileManager {
  constructor(private goldenDir: string) {}
  
  async save(name: string, response: any): Promise<void> {
    const path = join(this.goldenDir, `${name}.json`);
    await writeFile(path, JSON.stringify(response, null, 2));
  }
  
  async compare(
    name: string, 
    actual: any,
    options: CompareOptions
  ): Promise<ComparisonResult> {
    const path = join(this.goldenDir, `${name}.json`);
    const expected = JSON.parse(await readFile(path, 'utf-8'));
    
    if (options.fuzzy) {
      return this.fuzzyCompare(expected, actual, options.fuzzyFields);
    }
    
    return this.exactCompare(expected, actual);
  }
  
  private fuzzyCompare(
    expected: any,
    actual: any,
    fuzzyFields: string[]
  ): ComparisonResult {
    // Deep comparison ignoring fuzzy fields
    const diff = deepDiff(expected, actual, fuzzyFields);
    
    return {
      passed: diff.length === 0,
      differences: diff,
      fuzzyFields
    };
  }
}
```

#### 7. **Metrics Collector (MCPEval-inspired)**
- **Purpose**: Gather evaluation metrics
- **Features**:
  - Success rates
  - Performance metrics
  - Error analysis
  - Domain-specific KPIs

**Metrics**:
```typescript
// src/lib/metrics-collector.ts
export interface TestMetrics {
  // Overall
  total_scenarios: number;
  passed: number;
  failed: number;
  skipped: number;
  success_rate: number;
  
  // Performance
  total_duration: number;
  avg_response_time: number;
  min_response_time: number;
  max_response_time: number;
  
  // By Tool
  tool_metrics: Record<string, ToolMetrics>;
  
  // Errors
  error_types: Record<string, number>;
  error_rate: number;
  
  // Domain-specific (extensible)
  custom_metrics: Record<string, any>;
}
```

#### 8. **Report Generator**
- **Purpose**: Create test reports
- **Features**:
  - Multiple formats (HTML, JSON, JUnit)
  - Visual diffs
  - Trend analysis
  - CI/CD integration

**Output Formats**:
- **JSON**: Machine-readable results
- **HTML**: Interactive web report
- **JUnit XML**: CI/CD integration
- **Markdown**: Documentation

---

## Implementation Recommendations

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Basic test execution with MCP Inspector client

**Tasks**:
1. ✅ Extract MCP client from Inspector
2. ✅ Create TypeScript project structure
3. ✅ Implement scenario loader (YAML)
4. ✅ Build test executor
5. ✅ Add basic assertions (success, error, contains-text)
6. ✅ Test with chess-coach

**Deliverables**:
- `mcptest run` command
- YAML scenario support
- Basic reporting (console output)

**Success Criteria**:
- Can connect to chess-coach MCP server
- Execute simple tool call scenarios
- Report pass/fail results

### Phase 2: Golden Files & Recording (Weeks 3-4)

**Goal**: Regression testing support

**Tasks**:
1. ✅ Implement golden file manager
2. ✅ Add `mcptest record` command
3. ✅ Fuzzy matching support
4. ✅ Diff visualization
5. ✅ Update mode for golden files

**Deliverables**:
- Golden file comparison
- `mcptest record` command
- Diff reports

**Success Criteria**:
- Can record baseline responses
- Detect regressions via golden file comparison
- Support fuzzy matching for non-deterministic fields

### Phase 3: Scenario Generation (Weeks 5-6)

**Goal**: Auto-generate tests from dumps (MCPEval-style)

**Tasks**:
1. ✅ Implement scenario generator
2. ✅ Add `mcptest generate` command
3. ✅ Schema-based input generation
4. ✅ Edge case detection
5. ✅ Workflow generation

**Deliverables**:
- `mcptest generate` command
- Auto-generated YAML scenarios
- Edge case coverage

**Success Criteria**:
- Generate valid test scenarios from chess-coach dump
- Cover all 8 tools with basic tests
- Suggest multi-tool workflows

### Phase 4: Advanced Features (Weeks 7-8)

**Goal**: Production-ready testing

**Tasks**:
1. ✅ CI/CD integration (JUnit XML)
2. ✅ HTML report generation
3. ✅ Performance benchmarking
4. ✅ Interactive inspector mode
5. ✅ Documentation

**Deliverables**:
- Multiple report formats
- CI/CD integration
- Inspector UI (optional)
- Complete documentation

**Success Criteria**:
- GitHub Actions integration
- Professional HTML reports
- Performance tracking
- Ready for external users

### Phase 5: MCPEval Integration (Weeks 9-10)

**Goal**: Evaluate Salesforce MCPEval concepts for advanced features

**Tasks**:
1. ✅ Evaluate Salesforce MCPEval with chess-coach scenarios
2. ✅ Compare our scenario model against MCPEval methodology
3. ✅ Identify integration points that improve arbitration quality
4. ✅ Document learnings and decision criteria

**Considerations**:
- **If methodology adds value**: Adopt metrics/task-generation patterns
- **If not**: Keep mcptest implementation independent
- **If complementary**: Integrate as optional evaluator workflow

**Decision Criteria**:
| Aspect | Our Implementation | Salesforce MCPEval |
|--------|-------------------|---------------|
| Contract Testing | ✅ Core feature | ❌ Not primary focus |
| Golden Files | ✅ Core feature | ❓ Unknown |
| Regression Testing | ✅ Core feature | ❓ Unknown |
| CI/CD Integration | ✅ Core feature | ❓ Unknown |
| Agent Evaluation | ❌ Not planned | ✅ Core feature |
| Auto Task Generation | ✅ Planned | ✅ Core feature |
| Semantic Analysis | 🔜 Future | ✅ Core feature |

---

## Key Design Decisions

### 1. **Use MCP Inspector Client**
**Decision**: Adapt MCP Inspector's client implementation  
**Rationale**:
- ✅ Official implementation (authoritative)
- ✅ All features supported
- ✅ Well-tested
- ✅ Active maintenance
- ✅ Protocol-compliant

**Alternative Considered**: Build from scratch
- ❌ Reinventing the wheel
- ❌ More bugs
- ❌ Longer development time

### 2. **YAML for Scenarios**
**Decision**: Use YAML for test scenario DSL  
**Rationale**:
- ✅ Human-readable
- ✅ Easy to generate (by AI or code)
- ✅ Version control friendly
- ✅ Industry standard (k8s, CI/CD)

**Alternative Considered**: TypeScript/JavaScript code
- ❌ Harder to generate programmatically
- ❌ Requires compilation
- ✅ More flexible (but we can add custom assertions)

### 3. **Dump as Input**
**Decision**: Dump file is primary input to mcptest  
**Rationale**:
- ✅ Single source of truth
- ✅ Contract-first testing
- ✅ Enables auto-generation
- ✅ Version tracking

**Workflow**:
```bash
# 1. Extract contract
mcpcontract dump --output chess-coach.dump.json

# 2. Generate scenarios
mcptest generate \
  --dump chess-coach.dump.json \
  --output scenarios/

# 3. Run tests
mcptest run \
  --scenarios scenarios/ \
  --server http://localhost:8000
```

### 4. **MCPEval as Inspiration, Not Dependency**
**Decision**: Use MCPEval concepts, not code  
**Rationale**:
- ✅ Different focus (contract vs. agent evaluation)
- ✅ Avoid dependency on academic code
- ✅ Simpler implementation
- ✅ Better control

**What We Adopt**:
- ✅ Auto task generation
- ✅ Standardized metrics
- ✅ Domain-agnostic design
- ✅ Multi-turn scenarios

**What We Skip (for now)**:
- ❌ LLM agent evaluation (focus on contract testing first)
- ❌ Complex behavioral analysis (Phase 5+)

### 5. **Extensible Assertion System**
**Decision**: Plugin-based assertion architecture  
**Rationale**:
- ✅ Domain-specific assertions (chess, finance, etc.)
- ✅ AI-powered assertions (semantic similarity)
- ✅ Custom validators
- ✅ Community contributions

**Example**:
```typescript
// Custom assertion for chess-coach
export class ChessGameAssertion implements AssertionType {
  type = 'chess-game-valid';
  
  check(response: any): AssertionResult {
    // Validate chess game structure
    const hasValidResult = ['win', 'loss', 'draw'].includes(response.result);
    const hasValidColor = ['white', 'black'].includes(response.player_color);
    
    return {
      passed: hasValidResult && hasValidColor,
      message: hasValidResult && hasValidColor 
        ? 'Valid chess game' 
        : 'Invalid chess game structure'
    };
  }
}
```

---

## Integration with Existing Tools

### mcpcontract Integration

```bash
# Generate dump
mcpcontract dump \
  --config mcp-config.json \
  --output chess-coach.dump.json

# Generate scenarios from dump
mcptest generate \
  --dump chess-coach.dump.json \
  --output scenarios/chess-coach/
  
# Run tests
mcptest run --scenarios scenarios/chess-coach/
```

### mcpmock Integration

```bash
# Record traffic for golden files
mcpmock record \
  --server http://localhost:8000 \
  --output traffic.jsonl

# Convert to golden files
mcptest import-traffic \
  --traffic traffic.jsonl \
  --scenarios scenarios/chess-coach/ \
  --golden-dir golden/

# Test against mock
mcptest run \
  --scenarios scenarios/chess-coach/ \
  --mock \
  --dump chess-coach.dump.json
```

---

## Success Metrics

### Technical Metrics
- **Setup Time**: <5 minutes to create test suite
- **Execution Time**: <2 minutes for chess-coach (8 tools)
- **Coverage**: 100% of tools have basic tests
- **Regression Detection**: 95%+ catch breaking changes

### Developer Experience
- **YAML Simplicity**: Non-developers can write scenarios
- **Auto-Generation**: 80%+ scenarios auto-generated
- **CI/CD Ready**: GitHub Actions integration out-of-box
- **Documentation**: Complete examples for chess-coach

### Community Adoption
- **Open Source**: GitHub, MIT license
- **Examples**: 3+ MCP servers tested
- **Contributors**: 5+ external contributors
- **Stars**: 100+ GitHub stars (6 months)

---

## Comparison: mcptest vs Salesforce MCPEval

| Feature | mcptest (Our Tool) | Salesforce MCPEval |
|---------|---------|-------------------|
| **Focus** | Contract testing | Agent evaluation |
| **Our Decision** | ✅ **Building this** | 🔄 **Methodology input** |
| **Input** | Dump file | MCP server |
| **Test Format** | YAML scenarios | Auto-generated |
| **Assertions** | Extensible | Metrics-focused |
| **Golden Files** | ✅ Core feature | ❌ Not primary |
| **Regression Testing** | ✅ Core feature | ❌ Not focus |
| **CI/CD** | ✅ Built-in | ❓ External integration required |
| **Inspector Integration** | ✅ Client reuse | ❌ Separate |
| **Auto Generation** | ✅ From dump | ✅ From server |
| **Agent Testing** | 🔜 Future phase | ✅ Core |
| **Status** | 🆕 New (building) | 📚 Research framework |

**Legend**:
- ✅ = Confirmed feature/decision
- ❌ = Not included/not using
- 🔄 = Adopting concepts, not code
- 🔜 = Planned for future

---

## Next Steps

### Immediate (This Week)
1. ✅ Review this analysis with team
2. ✅ Finalize architecture decisions
3. ✅ Update methodology document
4. ✅ Create project structure

### Phase 1 (Weeks 1-2)
1. Extract MCP Inspector client
2. Build basic test runner
3. Implement YAML loader
4. Test with chess-coach (1 tool)

### Phase 2 (Weeks 3-4)
1. Add golden file support
2. Implement fuzzy matching
3. Test all 8 chess-coach tools
4. Create example scenarios

### Evaluation (Weeks 5-6)
1. Evaluate Salesforce MCPEval
2. Compare results
3. Decide on integration strategy

---

## Open Questions

1. **MCP Inspector Licensing**: Can we reuse Inspector code? (Check license)
2. **Salesforce MCPEval Access**: What can be validated from public artifacts?
3. **Community Interest**: Will others use mcptest?
4. **AI Integration**: When to add LLM-powered features?

---

## Conclusion

**Recommended Approach**:
1. ✅ Use **MCP Inspector client** as foundation (official, reliable)
2. ✅ Adopt **MCPEval concepts** for scenario generation and metrics
3. ✅ Build **mcptest** as standalone tool focused on contract testing
4. ✅ Evaluate **Salesforce MCPEval methodology** in Phase 5 for advanced features
5. ✅ Use **chess-coach** as proving ground

**Key Innovation**:
- Dump-driven testing (contract-first)
- Auto-generated scenarios
- Golden file regression testing
- CI/CD ready out-of-box
- Extensible assertion framework

**Differentiator**:
- **mcptest**: Contract testing, regression detection, developer-focused
- **MCPEval**: Agent evaluation, behavioral analysis, research-focused
- Both tools complement each other in the MCP ecosystem

---

**Contributors**: [Your Team]  
**Last Updated**: December 24, 2025  
**Status**: Architecture Design - Ready for Implementation
