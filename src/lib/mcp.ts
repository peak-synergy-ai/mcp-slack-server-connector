import axios from 'axios';
import { MCPTool, MCPRequest, MCPResponse, MCPToolDefinition, MCPError } from '../types';

export class MCPService {
  private tools: Map<string, MCPTool> = new Map();
  private connections: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultTools();
  }

  private async initializeDefaultTools() {
    // Initialize with some common MCP tools
    const defaultTools: Partial<MCPTool>[] = [
      {
        id: 'file-system',
        name: 'file-system',
        description: 'Read, write, and manage files and directories',
        version: '1.0.0',
        enabled: true,
        config: {
          endpoint: 'internal://file-system',
          timeout: 30000
        },
        permissions: ['read', 'write', 'list'],
        channels: [] // Available in all channels by default
      },
      {
        id: 'web-search',
        name: 'web-search',
        description: 'Search the web for information',
        version: '1.0.0',
        enabled: true,
        config: {
          endpoint: 'internal://web-search',
          timeout: 15000
        },
        permissions: ['search'],
        channels: []
      },
      {
        id: 'git',
        name: 'git',
        description: 'Git repository operations and version control',
        version: '1.0.0',
        enabled: true,
        config: {
          endpoint: 'internal://git',
          timeout: 30000
        },
        permissions: ['read', 'write', 'execute'],
        channels: []
      }
    ];

    for (const toolData of defaultTools) {
      const tool: MCPTool = {
        ...toolData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as MCPTool;
      
      this.tools.set(tool.id, tool);
    }
  }

  async registerTool(toolData: Partial<MCPTool>): Promise<MCPTool> {
    const tool: MCPTool = {
      id: toolData.id || this.generateToolId(),
      name: toolData.name!,
      description: toolData.description!,
      version: toolData.version || '1.0.0',
      enabled: toolData.enabled ?? true,
      config: toolData.config || {},
      permissions: toolData.permissions || [],
      channels: toolData.channels || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate tool configuration
    await this.validateTool(tool);

    // Initialize connection if needed
    if (tool.config.endpoint && !tool.config.endpoint.startsWith('internal://')) {
      await this.initializeConnection(tool);
    }

    this.tools.set(tool.id, tool);
    return tool;
  }

  async updateTool(toolId: string, updates: Partial<MCPTool>): Promise<MCPTool> {
    const existingTool = this.tools.get(toolId);
    if (!existingTool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    const updatedTool: MCPTool = {
      ...existingTool,
      ...updates,
      id: toolId, // Prevent ID changes
      updatedAt: new Date()
    };

    await this.validateTool(updatedTool);
    this.tools.set(toolId, updatedTool);
    
    return updatedTool;
  }

  async deleteTool(toolId: string): Promise<void> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    // Clean up connection
    if (this.connections.has(toolId)) {
      await this.closeConnection(toolId);
    }

    this.tools.delete(toolId);
  }

  async executeTool(toolId: string, input: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    if (!tool.enabled) {
      throw new Error(`Tool ${toolId} is disabled`);
    }

    try {
      if (tool.config.endpoint?.startsWith('internal://')) {
        return await this.executeInternalTool(tool, input);
      } else {
        return await this.executeExternalTool(tool, input);
      }
    } catch (error) {
      console.error(`Error executing tool ${toolId}:`, error);
      throw error;
    }
  }

  private async executeInternalTool(tool: MCPTool, input: Record<string, unknown>): Promise<unknown> {
    const toolType = tool.config.endpoint?.replace('internal://', '');

    switch (toolType) {
      case 'file-system':
        return await this.executeFileSystemTool(input);
      case 'web-search':
        return await this.executeWebSearchTool(input);
      case 'git':
        return await this.executeGitTool(input);
      default:
        throw new Error(`Unknown internal tool type: ${toolType}`);
    }
  }

  private async executeFileSystemTool(input: Record<string, unknown>): Promise<unknown> {
    const { action, path, content } = input as { action: string; path: string; content?: string };
    
    // This is a simplified implementation
    // In production, you'd want proper sandboxing and security
    switch (action) {
      case 'read':
        return { content: `Mock file content from ${path}`, path };
      case 'write':
        return { success: true, path, bytesWritten: content?.length || 0 };
      case 'list':
        return { 
          files: ['file1.txt', 'file2.js', 'folder1/'], 
          path: path || './' 
        };
      default:
        throw new Error(`Unsupported file system action: ${action}`);
    }
  }

  private async executeWebSearchTool(input: Record<string, unknown>): Promise<unknown> {
    const { searchQuery, maxResults = 5 } = input as { searchQuery: string; maxResults: number };
    
    // Mock search results - in production, integrate with actual search APIs
    return {
      query: searchQuery,
      results: [
        {
          title: `Search result for "${searchQuery}"`,
          url: `https://example.com/search?q=${encodeURIComponent(searchQuery)}`,
          snippet: `This is a mock search result for the query: ${searchQuery}`
        }
      ],
      totalResults: 1
    };
  }

  private async executeGitTool(input: Record<string, unknown>): Promise<unknown> {
    const { action, repository, branch } = input as { action: string; repository?: string; branch?: string };
    
    // Mock git operations
    switch (action) {
      case 'status':
        return {
          branch: branch || 'main',
          changes: ['modified: src/app.ts', 'new file: lib/new-feature.ts'],
          clean: false
        };
      case 'log':
        return {
          commits: [
            { hash: 'abc123', message: 'Add new feature', author: 'Developer', date: new Date() }
          ]
        };
      default:
        throw new Error(`Unsupported git action: ${action}`);
    }
  }

  private async executeExternalTool(tool: MCPTool, input: Record<string, unknown>): Promise<unknown> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'tools/call',
      params: {
        name: tool.name,
        arguments: input
      }
    };

    const response = await axios.post(tool.config.endpoint!, request, {
      timeout: tool.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...tool.config.headers
      }
    });

    const mcpResponse: MCPResponse = response.data;
    
    if (mcpResponse.error) {
      throw new Error(`MCP tool error: ${mcpResponse.error.message}`);
    }

    return mcpResponse.result;
  }

  async getToolsForChannel(channelId: string): Promise<MCPTool[]> {
    return Array.from(this.tools.values()).filter(tool => 
      tool.enabled && (
        tool.channels.length === 0 || // Available in all channels
        tool.channels.includes(channelId)
      )
    );
  }

  async getAllTools(): Promise<MCPTool[]> {
    return Array.from(this.tools.values());
  }

  async getTool(toolId: string): Promise<MCPTool | undefined> {
    return this.tools.get(toolId);
  }

  async getToolDefinitions(toolId: string): Promise<MCPToolDefinition[]> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    // Return mock tool definitions - in production, fetch from actual MCP server
    return [
      {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The input query or request'
            }
          },
          required: ['query']
        }
      }
    ];
  }

  private async validateTool(tool: MCPTool): Promise<void> {
    if (!tool.name || !tool.description) {
      throw new Error('Tool name and description are required');
    }

    if (tool.config.endpoint && !this.isValidEndpoint(tool.config.endpoint)) {
      throw new Error('Invalid tool endpoint URL');
    }

    // Additional validation logic here
  }

  private isValidEndpoint(endpoint: string): boolean {
    if (endpoint.startsWith('internal://')) {
      return true;
    }
    
    try {
      new URL(endpoint);
      return true;
    } catch {
      return false;
    }
  }

  private async initializeConnection(tool: MCPTool): Promise<void> {
    // Initialize connection to external MCP server
    // This would include protocol negotiation, capability discovery, etc.
    console.log(`Initializing connection to MCP tool: ${tool.name}`);
  }

  private async closeConnection(toolId: string): Promise<void> {
    this.connections.delete(toolId);
    console.log(`Closed connection for tool: ${toolId}`);
  }

  private generateToolId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Health check for tools
  async checkToolHealth(toolId: string): Promise<{ healthy: boolean; error?: string }> {
    try {
      const tool = this.tools.get(toolId);
      if (!tool) {
        return { healthy: false, error: 'Tool not found' };
      }

      if (!tool.enabled) {
        return { healthy: false, error: 'Tool is disabled' };
      }

      // For external tools, ping the endpoint
      if (tool.config.endpoint && !tool.config.endpoint.startsWith('internal://')) {
        await axios.get(tool.config.endpoint, { timeout: 5000 });
      }

      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}