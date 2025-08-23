// Core application types

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  config: MCPToolConfig;
  permissions: string[];
  channels: string[]; // Slack channel IDs where this tool is available
  createdAt: Date;
  updatedAt: Date;
}

export interface MCPToolConfig {
  endpoint?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  parameters?: Record<string, unknown>;
  headers?: Record<string, string>;
  serverId?: string;
  schema?: any;
}

export interface AIProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'custom';
  enabled: boolean;
  config: AIProviderConfig;
  defaultModel: string;
  models: string[];
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface SlackChannelConfig {
  channelId: string;
  channelName: string;
  enabled: boolean;
  autoRespond: boolean;
  aiProvider: string;
  mcpTools: string[];
  triggerWords: string[];
  responseTemplate?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  channelId?: string;
  userId: string;
  threadTs?: string;
  mcpToolsUsed?: string[];
}

export interface MCPToolExecution {
  toolId: string;
  input: Record<string, unknown>;
  output: unknown;
  success: boolean;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

export interface SlackEventPayload {
  token: string;
  team_id: string;
  api_app_id: string;
  event: {
    type: string;
    channel: string;
    user: string;
    text: string;
    ts: string;
    thread_ts?: string;
    app_id?: string;
    bot_id?: string;
  };
  type: 'event_callback';
  event_id: string;
  event_time: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// MCP Protocol types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  apiKey?: string;
  enabled: boolean;
  connectionType: 'http' | 'websocket' | 'stdio';
  discoveredTools: MCPToolDefinition[];
  lastDiscovery: Date | null;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Admin UI types
export interface AdminStats {
  totalMessages: number;
  totalChannels: number;
  activeMCPTools: number;
  errorRate: number;
  avgResponseTime: number;
}

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// Configuration validation schemas
export const MCPToolConfigSchema = {
  endpoint: { type: 'string', required: false },
  apiKey: { type: 'string', required: false },
  timeout: { type: 'number', required: false, min: 1000, max: 60000 },
  retries: { type: 'number', required: false, min: 0, max: 5 },
  parameters: { type: 'object', required: false },
  headers: { type: 'object', required: false }
} as const;

export const SlackChannelConfigSchema = {
  channelId: { type: 'string', required: true },
  channelName: { type: 'string', required: true },
  enabled: { type: 'boolean', required: true },
  autoRespond: { type: 'boolean', required: true },
  aiProvider: { type: 'string', required: true },
  mcpTools: { type: 'array', required: true },
  triggerWords: { type: 'array', required: false }
} as const;