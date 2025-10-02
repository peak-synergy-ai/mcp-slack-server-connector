import { NextApiRequest, NextApiResponse } from 'next';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { VercelAIService } from '../../../lib/ai-vercel';
import { MCPService } from '../../../lib/mcp';

const vercelAIService = new VercelAIService();
const mcpService = new MCPService();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      messages, 
      provider = 'openai', 
      channelId, 
      stream = false 
    } = req.body;

    // Get available MCP tools for the channel
    const availableTools = channelId 
      ? await mcpService.getToolsForChannel(channelId)
      : await mcpService.getAllTools();

    // Filter to only enabled tools
    const enabledTools = availableTools.filter(tool => tool.enabled);

    if (stream) {
      // Handle streaming response
      const model = provider === 'anthropic' 
        ? anthropic('claude-3-sonnet-20240229')
        : openai('gpt-4-turbo-preview');

      const vercelTools = await vercelAIService.createChatCompletion(
        messages,
        enabledTools,
        provider
      );

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const result = await streamText({
        model: model as any,
        messages,
        tools: vercelTools as any,
        maxToolRoundtrips: 3
      });

      // Stream the response
      for await (const chunk of result.textStream) {
        res.write(chunk);
      }

      res.end();

    } else {
      // Handle non-streaming response
      const result = await vercelAIService.createChatCompletion(
        messages,
        enabledTools,
        provider
      );

      res.status(200).json({
        success: true,
        data: {
          content: result.text,
          toolCalls: result.toolCalls || [],
          usage: result.usage
        }
      });
    }

  } catch (error) {
    console.error('AI Chat API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}