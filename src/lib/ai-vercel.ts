import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, tool, streamText } from 'ai';
import { z } from 'zod';
import { ChatMessage, MCPTool, MCPToolExecution } from '../types';
import { MCPService } from './mcp';

export class VercelAIService {
  private mcpService: MCPService;

  constructor() {
    this.mcpService = new MCPService();
  }

  async processMessageWithVercelAI(
    message: ChatMessage,
    availableTools: MCPTool[],
    aiProvider: string = 'openai'
  ): Promise<ChatMessage> {
    try {
      // Convert MCP tools to Vercel AI SDK tool format
      const vercelTools = this.convertMCPToolsToVercelFormat(availableTools);

      // Select the appropriate model
      const model = this.selectModel(aiProvider);

      // Generate response with tools
      const result = await generateText({
        model: model as any,
        messages: [
          {
            role: 'system',
            content: this.buildSystemPrompt(availableTools)
          },
          {
            role: 'user',
            content: message.content
          }
        ],
        tools: vercelTools,
        maxToolRoundtrips: 3,
        temperature: 0.7,
        maxTokens: 1000
      });

      // Extract tool calls and results
      const toolExecutions = this.extractToolExecutions(result);

      return {
        id: `response-${Date.now()}`,
        content: result.text,
        role: 'assistant',
        timestamp: new Date(),
        channelId: message.channelId,
        userId: 'ai-assistant',
        threadTs: message.threadTs,
        mcpToolsUsed: toolExecutions.map(exec => exec.toolId)
      };

    } catch (error) {
      console.error('Error processing message with Vercel AI:', error);
      throw new Error('Failed to process message with AI service');
    }
  }

  private selectModel(provider: string) {
    switch (provider) {
      case 'openai':
        return openai('gpt-4-turbo-preview');
      case 'anthropic':
        return anthropic('claude-3-sonnet-20240229');
      default:
        return openai('gpt-4-turbo-preview');
    }
  }

  private convertMCPToolsToVercelFormat(mcpTools: MCPTool[]) {
    const vercelTools: Record<string, any> = {};

    for (const mcpTool of mcpTools) {
      vercelTools[mcpTool.name] = tool({
        description: mcpTool.description,
        parameters: this.getMCPToolSchema(mcpTool),
        execute: async (params: any) => {
          try {
            const result = await this.mcpService.executeTool(mcpTool.id, params);
            return { success: true, result };
          } catch (error) {
            return { 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            };
          }
        }
      });
    }

    return vercelTools;
  }

  private getMCPToolSchema(mcpTool: MCPTool): z.ZodSchema {
    // Create dynamic Zod schema based on MCP tool definition
    // This is a simplified version - in production, you'd want to
    // fetch the actual schema from the MCP tool
    
    switch (mcpTool.name) {
      case 'file-system':
        return z.object({
          action: z.enum(['read', 'write', 'list']).describe('The file system action to perform'),
          path: z.string().describe('The file or directory path'),
          content: z.string().optional().describe('Content to write (for write action)')
        });

      case 'web-search':
        return z.object({
          query: z.string().describe('The search query'),
          maxResults: z.number().optional().default(5).describe('Maximum number of results')
        });

      case 'git':
        return z.object({
          action: z.enum(['status', 'log', 'commit', 'branch']).describe('The git action to perform'),
          repository: z.string().optional().describe('Repository path'),
          message: z.string().optional().describe('Commit message (for commit action)')
        });

      case 'database':
        return z.object({
          query: z.string().describe('SQL query to execute'),
          database: z.string().optional().describe('Database name')
        });

      case 'calendar':
        return z.object({
          action: z.enum(['list', 'create', 'update', 'delete']).describe('Calendar action'),
          date: z.string().optional().describe('Date in YYYY-MM-DD format'),
          title: z.string().optional().describe('Event title'),
          duration: z.number().optional().describe('Duration in minutes')
        });

      default:
        // Generic schema for unknown tools
        return z.object({
          input: z.any().describe('Tool input parameters')
        });
    }
  }

  private buildSystemPrompt(availableTools: MCPTool[]): string {
    let prompt = `You are a helpful AI assistant integrated with Slack. You have access to the following tools via the Model Context Protocol (MCP):

`;

    availableTools.forEach(tool => {
      prompt += `- **${tool.name}**: ${tool.description}\n`;
    });

    prompt += `
Use these tools when they would be helpful to answer the user's question or complete their request. Always explain what you're doing when you use a tool.

Guidelines:
- Be helpful, concise, and professional
- Use tools when relevant to provide accurate, up-to-date information
- Explain the results of tool usage clearly
- If a tool fails, acknowledge it and try alternative approaches
- Format responses appropriately for Slack (use markdown when helpful)
`;

    return prompt;
  }

  private extractToolExecutions(result: any): MCPToolExecution[] {
    const executions: MCPToolExecution[] = [];

    if (result.toolCalls) {
      for (const toolCall of result.toolCalls) {
        executions.push({
          toolId: toolCall.toolName,
          input: toolCall.args,
          output: toolCall.result,
          success: !toolCall.result?.error,
          error: toolCall.result?.error,
          executionTime: 0, // Vercel AI SDK doesn't provide execution time
          timestamp: new Date()
        });
      }
    }

    return executions;
  }

  // Stream response for real-time updates
  async streamResponse(
    message: ChatMessage,
    availableTools: MCPTool[],
    aiProvider: string = 'openai',
    onChunk?: (chunk: string) => void
  ): Promise<ChatMessage> {
    const vercelTools = this.convertMCPToolsToVercelFormat(availableTools);
    const model = this.selectModel(aiProvider);

    const { textStream, toolCalls } = await streamText({
      model: model as any,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(availableTools)
        },
        {
          role: 'user',
          content: message.content
        }
      ],
      tools: vercelTools,
      maxToolRoundtrips: 3
    });

    let fullText = '';
    
    // Stream the response
    for await (const chunk of textStream) {
      fullText += chunk;
      if (onChunk) {
        onChunk(chunk);
      }
    }

    const toolExecutions = await this.processToolCalls(toolCalls);

    return {
      id: `response-${Date.now()}`,
      content: fullText,
      role: 'assistant',
      timestamp: new Date(),
      channelId: message.channelId,
      userId: 'ai-assistant',
      threadTs: message.threadTs,
      mcpToolsUsed: toolExecutions.map(exec => exec.toolId)
    };
  }

  private async processToolCalls(toolCalls: any): Promise<MCPToolExecution[]> {
    const executions: MCPToolExecution[] = [];

    for await (const toolCall of toolCalls) {
      executions.push({
        toolId: toolCall.toolName,
        input: toolCall.args,
        output: toolCall.result,
        success: !toolCall.result?.error,
        error: toolCall.result?.error,
        executionTime: 0,
        timestamp: new Date()
      });
    }

    return executions;
  }

  // Create a chat API endpoint that uses streaming
  async createChatCompletion(
    messages: Array<{role: string; content: string}>,
    tools: MCPTool[],
    provider: string = 'openai'
  ) {
    const vercelTools = this.convertMCPToolsToVercelFormat(tools);
    const model = this.selectModel(provider);

    return await generateText({
      model: model as any,
      messages: messages as any,
      tools: vercelTools,
      maxToolRoundtrips: 3,
      temperature: 0.7,
      maxTokens: 1000
    });
  }
}