// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Scenario loader - Load and validate YAML test scenarios
 */

import { readFile, stat, readdir } from 'node:fs/promises';
import { parse as parseYAML } from 'yaml';
import Ajv, { type ValidateFunction } from 'ajv';
import { ScenarioValidationError, type Scenario } from './types.js';

export class ScenarioLoader {
  private validator: ValidateFunction | null = null;

  /**
   * Load schema for validation
   */
  async loadSchema(): Promise<void> {
    const schemaPath = new URL('../../schemas/scenario-schema.json', import.meta.url).pathname;
    
    try {
      const schemaContent = await readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);
      
      const ajv = new Ajv({ allErrors: true });
      this.validator = ajv.compile(schema);
    } catch (error) {
      throw new ScenarioValidationError(
        `Failed to load schema: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load and validate scenario from YAML file
   */
  async loadScenario(filePath: string): Promise<Scenario> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const scenario = parseYAML(content) as Scenario;

      // Validate against schema if loaded
      if (this.validator) {
        const valid = this.validator(scenario);
        if (!valid) {
          const errors = this.validator.errors || [];
          const errorMessages = errors.map((err) => `${err.instancePath} ${err.message}`).join(', ');
          throw new ScenarioValidationError(`Invalid scenario: ${errorMessages}`, filePath);
        }
      }

      // Additional validation
      if (!scenario.name) {
        throw new ScenarioValidationError('Scenario must have a name', filePath);
      }

      if (!scenario.tools || scenario.tools.length === 0) {
        throw new ScenarioValidationError('Scenario must contain at least one tool call', filePath);
      }

      return scenario;
    } catch (error) {
      if (error instanceof ScenarioValidationError) {
        throw error;
      }
      throw new ScenarioValidationError(
        `Failed to load scenario: ${error instanceof Error ? error.message : String(error)}`,
        filePath
      );
    }
  }

  /**
   * Load multiple scenarios from a directory or file
   */
  async loadScenarios(path: string): Promise<Scenario[]> {
    const stats = await stat(path);
    
    if (stats.isFile()) {
      // Single file
      const scenario = await this.loadScenario(path);
      return [scenario];
    } else if (stats.isDirectory()) {
      // Directory - load all .yaml and .yml files
      const files = await readdir(path);
      const yamlFiles = files.filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
      
      const scenarios: Scenario[] = [];
      for (const file of yamlFiles) {
        const filePath = `${path}/${file}`;
        try {
          const scenario = await this.loadScenario(filePath);
          scenarios.push(scenario);
        } catch (error) {
          // Log error but continue with other files
          console.error(`Failed to load ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (scenarios.length === 0) {
        throw new ScenarioValidationError(`No valid scenarios found in directory: ${path}`);
      }
      
      return scenarios;
    } else {
      throw new ScenarioValidationError(`Invalid path: ${path}`);
    }
  }
}
