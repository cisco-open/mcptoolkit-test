// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScenarioLoader } from '../../src/lib/scenario-loader.js';
import { ScenarioValidationError } from '../../src/lib/types.js';

const VALID_SCENARIO = `name: "query_games - basic test"
description: "Verify query_games returns results"
tools:
  - name: "query_games"
    arguments:
      limit: 5
    assertions:
      - type: "response-type"
        expected: "array"
`;

describe('ScenarioLoader', () => {
  let dir: string;
  let loader: ScenarioLoader;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mcptest-scenario-'));
    loader = new ScenarioLoader();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads a valid scenario from YAML', async () => {
    const file = join(dir, 'valid.yaml');
    await writeFile(file, VALID_SCENARIO, 'utf-8');

    const scenario = await loader.loadScenario(file);
    expect(scenario.name).toBe('query_games - basic test');
    expect(scenario.tools).toHaveLength(1);
    expect(scenario.tools[0].name).toBe('query_games');
  });

  it('validates against the JSON schema when loaded', async () => {
    await loader.loadSchema();
    const file = join(dir, 'invalid-schema.yaml');
    // tools entry missing required `name`
    await writeFile(file, 'name: "bad"\ntools:\n  - arguments:\n      x: 1\n', 'utf-8');

    await expect(loader.loadScenario(file)).rejects.toBeInstanceOf(ScenarioValidationError);
  });

  it('throws when the scenario has no name', async () => {
    const file = join(dir, 'no-name.yaml');
    await writeFile(file, 'tools:\n  - name: "t"\n', 'utf-8');

    await expect(loader.loadScenario(file)).rejects.toThrow(/name/i);
  });

  it('throws when the scenario has no tools', async () => {
    const file = join(dir, 'no-tools.yaml');
    await writeFile(file, 'name: "empty"\ntools: []\n', 'utf-8');

    await expect(loader.loadScenario(file)).rejects.toThrow(/at least one tool/i);
  });

  it('wraps malformed YAML in a ScenarioValidationError', async () => {
    const file = join(dir, 'broken.yaml');
    await writeFile(file, 'name: "x"\ntools: [unclosed\n', 'utf-8');

    await expect(loader.loadScenario(file)).rejects.toBeInstanceOf(ScenarioValidationError);
  });

  it('loads all scenarios from a directory', async () => {
    await writeFile(join(dir, 'a.yaml'), VALID_SCENARIO, 'utf-8');
    await writeFile(join(dir, 'b.yml'), VALID_SCENARIO, 'utf-8');

    const scenarios = await loader.loadScenarios(dir);
    expect(scenarios).toHaveLength(2);
  });

  it('skips invalid files but keeps valid ones in a directory', async () => {
    await writeFile(join(dir, 'good.yaml'), VALID_SCENARIO, 'utf-8');
    await writeFile(join(dir, 'bad.yaml'), 'name: "x"\ntools: []\n', 'utf-8');

    const scenarios = await loader.loadScenarios(dir);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].name).toBe('query_games - basic test');
  });

  it('throws when a directory has no valid scenarios', async () => {
    await writeFile(join(dir, 'bad.yaml'), 'name: "x"\ntools: []\n', 'utf-8');

    await expect(loader.loadScenarios(dir)).rejects.toBeInstanceOf(ScenarioValidationError);
  });

  it('loads a single file via loadScenarios', async () => {
    const file = join(dir, 'single.yaml');
    await writeFile(file, VALID_SCENARIO, 'utf-8');

    const scenarios = await loader.loadScenarios(file);
    expect(scenarios).toHaveLength(1);
  });
});
