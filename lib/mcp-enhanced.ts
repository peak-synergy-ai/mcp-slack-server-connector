import axios from 'axios';
import { z } from 'zod';
import { tool } from 'ai';
import { MCPTool, MCPRequest, MCPResponse, MCPToolDefinition, MCPError, MCPServer } from '../types';

export class EnhancedMCPService {
  private servers: Map<string, MCPServer> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private connections: Map<string, any> = new Map();
  private toolCache: Map<string, any> = new Map(); // Cache for Vercel AI SDK tools

  constructor() {
    this.initializeDefaultTools();
  }

  // MCP Server Management
  async addMCPServer(serverData: {
    name: string;
    description: string;
    endpoint: string;
    apiKey?: string;
    connectionType?: 'http' | 'websocket' | 'stdio';
  }): Promise<MCPServer> {
    const server: MCPServer = {
      id: this.generateServerId(),
      name: serverData.name,
      description: serverData.description,
      endpoint: serverData.endpoint,
      apiKey: serverData.apiKey,
      enabled: true,
      connectionType: serverData.connectionType || 'http',
      discoveredTools: [],
      lastDiscovery: null,
      connectionStatus: 'disconnected',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate connection and discover tools
    try {
      await this.connectToMCPServer(server);
      await this.discoverMCPTools(server.id);
      server.connectionStatus = 'connected';
    } catch (error) {
      server.connectionStatus = 'error';
      server.error = error instanceof Error ? error.message : 'Connection failed';
      console.error(`Failed to connect to MCP server ${server.name}:`, error);
    }

    this.servers.set(server.id, server);
    return server;
  }

  async updateMCPServer(serverId: string, updates: Partial<MCPServer>): Promise<MCPServer> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    const updated = { ...server, ...updates, updatedAt: new Date() };
    
    // If endpoint or connection details changed, reconnect and rediscover
    if (updates.endpoint || updates.apiKey || updates.connectionType) {
      try {
        await this.connectToMCPServer(updated);
        await this.discoverMCPTools(serverId);
        updated.connectionStatus = 'connected';
        updated.error = undefined;
      } catch (error) {
        updated.connectionStatus = 'error';
        updated.error = error instanceof Error ? error.message : 'Connection failed';
      }
    }

    this.servers.set(serverId, updated);
    return updated;
  }

  async deleteMCPServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    // Remove all tools from this server
    const serverTools = Array.from(this.tools.values()).filter(
      tool => tool.config.serverId === serverId
    );
    
    for (const tool of serverTools) {
      this.tools.delete(tool.id);
      this.toolCache.delete(tool.id);
    }

    // Close connection
    if (this.connections.has(serverId)) {
      await this.closeConnection(serverId);
    }

