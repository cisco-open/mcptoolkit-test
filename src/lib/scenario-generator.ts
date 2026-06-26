// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Scenario Generator
 * 
 * Automatically generates YAML test scenarios from mcpdesc (MCP Server Description) files.
 * Supports multiple coverage strategies and generates realistic test cases.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import YAML from 'yaml';
import type { McpDescFile, Tool, ToolInputSchema, Scenario, ToolCall, Assertion } from './types.js';

/**
 * Coverage strategies for scenario generation
 */
export type CoverageStrategy = 'basic' | 'full' | 'edge-cases';

/**
 * Generation options
 */
export interface GenerationOptions {
  mcpdesc: McpDescFile;
  outputDir: string;
  coverage: CoverageStrategy;
  merge?: boolean;
  verbose?: boolean;
}

/**
 * Generation statistics
 */
export interface GenerationStats {
  toolsProcessed: number;
  scenariosGenerated: number;
  filesCreated: number;
  errors: string[];
}

/**
 * ScenarioGenerator - Auto-generates test scenarios from mcpdesc files
 */
export class ScenarioGenerator {
  private stats: GenerationStats = {
    toolsProcessed: 0,
    scenariosGenerated: 0,
    filesCreated: 0,
    errors: []
  };

  constructor(private options: GenerationOptions) {}

  /**
   * Generate all scenarios
   */
  async generate(): Promise<GenerationStats> {
    this.log('Starting scenario generation...');
    this.log(`Coverage strategy: ${this.options.coverage}`);
    
    // Create output directory
    await mkdir(this.options.outputDir, { recursive: true });
    
    // Process each tool
    const tools = this.options.mcpdesc.tools || [];
    this.log(`Found ${tools.length} tool(s) in mcpdesc`);
    
    for (const tool of tools) {
      try {
        await this.generateForTool(tool);
        this.stats.toolsProcessed++;
      } catch (error) {
        const errorMsg = `Error generating scenarios for ${tool.name}: ${error instanceof Error ? error.message : String(error)}`;
        this.stats.errors.push(errorMsg);
        this.log(errorMsg);
      }
    }
    
    return this.stats;
  }

  /**
   * Generate scenarios for a single tool
   */
  private async generateForTool(tool: Tool): Promise<void> {
    this.log(`Generating scenarios for: ${tool.name}`);
    
    const scenarios: Scenario[] = [];
    
    // Generate based on coverage strategy
    switch (this.options.coverage) {
      case 'basic':
        scenarios.push(...this.generateBasicScenarios(tool));
        break;
      case 'full':
        scenarios.push(...this.generateBasicScenarios(tool));
        scenarios.push(...this.generateParameterVariations(tool));
        break;
      case 'edge-cases':
        scenarios.push(...this.generateBasicScenarios(tool));
        scenarios.push(...this.generateParameterVariations(tool));
        scenarios.push(...this.generateEdgeCases(tool));
        break;
    }
    
    // Save each scenario to a file
    for (const scenario of scenarios) {
      await this.saveScenario(scenario, tool.name);
      this.stats.scenariosGenerated++;
    }
  }

  /**
   * Generate basic test scenarios (happy path)
   */
  private generateBasicScenarios(tool: Tool): Scenario[] {
    const scenarios: Scenario[] = [];
    
    // Basic success case
    const basicArgs = this.generateExampleArguments(tool.inputSchema);
    scenarios.push({
      name: `${tool.name} - basic test`,
      description: `Verify ${tool.name} returns successful response`,
      tools: [{
        name: tool.name,
        arguments: basicArgs,
        assertions: this.generateBasicAssertions()
      }]
    });
    
    // Minimal arguments (only required fields)
    const minimalArgs = this.generateMinimalArguments(tool.inputSchema);
    if (Object.keys(minimalArgs).length !== Object.keys(basicArgs).length) {
      scenarios.push({
        name: `${tool.name} - minimal arguments`,
        description: `Test ${tool.name} with only required parameters`,
        tools: [{
          name: tool.name,
          arguments: minimalArgs,
          assertions: this.generateBasicAssertions()
        }]
      });
    }
    
    return scenarios;
  }

  /**
   * Generate parameter variation scenarios
   */
  private generateParameterVariations(tool: Tool): Scenario[] {
    const scenarios: Scenario[] = [];
    const schema = tool.inputSchema;
    
    if (!schema?.properties) return scenarios;
    
    // Test each parameter with different values
    for (const [paramName, paramDef] of Object.entries(schema.properties)) {
      const param = paramDef as any;
      
      // Array parameter variations
      if (param.type === 'array' && param.items?.enum) {
        const baseArgs = this.generateExampleArguments(schema);
        baseArgs[paramName] = [param.items.enum[0]]; // Single enum value
        
        scenarios.push({
          name: `${tool.name} - filter by ${paramName}`,
          description: `Test ${tool.name} with ${paramName} filter`,
          tools: [{
            name: tool.name,
            arguments: baseArgs,
            assertions: this.generateBasicAssertions()
          }]
        });
      }
      
      // Enum parameter variations
      if (param.enum && Array.isArray(param.enum)) {
        const baseArgs = this.generateExampleArguments(schema);
        baseArgs[paramName] = param.enum[0];
        
        scenarios.push({
          name: `${tool.name} - ${paramName} ${param.enum[0]}`,
          description: `Test ${tool.name} with ${paramName}=${param.enum[0]}`,
          tools: [{
            name: tool.name,
            arguments: baseArgs,
            assertions: this.generateBasicAssertions()
          }]
        });
      }
      
      // Boolean parameter variations
      if (param.type === 'boolean') {
        const baseArgs = this.generateExampleArguments(schema);
        baseArgs[paramName] = true;
        
        scenarios.push({
          name: `${tool.name} - with ${paramName}`,
          description: `Test ${tool.name} with ${paramName} enabled`,
          tools: [{
            name: tool.name,
            arguments: baseArgs,
            assertions: this.generateBasicAssertions()
          }]
        });
      }
    }
    
    return scenarios;
  }

