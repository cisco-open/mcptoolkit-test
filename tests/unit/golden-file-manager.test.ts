// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GoldenFileManager } from '../../src/lib/golden-file-manager.js';
import type { ToolResult } from '../../src/lib/types.js';

function makeResult(overrides: Partial<ToolResult> = {}): ToolResult {
  return {
    toolName: 'query_games',
    success: true,
    duration: 5,
    result: { games: ['a', 'b'] },
    ...overrides,
  };
}

describe('GoldenFileManager', () => {
  let dir: string;
  let manager: GoldenFileManager;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mcptest-golden-'));
    manager = new GoldenFileManager(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('saves and loads a golden file round-trip', async () => {
    const result = makeResult();
    await manager.save('scenario one', 'query_games', result);

    const loaded = await manager.load('scenario one', 'query_games');
    expect(loaded).not.toBeNull();
    expect(loaded?.scenarioName).toBe('scenario one');
    expect(loaded?.toolName).toBe('query_games');
    expect(loaded?.response.result).toEqual(result.result);
  });

  it('reports a match for identical results', async () => {
    await manager.save('s', 't', makeResult());
    const comparison = await manager.compare('s', 't', makeResult());
    expect(comparison.match).toBe(true);
    expect(comparison.differences).toBeUndefined();
  });

  it('detects value mismatch in the result', async () => {
    await manager.save('s', 't', makeResult({ result: { games: ['a'] } }));
    const comparison = await manager.compare('s', 't', makeResult({ result: { games: ['b'] } }));
    expect(comparison.match).toBe(false);
    expect(comparison.differences?.some((d) => d.path === 'result')).toBe(true);
  });

  it('detects success-status mismatch', async () => {
    await manager.save('s', 't', makeResult({ success: true }));
    const comparison = await manager.compare('s', 't', makeResult({ success: false }));
    expect(comparison.match).toBe(false);
    expect(comparison.differences?.some((d) => d.path === 'success')).toBe(true);
  });

  it('flags an extra error that was not in the golden file', async () => {
    await manager.save('s', 't', makeResult());
    const comparison = await manager.compare(
      's',
      't',
      makeResult({ error: { code: 'E1', message: 'boom' } })
    );
    expect(comparison.match).toBe(false);
    expect(comparison.differences?.some((d) => d.path === 'error' && d.type === 'extra')).toBe(true);
  });

  it('returns no-match when the golden file is missing', async () => {
    const comparison = await manager.compare('missing', 'tool', makeResult());
    expect(comparison.match).toBe(false);
    expect(comparison.differences?.[0].type).toBe('missing');
  });

  it('fuzzy-matches differing timestamps when enabled', async () => {
    await manager.save('s', 't', makeResult({ result: { at: '2025-01-01T10:00:00Z' } }));
    const comparison = await manager.compare(
      's',
      't',
      makeResult({ result: { at: '2026-06-26T23:59:59Z' } }),
      { ignoreTimestamps: true }
    );
    expect(comparison.match).toBe(true);
    expect(comparison.fuzzyMatched).toContain('timestamps');
  });

  it('fuzzy-matches differing UUIDs when enabled', async () => {
    await manager.save('s', 't', makeResult({ result: { id: '11111111-1111-1111-1111-111111111111' } }));
    const comparison = await manager.compare(
      's',
      't',
      makeResult({ result: { id: '22222222-2222-2222-2222-222222222222' } }),
      { ignoreIds: true }
    );
    expect(comparison.match).toBe(true);
    expect(comparison.fuzzyMatched).toContain('ids');
  });

  it('honors the timestamp keyword in stored fuzzyFields', async () => {
    await manager.save('s', 't', makeResult({ result: { at: '2025-01-01T10:00:00Z' } }), ['timestamp']);
    const comparison = await manager.compare('s', 't', makeResult({ result: { at: '2026-06-26T23:59:59Z' } }));
    expect(comparison.match).toBe(true);
  });

  it('sanitizes scenario and tool names into a safe file path', async () => {
    await manager.save('weird/name:1', 'tool name', makeResult());
    expect(manager.exists('weird/name:1', 'tool name')).toBe(true);
    const files = await manager.list();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.golden\.json$/);
    expect(files[0]).not.toContain('/');
  });

  it('lists only golden files in the directory', async () => {
    await manager.save('a', 't', makeResult());
    await manager.save('b', 't', makeResult());
    const files = await manager.list();
    expect(files).toHaveLength(2);
  });

  it('returns an empty list when the directory does not exist', async () => {
    const empty = new GoldenFileManager(join(dir, 'does-not-exist'));
    await expect(empty.list()).resolves.toEqual([]);
  });
});
