// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScenarioGenerator, type CoverageStrategy } from '../../src/lib/scenario-generator.js';
import { ScenarioLoader } from '../../src/lib/scenario-loader.js';
import type { McpDescFile } from '../../src/lib/types.js';

const MCPDESC: McpDescFile = {
  mcpdesc: '0.6.0',
  info: { name: 'chess-coach', version: '1.0.0' },
  tools: [
    {
      name: 'query_games',
      description: 'Query chess games',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1 },
          color: { type: 'string', enum: ['white', 'black'] },
          verbose: { type: 'boolean' },
        },
        required: ['limit'],
      },
    },
  ],
};

async function generate(dir: string, coverage: CoverageStrategy) {
  const generator = new ScenarioGenerator({
    mcpdesc: MCPDESC,
    outputDir: dir,
    coverage,
  });
  return generator.generate();
}

describe('ScenarioGenerator', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mcptest-generate-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('generates basic happy-path scenarios', async () => {
    const stats = await generate(dir, 'basic');
    expect(stats.toolsProcessed).toBe(1);
    expect(stats.scenariosGenerated).toBeGreaterThanOrEqual(1);
    expect(stats.errors).toHaveLength(0);

    const files = await readdir(dir);
    expect(files.length).toBe(stats.filesCreated);
  });

  it('generates more scenarios for full than basic coverage', async () => {
    const basicStats = await generate(join(dir, 'basic'), 'basic');
    const fullStats = await generate(join(dir, 'full'), 'full');
    expect(fullStats.scenariosGenerated).toBeGreaterThan(basicStats.scenariosGenerated);
  });

  it('generates edge-case scenarios including empty arguments', async () => {
    await generate(dir, 'edge-cases');
    const files = await readdir(dir);
    expect(files.some((f) => f.includes('empty-arguments'))).toBe(true);
  });

  it('produces scenarios that validate against the scenario schema', async () => {
    await generate(dir, 'edge-cases');

    const loader = new ScenarioLoader();
    await loader.loadSchema();

    const files = (await readdir(dir)).filter((f) => f.endsWith('.yaml'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const scenario = await loader.loadScenario(join(dir, file));
      expect(scenario.name).toBeTruthy();
      expect(scenario.tools.length).toBeGreaterThan(0);
      expect(scenario.tools[0].name).toBe('query_games');
    }
  });

  it('uses required parameters in generated arguments', async () => {
    await generate(dir, 'basic');
    const loader = new ScenarioLoader();
    const files = (await readdir(dir)).filter((f) => f.endsWith('.yaml'));

    const minimal = files.find((f) => f.includes('minimal-arguments'));
    expect(minimal).toBeDefined();

    const scenario = await loader.loadScenario(join(dir, minimal!));
    expect(scenario.tools[0].arguments).toHaveProperty('limit');
  });
});