    this.servers.delete(serverId);
  }

  // Tool Discovery
  async discoverMCPTools(serverId: string): Promise<MCPToolDefinition[]> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      const discoveredTools = await this.performToolDiscovery(server);
      
      // Update server with discovered tools
      server.discoveredTools = discoveredTools;
      server.lastDiscovery = new Date();
      server.updatedAt = new Date();
      
      // Create MCPTool objects for each discovered tool
      for (const toolDef of discoveredTools) {
        await this.createToolFromDefinition(toolDef, serverId);
      }

      // Refresh Vercel AI SDK tool cache
      await this.refreshVercelAIToolCache();

      return discoveredTools;
    } catch (error) {
      server.connectionStatus = 'error';
      server.error = `Tool discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    }
  }

  async refreshAllMCPServers(): Promise<void> {
    const servers = Array.from(this.servers.values()).filter(s => s.enabled);
    
    await Promise.allSettled(
      servers.map(async (server) => {
        try {
          await this.discoverMCPTools(server.id);
        } catch (error) {
          console.error(`Failed to refresh MCP server ${server.name}:`, error);
        }
      })
    );
  }

  private async performToolDiscovery(server: MCPServer): Promise<MCPToolDefinition[]> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'tools/list',
      params: {}
    };

    const response = await this.sendMCPRequest(server, request);
    
    if (response.error) {
      throw new Error(`MCP tool discovery error: ${response.error.message}`);
    }

    return response.result?.tools || [];
  }

  private async createToolFromDefinition(toolDef: MCPToolDefinition, serverId: string): Promise<MCPTool> {
    const toolId = `${serverId}_${toolDef.name}`;
    
    const tool: MCPTool = {
      id: toolId,
      name: toolDef.name,
      description: toolDef.description,
      version: '1.0.0',
      enabled: true,
      config: {
        serverId,
        schema: toolDef.inputSchema,
        endpoint: 'mcp://' + serverId
      },
      permissions: [],
      channels: [], // Available in all channels by default
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.tools.set(toolId, tool);
    return tool;
  }

  // Vercel AI SDK Integration
  async getVercelAITools(channelId?: string): Promise<Record<string, any>> {
    const availableTools = channelId 
      ? await this.getToolsForChannel(channelId)
      : Array.from(this.tools.values()).filter(t => t.enabled);

    const vercelTools: Record<string, any> = {};

    for (const mcpTool of availableTools) {
      // Check if tool is already cached
      if (this.toolCache.has(mcpTool.id)) {
        vercelTools[mcpTool.name] = this.toolCache.get(mcpTool.id);
        continue;
      }

      // Create Vercel AI SDK tool
      const vercelTool = tool({
        description: mcpTool.description,
        parameters: this.createZodSchemaFromMCP(mcpTool),
        execute: async (params: any) => {
          return await this.executeMCPTool(mcpTool.id, params);
        }
      });

      // Cache the tool
      this.toolCache.set(mcpTool.id, vercelTool);
      vercelTools[mcpTool.name] = vercelTool;
    }

    return vercelTools;
  }

  private createZodSchemaFromMCP(mcpTool: MCPTool): z.ZodSchema {
    if (!mcpTool.config.schema) {
      // Fallback to generic schema
      return z.object({
        input: z.any().describe('Tool input parameters')
      });
    }

    const schema = mcpTool.config.schema;
    return this.convertJSONSchemaToZod(schema);
  }

  private convertJSONSchemaToZod(jsonSchema: any): z.ZodSchema {
    // Convert JSON Schema to Zod schema
    // This is a simplified implementation - you might want to use a library like json-schema-to-zod
    
    if (jsonSchema.type === 'object') {
      const shape: Record<string, z.ZodType> = {};
      
      for (const [key, prop] of Object.entries(jsonSchema.properties || {})) {
        const propSchema = prop as any;
        
        switch (propSchema.type) {
          case 'string':
            let stringSchema = z.string();
            if (propSchema.description) stringSchema = stringSchema.describe(propSchema.description);
            if (propSchema.enum) stringSchema = z.enum(propSchema.enum);
            shape[key] = stringSchema;
            break;
            
          case 'number':
            let numberSchema = z.number();
            if (propSchema.description) numberSchema = numberSchema.describe(propSchema.description);
            shape[key] = numberSchema;
            break;
            
          case 'boolean':
            let boolSchema = z.boolean();
            if (propSchema.description) boolSchema = boolSchema.describe(propSchema.description);
            shape[key] = boolSchema;
            break;
            
          case 'array':
            shape[key] = z.array(z.any()).describe(propSchema.description || `Array of items`);
            break;
            
          default:
            shape[key] = z.any().describe(propSchema.description || `Any type`);
        }
        
        // Make optional if not in required array
        if (!jsonSchema.required?.includes(key)) {
          shape[key] = shape[key].optional();
        }
      }
      
      return z.object(shape);
    }
    
    return z.any();
  }

  private async refreshVercelAIToolCache(): Promise<void> {
    // Clear the cache to force regeneration
    this.toolCache.clear();
  }

  // MCP Communication
  private async connectToMCPServer(server: MCPServer): Promise<void> {
    switch (server.connectionType) {
      case 'http':
        await this.connectHTTP(server);
        break;
      case 'websocket':
        await this.connectWebSocket(server);
        break;
      case 'stdio':
        await this.connectSTDIO(server);
        break;
      default:
        throw new Error(`Unsupported connection type: ${server.connectionType}`);
    }
  }

  private async connectHTTP(server: MCPServer): Promise<void> {
    try {
      // Test connection with a simple ping
      const response = await axios.get(`${server.endpoint}/health`, {
        timeout: 5000,
        headers: server.apiKey ? { 'Authorization': `Bearer ${server.apiKey}` } : {}
      });
      
      if (response.status !== 200) {
        throw new Error(`HTTP connection failed with status ${response.status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP connection failed: ${error.message}`);
      }
      throw error;
    }
  }

  private async connectWebSocket(server: MCPServer): Promise<void> {
    // WebSocket connection implementation
    // This would involve creating a WebSocket connection and handling the MCP protocol
    throw new Error('WebSocket connection not implemented yet');
  }

  private async connectSTDIO(server: MCPServer): Promise<void> {
    // STDIO connection implementation for local MCP servers
    // This would involve spawning a process and communicating via stdin/stdout
    throw new Error('STDIO connection not implemented yet');
  }

  private async sendMCPRequest(server: MCPServer, request: MCPRequest): Promise<MCPResponse> {
    switch (server.connectionType) {
      case 'http':
        const response = await axios.post(server.endpoint, request, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            ...(server.apiKey ? { 'Authorization': `Bearer ${server.apiKey}` } : {})
          }
        });
        return response.data;
        
      default:
        throw new Error(`Sending requests via ${server.connectionType} not implemented yet`);
    }
  }

  async executeMCPTool(toolId: string, input: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    if (!tool.enabled) {
      throw new Error(`Tool ${toolId} is disabled`);
    }

    const serverId = tool.config.serverId;
    if (!serverId) {
      // Handle internal tools
      return await this.executeInternalTool(tool, input);
    }

    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'tools/call',
      params: {
        name: tool.name,
        arguments: input
      }
    };

    const response = await this.sendMCPRequest(server, request);
    
    if (response.error) {
      throw new Error(`MCP tool error: ${response.error.message}`);
    }

    return response.result;
  }

  // Public API methods
  async getAllMCPServers(): Promise<MCPServer[]> {
    return Array.from(this.servers.values());
  }

  async getMCPServer(serverId: string): Promise<MCPServer | null> {
    return this.servers.get(serverId) || null;
  }

  async getToolsForChannel(channelId: string): Promise<MCPTool[]> {
    return Array.from(this.tools.values()).filter(tool => 
      tool.enabled && (
        tool.channels.length === 0 || 
        tool.channels.includes(channelId)
      )
    );
  }

  async getAllTools(): Promise<MCPTool[]> {
    return Array.from(this.tools.values());
  }

  // Helper methods
  private initializeDefaultTools(): void {
    // Initialize built-in tools (same as before)
    // These are internal tools that don't require external MCP servers
  }

  private async executeInternalTool(tool: MCPTool, input: Record<string, unknown>): Promise<unknown> {
    // Handle internal tools (file-system, web-search, etc.)
    // Same implementation as before
    return { result: 'Internal tool executed' };
  }

  private generateServerId(): string {
    return `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async closeConnection(serverId: string): Promise<void> {
    this.connections.delete(serverId);
  }
}