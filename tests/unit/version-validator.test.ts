// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateExecutionLog } from '../../src/lib/version-validator.js';
import type { ExecutionLog } from '../../src/lib/types.js';

const MCPDESC_RAW = JSON.stringify(
  {
    mcpdesc: '0.6.0',
    info: { name: 'chess-coach', version: '1.0.0' },
    tools: [],
  },
  null,
  2
);

function checksumOf(raw: string): string {
  return `sha256:${createHash('sha256').update(raw).digest('hex')}`;
}

function makeLog(overrides: Partial<ExecutionLog['metadata']> = {}): ExecutionLog {
  return {
    version: '1.0.0',
    schema: 'https://mcptest.dev/schema/execution-log/v1',
    recordedAt: '2026-01-01T00:00:00Z',
    metadata: {
      mcptestVersion: '1.0.0',
      mcpdescVersion: '0.6.0',
      mcpdescFile: 'server.mcpdesc.json',
      mcpdescChecksum: checksumOf(MCPDESC_RAW),
      serverInfo: { name: 'chess-coach', version: '1.0.0' },
      serverUrl: 'http://localhost:8000',
      transport: 'streamable-http',
      ...overrides,
    },
    executions: [],
  };
}

describe('validateExecutionLog', () => {
  let dir: string;
  let mcpdescPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mcptest-version-'));
    mcpdescPath = join(dir, 'server.mcpdesc.json');
    await writeFile(mcpdescPath, MCPDESC_RAW, 'utf-8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('passes when version and checksum match', async () => {
    const result = await validateExecutionLog(makeLog(), mcpdescPath);
    expect(result.valid).toBe(true);
    expect(result.versionMatch).toBe(true);
    expect(result.checksumMatch).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('reports a version mismatch with recommendations', async () => {
    const result = await validateExecutionLog(makeLog({ mcpdescVersion: '0.5.0' }), mcpdescPath);
    expect(result.valid).toBe(false);
    expect(result.versionMatch).toBe(false);
    expect(result.warnings.some((w) => w.includes('version mismatch'))).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('reports a checksum mismatch when the file changed but version matches', async () => {
    const result = await validateExecutionLog(
      makeLog({ mcpdescChecksum: 'sha256:deadbeef' }),
      mcpdescPath
    );
    expect(result.valid).toBe(false);
    expect(result.versionMatch).toBe(true);
    expect(result.checksumMatch).toBe(false);
    expect(result.warnings.some((w) => w.includes('checksum mismatch'))).toBe(true);
    expect(result.recommendations.some((r) => r.includes('modified'))).toBe(true);
  });

  it('records an error when the mcpdesc file cannot be read', async () => {
    const result = await validateExecutionLog(makeLog(), join(dir, 'missing.json'));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
