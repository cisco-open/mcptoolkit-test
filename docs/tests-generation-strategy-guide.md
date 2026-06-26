# Test Generation Strategy Guide

This guide explains the two complementary approaches for creating test scenarios in mcptest.

## Overview: Two Approaches

### 1. AI Coding Assistant Generation (Recommended for Most Cases)

**Best for:**
- Realistic, contextual test scenarios
- Edge cases and error conditions
- Integration testing with business logic
- Iterative refinement based on failures

**How it works:**
1. You provide context (mcpdesc, docs, intent) to AI assistant (GitHub Copilot, Claude, ChatGPT)
2. AI generates YAML scenarios based on understanding
3. You review and refine
4. Run tests and iterate

**Advantages:**
- ✅ Understands context and intent
- ✅ Creates meaningful test names and descriptions
- ✅ Can incorporate business logic and user stories
- ✅ Adapts to feedback and failures
- ✅ Generates realistic argument combinations
- ✅ Fast iteration cycle

**Limitations:**
- ❌ Requires human guidance
- ❌ May miss systematic coverage
- ❌ Not fully automated

### 2. Automated Generation from mcpdesc

**Best for:**
- Initial smoke test coverage
- Systematic tool validation
- CI/CD baseline tests
- Discovering what's available

**How it works:**
1. `mcptest generate --mcpdesc server.mcpdesc.json --output scenarios/`
2. Tool auto-generates basic scenarios for each tool
3. You review and enhance generated scenarios
4. Add to test suite

**Advantages:**
- ✅ Complete coverage of all tools
- ✅ Zero human effort for initial generation
- ✅ Consistent naming conventions
- ✅ Good for smoke tests
- ✅ Discovers all available tools

**Limitations:**
- ❌ Basic scenarios only (happy path)
- ❌ Limited edge case coverage
- ❌ Generic test cases
- ❌ Requires human refinement for production use

## Recommended Workflow: Hybrid Approach

### Phase 1: Bootstrap with AI Assistant (Current)

```bash
# 1. Get the mcpdesc
mcpcontract convert --dump server.dump.json --output server.mcpdesc.json

# 2. Get schema reference for AI
mcptest schema --ai-guide

# 3. Ask AI to generate scenarios
# Provide: mcpdesc excerpt, tool purpose, test cases needed

# 4. Run tests
mcptest run --scenarios scenarios/ --server <url>

# 5. Iterate on failures
```

**Example AI Prompt:**
```
Create mcptest YAML scenarios for the chess-coach query_games tool:

Tool: query_games
Schema: {
  "limit": {"type": "number"},
  "results": {"type": "array", "items": "win|loss|draw"},
  "time_controls": {"type": "array"}
}
Purpose: Query games with filters
Response: TextContent (string) with JSON data

Test cases:
1. Basic query with limit
2. Filter by results (wins only)
3. Filter by time control (blitz)
4. Empty results
5. Invalid arguments error

Use response-type: "string" and contains-text assertions.
```

### Phase 2: Enhance with Auto-Generation (Phase 3)

```bash
# Generate baseline coverage
mcptest generate --mcpdesc server.mcpdesc.json --output scenarios/generated/

# Review generated scenarios
ls scenarios/generated/

# Enhance specific scenarios with AI assistance
# Keep generated ones as smoke tests
```

### Phase 3: Maintain Both

```
scenarios/
├── smoke/              # Auto-generated, regenerated on schema changes
│   ├── query_games_basic.yaml
│   ├── detect_themes_basic.yaml
│   └── ...
└── integration/        # AI-assisted, human-maintained
    ├── query_games_realistic.yaml
    ├── detect_themes_edge_cases.yaml
    └── end_to_end_workflow.yaml
```

## When to Use Each Approach

### Use AI Assistant When:
- ✅ Starting a new project (Phase 1)
- ✅ Testing complex workflows
- ✅ Need realistic test data
- ✅ Want descriptive test names
- ✅ Iterating based on failures
- ✅ Testing error conditions
- ✅ Integration testing

### Use Auto-Generation When:
- ✅ Need complete tool coverage
- ✅ Setting up CI/CD baselines
- ✅ Discovering available tools
- ✅ Creating smoke tests
- ✅ Schema validation testing
- ✅ Quick sanity checks

## Schema Exposure for AI Assistants

### View Schema

```bash
# Human-readable guide
mcptest schema --ai-guide

# JSON schema for AI context
mcptest schema --json

# Example scenarios
mcptest schema --examples
```

### AI Assistant Integration

**GitHub Copilot:**
```bash
# In VS Code, open scenario file and use Copilot
# Copilot will see:
# - Schema from mcptest
# - Existing scenarios as examples
# - mcpdesc file if open
```

**Command-line AI:**
```bash
# Get schema in AI context
mcptest schema --json > /tmp/schema.json
cat /tmp/schema.json server.mcpdesc.json | ai-tool "Generate scenarios..."
```

## Best Practices

### 1. Start with AI Assistant (Current Phase)
- Faster iteration
- Better test quality
- Learn what works

### 2. Add Auto-Generation Later (Phase 3)
- Use for baseline coverage
- Keep AI-generated tests for critical paths
- Auto-generated = smoke tests
- AI-assisted = integration tests

### 3. Commit Both Types
```
git add scenarios/smoke/       # Auto-generated, disposable
git add scenarios/integration/ # Hand-crafted, precious
```

### 4. Document Intent
```yaml
# AI-generated integration test
name: "query_games - realistic user workflow"
description: "User queries last 10 games, filters by wins"

# vs

# Auto-generated smoke test
name: "query_games_limit_5"
description: "Basic test with limit parameter"
```

## Our Recommendation

### For Current State (Phase 1 Complete)

**Use AI Coding Assistants** - They're available now, understand context, and produce quality tests faster.

```bash
# 1. Get reference
mcptest schema --ai-guide

# 2. Use AI to generate scenarios
# 3. Run tests
mcptest run --scenarios scenarios/ --server <url>

# 4. Iterate
```

### For Future (Phase 3)

**Add Auto-Generation** for baseline coverage:
```bash
# Generate baseline
mcptest generate --mcpdesc server.mcpdesc.json --output scenarios/smoke/

# Enhance critical paths with AI
# AI-assistant generates scenarios/integration/
```

## Conclusion

**Both approaches are valuable:**
- **AI Assistant**: Quality, context, iteration ← Use this now
- **Auto-Generation**: Coverage, automation, baseline ← Add in Phase 3

**Hybrid is best:**
- Auto-generate smoke tests
- AI-assist integration tests
- Maintain both in version control

**Current recommendation:** Focus on AI-assisted generation since it's available today and produces better tests. Add auto-generation in Phase 3 for complete coverage.