  /**
   * Generate edge case scenarios
   */
  private generateEdgeCases(tool: Tool): Scenario[] {
    const scenarios: Scenario[] = [];
    const schema = tool.inputSchema;
    
    if (!schema?.properties) return scenarios;
    
    // Empty arguments (error case)
    scenarios.push({
      name: `${tool.name} - empty arguments`,
      description: `Test ${tool.name} with no arguments (should handle gracefully)`,
      tools: [{
        name: tool.name,
        arguments: {},
        assertions: [
          { type: 'response-type', expected: 'string' }
        ]
      }]
    });
    
    // Test with maximum limit (if limit parameter exists)
    if (schema.properties['limit']) {
      const maxArgs = this.generateExampleArguments(schema);
      maxArgs['limit'] = 100;
      
      scenarios.push({
        name: `${tool.name} - maximum limit`,
        description: `Test ${tool.name} with maximum limit value`,
        tools: [{
          name: tool.name,
          arguments: maxArgs,
          assertions: this.generateBasicAssertions()
        }]
      });
    }
    
    return scenarios;
  }

  /**
   * Generate example arguments from JSON schema
   */
  private generateExampleArguments(schema?: ToolInputSchema): Record<string, any> {
    if (!schema?.properties) return {};
    
    const args: Record<string, any> = {};
    
    for (const [key, propDef] of Object.entries(schema.properties)) {
      const prop = propDef as any;
      
      // Use default value if available
      if (prop.default !== undefined) {
        args[key] = prop.default;
        continue;
      }
      
      // Generate example based on type
      switch (prop.type) {
        case 'string':
          if (prop.enum) {
            args[key] = prop.enum[0];
          } else if (prop.format === 'date') {
            args[key] = '2024-01-01';
          } else {
            args[key] = this.generateStringExample(key, prop.description);
          }
          break;
          
        case 'integer':
        case 'number':
          args[key] = prop.minimum || 10;
          break;
          
        case 'boolean':
          args[key] = false;
          break;
          
        case 'array':
          if (prop.items?.enum) {
            args[key] = [prop.items.enum[0]];
          } else {
            args[key] = [];
          }
          break;
          
        case 'object':
          args[key] = {};
          break;
      }
    }
    
    return args;
  }

  /**
   * Generate minimal arguments (only required fields)
   */
  private generateMinimalArguments(schema?: ToolInputSchema): Record<string, any> {
    if (!schema?.properties) return {};
    
    const args: Record<string, any> = {};
    const required = schema.required || [];
    
    for (const [key, propDef] of Object.entries(schema.properties)) {
      if (!required.includes(key)) continue;
      
      const prop = propDef as any;
      
      // Generate minimal example
      switch (prop.type) {
        case 'string':
          args[key] = prop.enum?.[0] || 'test';
          break;
        case 'integer':
        case 'number':
          args[key] = prop.minimum || 1;
          break;
        case 'boolean':
          args[key] = false;
          break;
        case 'array':
          args[key] = [];
          break;
        case 'object':
          args[key] = {};
          break;
      }
    }
    
    return args;
  }

  /**
   * Generate string example based on field name and description
   */
  private generateStringExample(fieldName: string, description?: string): string {
    // Heuristics based on common field names
    if (fieldName.includes('date')) return '2024-01-01';
    if (fieldName.includes('time')) return '2024-01-01T00:00:00Z';
    if (fieldName.includes('id')) return '12345';
    if (fieldName.includes('name')) return 'example';
    if (fieldName.includes('email')) return 'test@example.com';
    if (fieldName.includes('url')) return 'https://example.com';
    
    return 'test';
  }

  /**
   * Generate basic assertions
   */
  private generateBasicAssertions(): Assertion[] {
    return [
      { type: 'response-type', expected: 'string' }
    ];
  }

  /**
   * Save scenario to YAML file
   */
  private async saveScenario(scenario: Scenario, toolName: string): Promise<void> {
    // Sanitize scenario name for filename
    const fileName = scenario.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.yaml';
    
    const filePath = join(this.options.outputDir, fileName);
    
    // Create directory if needed
    await mkdir(dirname(filePath), { recursive: true });
    
    // Convert to YAML
    const yamlContent = YAML.stringify(scenario, {
      lineWidth: 0, // Disable line wrapping
      indent: 2
    });
    
    // Save file
    await writeFile(filePath, yamlContent, 'utf-8');
    this.stats.filesCreated++;
    
    this.log(`  Created: ${fileName}`);
  }

  /**
   * Log message (respects verbose flag)
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.error(`[GENERATE] ${message}`);
    }
  }
}
