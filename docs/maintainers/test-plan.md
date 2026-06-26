# Test Plan

Status: initial implementation (Tier 1 unit tests + executor assertion engine).

This document describes the testing strategy for `mcptest`, the modules under
test, and the milestones for growing coverage over time. It is the reference for
maintainers adding or reviewing tests.

## Goals

`mcptest` auto-generates scenarios from mcpdesc files, executes them against MCP
servers, records golden files and execution logs, and detects regressions. The
test suite must protect those guarantees while remaining fast and hermetic in CI.

Principles:

- **Prioritize pure logic.** Deterministic, dependency-light modules give the
  most coverage for the least effort.
- **Mock the MCP transport.** Never require a live server in unit/integration
  tests. The `@modelcontextprotocol/sdk` `Client` is mocked at the module
  boundary.
- **Use the filesystem with temp dirs.** Loaders/writers/managers are exercised
  against real files created in `os.tmpdir()` and torn down afterwards.
- **Round-trip against schemas.** Generated scenarios and execution logs are
  validated against the JSON Schemas they claim to satisfy.

## Tooling

- **Runner:** Jest 29 with `ts-jest` ESM preset (`jest.config.js`).
- **ESM mocking:** `jest.unstable_mockModule` + dynamic `import()` for modules
  that construct an `MCPTestClient` internally.
- **Layout:**
  - `tests/unit/` — fast, isolated unit tests.
  - `tests/integration/` — full-workflow tests (added in later milestones).
  - `tests/fixtures/` — existing scenario/golden/log data reused as inputs.

## Tier 1 — Pure-logic unit tests (implemented)

| Module | File | Coverage |
|--------|------|----------|
| `lib/test-executor.ts` (assertion engine) | `tests/unit/test-executor.test.ts` | All assertion types (`response-type`, `error`, `error-code`, `contains-text`, `array-length`, `array-length-max`), unknown type, non-string/non-array inputs, failure propagation, error capture — via a mocked `MCPTestClient`. |
| `lib/golden-file-manager.ts` | `tests/unit/golden-file-manager.test.ts` | save/load/compare round-trip, value mismatch detection, missing/extra `error`, fuzzy matching (timestamps, UUIDs, numeric IDs, custom fields), filename sanitization, missing-golden behavior, `list`. |
| `lib/scenario-loader.ts` | `tests/unit/scenario-loader.test.ts` | Schema validation, missing `name`/empty `tools` errors, malformed YAML, directory load skipping invalid files, empty-dir error. |
| `lib/version-validator.ts` | `tests/unit/version-validator.test.ts` | Version match/mismatch, checksum match/mismatch, recommendation generation per failure mode. |
| `lib/mcpdesc-loader.ts` | `tests/unit/mcpdesc-loader.test.ts` | Format auto-detection, JSON/YAML parsing, parse/read error wrapping, `rawContent` for checksums. |
| `lib/scenario-generator.ts` | `tests/unit/scenario-generator.test.ts` | `basic`/`full`/`edge-cases` strategies, parameter value generation, generated scenarios re-validate against `scenario-schema.json`, stats accounting. |

## Tier 2 — Generator & writer depth (planned)

- `lib/execution-log-writer.ts`: log structure validates against
  `execution-log-schema.json`; checksum/version metadata; hash-based incremental
  dedup.
- Extended generator edge cases (arrays/enums/booleans, `limit` handling).

## Tier 3 — Integration (planned)

- `executeScenario` end-to-end against a mocked server: assertions + golden
  compare + failure propagation.
- `record` → golden files + schema-valid execution log.
- `merge-logs` on real fixture logs (`v0.7.0.json` + `v0.8.0.json`).

## Tier 4 — CLI smoke (planned)

- `node build/index.js <command> --help` exits 0 with usage text.
- `validate` / `schema` commands against fixtures.

## Coverage milestones (per AGENTS.md)

- **M1 (~70%):** Tier 1 complete. ← current target
- **M2 (~75%):** + Tier 2.
- **M3 (~80%):** + Tier 3.

## Running

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```
