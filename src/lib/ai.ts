import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage, MCPTool, MCPToolExecution } from '../types';
import { MCPService } from './mcp';

export class AIService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private mcpService: MCPService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.mcpService = new MCPService();
  }

  async processMessage(
    message: ChatMessage,
    availableTools: MCPTool[],
    aiProvider: string = 'openai'
  ): Promise<ChatMessage> {
    try {
      // Determine which MCP tools might be needed
      const relevantTools = this.selectRelevantTools(message.content, availableTools);
      
      // Execute MCP tools if needed
      const toolExecutions = await this.executeMCPTools(message, relevantTools);
      
      // Generate AI response with tool results
      const response = await this.generateResponse(
        message,
        toolExecutions,
        aiProvider
      );

      return {
        id: `response-${Date.now()}`,
        content: response,
        role: 'assistant',
        timestamp: new Date(),
        channelId: message.channelId,
        userId: 'ai-assistant',
        threadTs: message.threadTs,
        mcpToolsUsed: toolExecutions.map(exec => exec.toolId)
      };

    } catch (error) {
      console.error('Error processing message with AI:', error);
      throw new Error('Failed to process message with AI service');
    }
  }

  private selectRelevantTools(content: string, availableTools: MCPTool[]): MCPTool[] {
    const lowerContent = content.toLowerCase();
    
    // Simple keyword-based tool selection
    // In a production system, you might use embeddings or ML models
    const relevantTools: MCPTool[] = [];

    for (const tool of availableTools) {
      if (this.isToolRelevant(lowerContent, tool)) {
        relevantTools.push(tool);
      }
    }

    return relevantTools;
  }

  private isToolRelevant(content: string, tool: MCPTool): boolean {
    const keywords = {
      'file-system': ['file', 'read', 'write', 'directory', 'folder', 'save', 'load'],
      'git': ['git', 'commit', 'branch', 'repository', 'code', 'version'],
      'database': ['database', 'query', 'sql', 'data', 'table', 'record'],
      'web-search': ['search', 'find', 'lookup', 'google', 'web', 'internet'],
      'calendar': ['calendar', 'schedule', 'meeting', 'appointment', 'date', 'time'],
      'email': ['email', 'send', 'message', 'mail', 'contact']
    };

    const toolKeywords = keywords[tool.name as keyof typeof keywords] || [];
    return toolKeywords.some(keyword => content.includes(keyword));
  }

  private async executeMCPTools(
    message: ChatMessage,
    tools: MCPTool[]
  ): Promise<MCPToolExecution[]> {
    const executions: MCPToolExecution[] = [];

    for (const tool of tools) {
      try {
        const startTime = Date.now();
        
        // Prepare tool input based on message content
        const input = this.prepareMCPToolInput(message, tool);
        
        // Execute the MCP tool
        const output = await this.mcpService.executeTool(tool.id, input);
        
        const execution: MCPToolExecution = {
          toolId: tool.id,
          input,
          output,
          success: true,
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        };

        executions.push(execution);
        
      } catch (error) {
        console.error(`Error executing MCP tool ${tool.id}:`, error);
        
        executions.push({
          toolId: tool.id,
          input: {},
          output: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: 0,
          timestamp: new Date()
        });
      }
    }

    return executions;
  }

  private prepareMCPToolInput(message: ChatMessage, tool: MCPTool): Record<string, unknown> {
    // This is a simplified example - in production, you'd want more sophisticated
    // input preparation based on the tool's schema and the message content
    
    const baseInput = {
      query: message.content,
      context: {
        channelId: message.channelId,
        userId: message.userId,
        timestamp: message.timestamp
      }
    };

    // Tool-specific input preparation
    switch (tool.name) {
      case 'file-system':
        return {
          ...baseInput,
          action: this.extractFileAction(message.content),
          path: this.extractFilePath(message.content)
        };
        
      case 'web-search':
        return {
          ...baseInput,
          searchQuery: this.extractSearchQuery(message.content),
          maxResults: 5
        };
        
      case 'database':
        return {
          ...baseInput,
          query: this.extractSQLQuery(message.content)
        };
        
      default:
        return baseInput;
    }
  }

  private extractFileAction(content: string): string {
    if (content.includes('read') || content.includes('show') || content.includes('get')) {
      return 'read';
    } else if (content.includes('write') || content.includes('save') || content.includes('create')) {
      return 'write';
    } else if (content.includes('list') || content.includes('directory')) {
      return 'list';
    }
    return 'read';
  }

  private extractFilePath(content: string): string {
    // Simple regex to extract file paths
    const pathMatch = content.match(/[\/\w\-_.]+\.\w+/);
    return pathMatch ? pathMatch[0] : './';
  }

  private extractSearchQuery(content: string): string {
    // Remove common prefixes and get the search intent
    return content
      .replace(/^(search for|find|lookup|google)\s+/i, '')
      .replace(/\s+(on the web|online|internet)$/i, '')
      .trim();
  }

  private extractSQLQuery(content: string): string {
    // Extract SQL query if present, otherwise return empty
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/) || 
                    content.match(/SELECT[\s\S]*?(?:;|$)/i);
    return sqlMatch ? sqlMatch[1] || sqlMatch[0] : '';
  }

  private async generateResponse(
    message: ChatMessage,
    toolExecutions: MCPToolExecution[],
    provider: string
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(toolExecutions);
    const userPrompt = this.buildUserPrompt(message, toolExecutions);

    switch (provider) {
      case 'openai':
        return await this.generateOpenAIResponse(systemPrompt, userPrompt);
      case 'anthropic':
        return await this.generateAnthropicResponse(systemPrompt, userPrompt);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  private buildSystemPrompt(toolExecutions: MCPToolExecution[]): string {
    let prompt = `You are a helpful AI assistant integrated with Slack. You have access to various tools through the Model Context Protocol (MCP).`;
    
    if (toolExecutions.length > 0) {
      prompt += `\n\nThe following tools were executed for this request:\n`;
      toolExecutions.forEach(exec => {
        if (exec.success) {
          prompt += `- ${exec.toolId}: Successfully executed with result\n`;
        } else {
          prompt += `- ${exec.toolId}: Failed with error: ${exec.error}\n`;
        }
      });
    }
    
    prompt += `\nProvide helpful, concise responses. Use the tool results to inform your answer when relevant.`;
    
    return prompt;
  }

  private buildUserPrompt(message: ChatMessage, toolExecutions: MCPToolExecution[]): string {
    let prompt = message.content;
    
    if (toolExecutions.length > 0) {
      prompt += `\n\nTool Results:\n`;
      toolExecutions.forEach(exec => {
        if (exec.success && exec.output) {
          prompt += `\n${exec.toolId} result:\n${JSON.stringify(exec.output, null, 2)}\n`;
        }
      });
    }
    
    return prompt;
  }

  private async generateOpenAIResponse(systemPrompt: string, userPrompt: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    return completion.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
  }

  private async generateAnthropicResponse(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : 'Sorry, I couldn\'t generate a response.';
  }

  // Public methods for direct API access
  public async chatCompletion(
    messages: Array<{role: string; content: string}>,
    provider: string = 'openai'
  ): Promise<string> {
    switch (provider) {
      case 'openai':
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: messages as any,
          max_tokens: 1000,
          temperature: 0.7
        });
        return completion.choices[0]?.message?.content || '';
        
      case 'anthropic':
        const response = await this.anthropic.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          messages: messages.slice(1) as any, // Skip system message for Anthropic
          system: messages[0]?.content
        });
        const content = response.content[0];
        return content.type === 'text' ? content.text : '';
        
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}