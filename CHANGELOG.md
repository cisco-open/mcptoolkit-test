# Changelog

All notable changes to mcptest will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0-rc.2] - 2026-07-30

### Added

- **Jest test suite**: Tier 1 unit tests covering the assertion engine, golden-file
  comparison/fuzzy matching, scenario loading/validation, mcpdesc loading, version
  validation, and scenario generation (48 tests). See
  [docs/maintainers/test-plan.md](docs/maintainers/test-plan.md).
- **OIDC trusted publishing**: Switched CI publish workflow from long-lived
  `NPM_TOKEN` to npm Trusted Publishers (OIDC). No secrets required; short-lived
  tokens are generated per-run. Node bumped to 22.x (required by npm CLI ≥ 11.5.1);
  npm cache removed from release builds per npm guidance; provenance attestations
  are now generated automatically.
- **Pre-release npm dist-tag support**: The publish workflow now stamps
  `package.json` with the git tag version at publish time. Tags containing a
  pre-release identifier (e.g. `v1.1.0-rc.2`) are published with `--tag next`,
  leaving `latest` untouched for stable releases. Tagging `v1.1.0` promotes the
  same code to `latest` without any `package.json` changes.

### Fixed

- **Golden-file fuzzy matching now operates on parsed structure instead of
  serialized JSON text.** Custom `--fuzzy-match` field names and numeric `id`
  values are now correctly ignored during comparison (previously silent no-ops
  on JSON results), `FuzzyMatchOptions.customFields` is honored, and field-name
  matching no longer over-matches unrelated keys (e.g. `name` vs `username`) or
  break on regex-special characters.
- **CI `jest: not found`**: Added `jest`, `ts-jest`, and `@types/jest` dev
  dependencies and a `jest.config.js` (ESM-aware) so `npm test` runs in CI.
- **Security**: Resolved 5 npm audit vulnerabilities — 4 via `npm audit fix`
  (`@hono/node-server`, `fast-uri`, `js-yaml`, `@modelcontextprotocol/sdk`) and 1
  via a `brace-expansion` override in `package.json` to avoid a breaking Jest
  downgrade.

## [1.0.0-rc.1] - 2026-06-25

### Initial open-source release

- **Test executor**: Run YAML scenario files against live MCP servers with a full assertion engine (response-type, array-length, contains, equals, and more)
- **YAML scenario loader**: Human-readable, LLM-friendly test format with JSON Schema validation
- **Auto-generation from mcpdesc files**: Generate test scenarios automatically from MCP Server Description files with three coverage strategies — basic, full, and edge-cases
- **Golden file regression detection**: Record baselines and compare on future runs with fuzzy matching for timestamps, UUIDs, and IDs
- **Execution log export**: Export versioned execution logs for import into mcpmock, enabling fast CI/CD mock-based testing (3–5 s vs 30–60 s live)
- **`merge-logs` command**: Merge execution logs across mcpdesc versions with full version-history tracking
- **Multiple transport types**: Supports stdio, Streamable HTTP, and SSE MCP transports
- **Custom HTTP headers**: Pass OAuth 2 bearer tokens and arbitrary headers to HTTP-based servers via `--header`
- **Incremental recording**: Hash-based detection skips unchanged tool executions, re-records only modified ones
- **Shell completion**: Bash completion script via `mcptest completion bash`
- **Developer guide**: Built-in `mcptest agents` command with full project structure, code-style guidelines, and release process
