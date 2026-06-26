// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMcpDescFile } from '../../src/lib/mcpdesc-loader.js';

const MCPDESC = {
  mcpdesc: '0.6.0',
  info: { name: 'chess-coach', version: '1.0.0' },
  tools: [{ name: 'query_games', inputSchema: { type: 'object', properties: {} } }],
};

const YAML_MCPDESC = `mcpdesc: "0.6.0"
info:
  name: chess-coach
  version: "1.0.0"
tools:
  - name: query_games
    inputSchema:
      type: object
      properties: {}
`;

describe('loadMcpDescFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mcptest-mcpdesc-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('auto-detects and parses a JSON mcpdesc file', async () => {
    const file = join(dir, 'server.mcpdesc.json');
    const raw = JSON.stringify(MCPDESC, null, 2);
    await writeFile(file, raw, 'utf-8');

    const { mcpdesc, rawContent } = await loadMcpDescFile(file);
    expect(mcpdesc.mcpdesc).toBe('0.6.0');
    expect(mcpdesc.info.name).toBe('chess-coach');
    expect(rawContent).toBe(raw);
  });

  it('auto-detects and parses a YAML mcpdesc file', async () => {
    const file = join(dir, 'server.mcpdesc.yaml');
    await writeFile(file, YAML_MCPDESC, 'utf-8');

    const { mcpdesc } = await loadMcpDescFile(file);
    expect(mcpdesc.mcpdesc).toBe('0.6.0');
    expect(mcpdesc.tools?.[0].name).toBe('query_games');
  });

  it('honors an explicit format override', async () => {
    const file = join(dir, 'server.txt');
    await writeFile(file, YAML_MCPDESC, 'utf-8');

    const { mcpdesc } = await loadMcpDescFile(file, 'yaml');
    expect(mcpdesc.info.version).toBe('1.0.0');
  });

  it('throws a descriptive error for unreadable files', async () => {
    await expect(loadMcpDescFile(join(dir, 'missing.json'))).rejects.toThrow(/Failed to read mcpdesc file/);
  });

  it('throws a descriptive error for malformed JSON', async () => {
    const file = join(dir, 'broken.json');
    await writeFile(file, '{ not valid json', 'utf-8');

    await expect(loadMcpDescFile(file)).rejects.toThrow(/Failed to parse mcpdesc file as JSON/);
  });
});
