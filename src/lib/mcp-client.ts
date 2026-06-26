// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * MCP Client wrapper for test execution
 * Wraps @modelcontextprotocol/sdk Client with test-friendly API
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCPConnectionError, type MCPClientConfig, type MCPToolInfo, type ToolResult } from './types.js';

export class MCPTestClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport | null = null;
  private connected = false;

  /**
   * Connect to MCP server
   */
  async connect(config: MCPClientConfig): Promise<void> {
    if (this.connected) {
      throw new MCPConnectionError('Client already connected');
    }

    try {
      if (config.transport === 'stdio') {
        await this.connectStdio(config);
      } else if (config.transport === 'sse' || config.transport === 'http') {
        await this.connectSSE(config);
      } else if (config.transport === 'streamable-http') {
        await this.connectStreamableHTTP(config);
      } else {
        throw new MCPConnectionError(`Transport ${config.transport} not supported`);
      }

      this.connected = true;
    } catch (error) {
      throw new MCPConnectionError(
        `Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`,
        config.serverUrl
      );
    }
  }

  /**
   * Connect via stdio transport
   */
  private async connectStdio(config: MCPClientConfig): Promise<void> {
    // Parse command and args from serverUrl
    // Format options:
    //   - "stdio://command?args=arg1,arg2,arg3"
    //   - "stdio:///full/path/to/command?args=arg1,arg2,arg3"
    const url = new URL(config.serverUrl);
    
    // Handle both hostname (command) and pathname (full path)
    let command: string;
    if (url.pathname && url.pathname !== '/' && url.pathname !== '') {
      // Full path: stdio:///path/to/command
      command = url.pathname;
    } else if (url.hostname) {
      // Command name: stdio://python
      command = url.hostname;
    } else {
      throw new MCPConnectionError('Invalid server URL: no command specified');
    }
    
    const argsParam = url.searchParams.get('args');
    const args = argsParam ? argsParam.split(',') : [];

    this.transport = new StdioClientTransport({
      command,
      args,
      env: config.env,
    });

    this.client = new Client(
      {
        name: 'mcptest-client',
        version: '0.2.0',
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);
  }

  /**
   * Connect via SSE (Server-Sent Events) transport for HTTP
   */
  private async connectSSE(config: MCPClientConfig): Promise<void> {
    // Parse HTTP URL
    // Format: "http://localhost:3000" or "sse://localhost:3000"
    let url = config.serverUrl;
    
    // Convert sse:// to http:// for the transport
    if (url.startsWith('sse://')) {
      url = url.replace('sse://', 'http://');
    }
    
    // Ensure it's an http/https URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new MCPConnectionError('SSE/HTTP transport requires http:// or https:// URL');
    }

    this.transport = new SSEClientTransport(new URL(url), {
      requestInit: config.headers ? { headers: config.headers } : undefined,
    });

    this.client = new Client(
      {
        name: 'mcptest-client',
        version: '0.2.0',
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);
  }

  /**
   * Connect via Streamable HTTP transport (standardized June 2025)
   */
  private async connectStreamableHTTP(config: MCPClientConfig): Promise<void> {
    // Parse HTTP URL
    // Format: "http://localhost:3000" or "streamable-http://localhost:3000"
    let url = config.serverUrl;
    
    // Convert streamable-http:// to http:// for the transport
    if (url.startsWith('streamable-http://')) {
      url = url.replace('streamable-http://', 'http://');
    }
    
    // Ensure it's an http/https URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new MCPConnectionError('Streamable HTTP transport requires http:// or https:// URL');
    }

    this.transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: config.headers ? { headers: config.headers } : undefined,
    });

    this.client = new Client(
      {
        name: 'mcptest-client',
        version: '0.2.0',
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);
  }

  /**
   * List available tools from server
   */
  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.client || !this.connected) {
      throw new MCPConnectionError('Client not connected');
    }

    try {
      const response = await this.client.listTools();
      return response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      }));
    } catch (error) {
      throw new MCPConnectionError(
        `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Call a tool and return result with timing
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    if (!this.client || !this.connected) {
      throw new MCPConnectionError('Client not connected');
    }

    const startTime = Date.now();

    try {
      const response = await this.client.callTool({
        name,
        arguments: args,
      });

      const duration = Date.now() - startTime;

      // Check if response indicates error
      if (response.isError) {
        const content = response.content as Array<{ type: string; text?: string }>;
        return {
          toolName: name,
          success: false,
          duration,
          error: {
            code: 'ToolExecutionError',
            message: content[0]?.text || 'Unknown error',
          },
        };
      }

      // Extract result from content
      const content = response.content as Array<{ type: string; text?: string }>;
      const textContent = content.find((c: { type: string; text?: string }) => c.type === 'text');
      let result: unknown = null;

      if (textContent && 'text' in textContent && textContent.text) {
        try {
          // Try to parse as JSON if it looks like JSON
          result = JSON.parse(textContent.text);
        } catch {
          // Otherwise use as string
          result = textContent.text;
        }
      }

      return {
        toolName: name,
        success: true,
        duration,
        result,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        toolName: name,
        success: false,
        duration,
        error: {
          code: 'CallToolError',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Disconnect from server
   */
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      try {
        await this.client.close();
      } catch (error) {
        // Ignore disconnect errors
      }
      this.client = null;
      this.transport = null;
      this.connected = false;
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
