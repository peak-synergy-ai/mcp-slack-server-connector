import { App, ExpressReceiver } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { AIService } from './ai';
import { MCPService } from './mcp';
import { ConfigService } from './config';
import { ChatMessage, SlackEventPayload } from '../types';

export class SlackService {
  private app: App;
  private client: WebClient;
  private aiService: AIService;
  private mcpService: MCPService;
  private configService: ConfigService;

  constructor() {
    // Initialize Slack app with Socket Mode for development
    // and HTTP receiver for production (Vercel)
    const receiver = new ExpressReceiver({
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
      endpoints: '/api/slack/events',
      processBeforeResponse: true
    });

    this.app = new App({
      token: process.env.SLACK_BOT_TOKEN!,
      receiver,
      socketMode: process.env.NODE_ENV === 'development',
      appToken: process.env.SLACK_APP_TOKEN
    });

    this.client = new WebClient(process.env.SLACK_BOT_TOKEN!);
    this.aiService = new AIService();
    this.mcpService = new MCPService();
    this.configService = new ConfigService();

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle app mentions (@bot)
    this.app.event('app_mention', async ({ event, say }) => {
      try {
        await this.handleMessage({
          channelId: event.channel,
          userId: event.user || 'unknown',
          text: event.text,
          threadTs: event.thread_ts,
          ts: event.ts
        });
      } catch (error) {
        console.error('Error handling app mention:', error);
        await say('Sorry, I encountered an error processing your request.');
      }
    });

    // Handle direct messages
    this.app.event('message', async ({ event, say }) => {
      // Skip bot messages and messages with subtype
      if (event.subtype || event.bot_id) return;

      const messageEvent = event as any;
      
      // Only respond to DMs or configured channels
      if (messageEvent.channel_type === 'im' || 
          await this.shouldRespondInChannel(messageEvent.channel)) {
        try {
          await this.handleMessage({
            channelId: messageEvent.channel,
            userId: messageEvent.user,
            text: messageEvent.text,
            threadTs: messageEvent.thread_ts,
            ts: messageEvent.ts
          });
        } catch (error) {
          console.error('Error handling message:', error);
        }
      }
    });

    // Handle interactive components (buttons, select menus, etc.)
    this.app.action(/.*/, async ({ ack, body, respond }) => {
      await ack();
      // Handle interactive components for MCP tool selection
      await this.handleInteractiveComponent(body, respond);
    });

    // Handle slash commands
    this.app.command('/ai-tools', async ({ ack, command, respond }) => {
      await ack();
      await this.handleToolsCommand(command, respond);
    });
  }

  private async handleMessage(params: {
    channelId: string;
    userId: string;
    text: string;
    threadTs?: string;
    ts: string;
  }) {
    const { channelId, userId, text, threadTs, ts } = params;

    // Get channel configuration
    const channelConfig = await this.configService.getChannelConfig(channelId);
    if (!channelConfig?.enabled) return;

    // Check if message should trigger a response
    if (!this.shouldTriggerResponse(text, channelConfig.triggerWords)) return;

    // Get available MCP tools for this channel
    const availableTools = await this.mcpService.getToolsForChannel(channelId);

    // Create chat message
    const message: ChatMessage = {
      id: `${channelId}-${ts}`,
      content: this.cleanMessageText(text),
      role: 'user',
      timestamp: new Date(parseFloat(ts) * 1000),
      channelId,
      userId,
      threadTs
    };

    try {
      // Get AI response with MCP tools
      const response = await this.aiService.processMessage(
        message,
        availableTools,
        channelConfig.aiProvider
      );

      // Send response to Slack
      await this.client.chat.postMessage({
        channel: channelId,
        text: response.content,
        thread_ts: threadTs,
        blocks: this.formatResponseBlocks(response)
      });

      // Log the interaction
      await this.logInteraction(message, response);

    } catch (error) {
      console.error('Error processing message:', error);
      await this.client.chat.postMessage({
        channel: channelId,
        text: 'Sorry, I encountered an error processing your request. Please try again.',
        thread_ts: threadTs
      });
    }
  }

  private async shouldRespondInChannel(channelId: string): Promise<boolean> {
    const config = await this.configService.getChannelConfig(channelId);
    return config?.autoRespond ?? false;
  }

  private shouldTriggerResponse(text: string, triggerWords: string[]): boolean {
    if (!triggerWords?.length) return true;
    
    const lowerText = text.toLowerCase();
    return triggerWords.some(word => lowerText.includes(word.toLowerCase()));
  }

  private cleanMessageText(text: string): string {
    // Remove bot mention and clean up the text
    return text
      .replace(/<@U[A-Z0-9]+>/g, '') // Remove user mentions
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  private formatResponseBlocks(response: ChatMessage) {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: response.content
        }
      }
    ];

    // Add MCP tools used section if any
    if (response.mcpToolsUsed?.length) {
      blocks.push({
        type: 'context',
        text: {
          type: 'mrkdwn',
          text: `🔧 Tools used: ${response.mcpToolsUsed.join(', ')}`
        }
      });
    }

    return blocks;
  }

  private async handleInteractiveComponent(body: any, respond: any) {
    // Handle tool selection and configuration through interactive components
    if (body.actions?.[0]?.action_id === 'select_mcp_tool') {
      const selectedTool = body.actions[0].selected_option?.value;
      await respond({
        text: `Selected MCP tool: ${selectedTool}`,
        replace_original: false
      });
    }
  }

  private async handleToolsCommand(command: any, respond: any) {
    const channelId = command.channel_id;
    const availableTools = await this.mcpService.getToolsForChannel(channelId);

    const toolsList = availableTools.map(tool => 
      `• *${tool.name}*: ${tool.description}`
    ).join('\n');

    await respond({
      text: `Available AI tools in this channel:\n\n${toolsList}`,
      response_type: 'ephemeral'
    });
  }

  private async logInteraction(userMessage: ChatMessage, aiResponse: ChatMessage) {
    // Log the interaction for analytics and debugging
    console.log('Chat interaction:', {
      channel: userMessage.channelId,
      user: userMessage.userId,
      timestamp: userMessage.timestamp,
      toolsUsed: aiResponse.mcpToolsUsed,
      responseLength: aiResponse.content.length
    });
  }

  // Public methods for API endpoints
  public getApp() {
    return this.app;
  }

  public getReceiver() {
    return (this.app as any).receiver as ExpressReceiver;
  }

  public async sendMessage(channelId: string, text: string, threadTs?: string) {
    return await this.client.chat.postMessage({
      channel: channelId,
      text,
      thread_ts: threadTs
    });
  }

  public async getChannels() {
    const result = await this.client.conversations.list({
      types: 'public_channel,private_channel'
    });
    return result.channels || [];
  }

  public async getChannelInfo(channelId: string) {
    const result = await this.client.conversations.info({
      channel: channelId
    });
    return result.channel;
  }
}