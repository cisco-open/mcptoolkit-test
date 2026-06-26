// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

import { jest } from '@jest/globals';
import type { MCPClientConfig, Scenario, ToolResult } from '../../src/lib/types.js';

// Mock the MCP client so the executor never touches a real server.
const callTool = jest.fn<(name: string, args: unknown) => Promise<ToolResult>>();
const connect = jest.fn<(config: MCPClientConfig) => Promise<void>>();
const isConnected = jest.fn<() => boolean>();
const disconnect = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('../../src/lib/mcp-client.js', () => ({
  MCPTestClient: jest.fn().mockImplementation(() => ({
    isConnected,
    connect,
    callTool,
    disconnect,
  })),
}));

const { TestExecutor } = await import('../../src/lib/test-executor.js');

const CONFIG: MCPClientConfig = { serverUrl: 'http://localhost:8000', transport: 'streamable-http' };

function toolResult(overrides: Partial<ToolResult> = {}): ToolResult {
  return { toolName: 'query_games', success: true, duration: 1, result: 'ok', ...overrides };
}

function scenario(assertions: Scenario['tools'][number]['assertions']): Scenario {
  return { name: 'test', tools: [{ name: 'query_games', arguments: {}, assertions }] };
}

describe('TestExecutor assertion engine', () => {
  beforeEach(() => {
    callTool.mockReset();
    connect.mockReset();
    disconnect.mockReset();
    isConnected.mockReset().mockReturnValue(false);
  });

  async function run(result: ToolResult, assertions: Scenario['tools'][number]['assertions']) {
    callTool.mockResolvedValue(result);
    const executor = new TestExecutor();
    return executor.executeScenario(scenario(assertions), CONFIG);
  }

  it('passes a response-type assertion for matching types', async () => {
    const res = await run(toolResult({ result: [1, 2] }), [{ type: 'response-type', expected: 'object' }]);
    expect(res.passed).toBe(true);
    expect(res.toolResults[0].assertions?.[0].passed).toBe(true);
  });

  it('fails a response-type assertion for mismatched types', async () => {
    const res = await run(toolResult({ result: 'hello' }), [{ type: 'response-type', expected: 'object' }]);
    expect(res.passed).toBe(false);
    expect(res.toolResults[0].assertions?.[0].passed).toBe(false);
  });

  it('evaluates an error assertion', async () => {
    const res = await run(toolResult({ success: false }), [{ type: 'error', expected: true }]);
    expect(res.toolResults[0].assertions?.[0].passed).toBe(true);
  });

  it('evaluates an error-code assertion', async () => {
    const res = await run(
      toolResult({ success: false, error: { code: 'E_NOT_FOUND', message: 'x' } }),
      [{ type: 'error-code', expected: 'E_NOT_FOUND' }]
    );
    expect(res.toolResults[0].assertions?.[0].passed).toBe(true);
  });

  it('evaluates a contains-text assertion', async () => {
    const res = await run(toolResult({ result: 'hello world' }), [
      { type: 'contains-text', expected: 'world' },
    ]);
    expect(res.toolResults[0].assertions?.[0].passed).toBe(true);
  });

  it('fails contains-text when the result is not a string', async () => {
    const res = await run(toolResult({ result: [1] }), [{ type: 'contains-text', expected: 'x' }]);
    const assertion = res.toolResults[0].assertions?.[0];
    expect(assertion?.passed).toBe(false);
    expect(assertion?.message).toMatch(/not a string/i);
  });

  it('evaluates array-length assertions', async () => {
    const res = await run(toolResult({ result: [1, 2, 3] }), [{ type: 'array-length', expected: 3 }]);
    expect(res.toolResults[0].assertions?.[0].passed).toBe(true);
  });

  it('evaluates array-length-max assertions', async () => {
    const res = await run(toolResult({ result: [1, 2] }), [{ type: 'array-length-max', expected: 5 }]);
    expect(res.toolResults[0].assertions?.[0].passed).toBe(true);
  });

  it('fails array-length when the result is not an array', async () => {
    const res = await run(toolResult({ result: 'nope' }), [{ type: 'array-length', expected: 1 }]);
    const assertion = res.toolResults[0].assertions?.[0];
    expect(assertion?.passed).toBe(false);
    expect(assertion?.message).toMatch(/not an array/i);
  });

  it('fails on an unknown assertion type', async () => {
    const res = await run(toolResult(), [{ type: 'totally-unknown' as never, expected: 1 }]);
    const assertion = res.toolResults[0].assertions?.[0];
    expect(assertion?.passed).toBe(false);
    expect(assertion?.message).toMatch(/unknown assertion type/i);
  });

  it('marks the scenario failed if any assertion fails', async () => {
    const res = await run(toolResult({ result: [1] }), [
      { type: 'array-length', expected: 1 },
      { type: 'array-length', expected: 99 },
    ]);
    expect(res.passed).toBe(false);
  });

  it('captures errors thrown during execution', async () => {
    callTool.mockRejectedValue(new Error('connection lost'));
    const executor = new TestExecutor();
    const res = await executor.executeScenario(scenario([]), CONFIG);
    expect(res.passed).toBe(false);
    expect(res.error).toMatch(/connection lost/);
  });

  it('connects only when not already connected', async () => {
    isConnected.mockReturnValue(true);
    callTool.mockResolvedValue(toolResult());
    const executor = new TestExecutor();
    await executor.executeScenario(scenario([]), CONFIG);
    expect(connect).not.toHaveBeenCalled();
  });
});
