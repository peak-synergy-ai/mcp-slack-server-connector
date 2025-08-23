import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { MCPService } from '../../../lib/mcp';

const mcpService = new MCPService();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Slack signature
  const signature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signingSecret = process.env.SLACK_SIGNING_SECRET!;

  if (!verifySlackSignature(signature, timestamp, req.body, signingSecret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      command,
      text,
      channel_id,
      user_id,
      user_name,
      response_url
    } = parseSlackCommand(req.body);

    switch (command) {
      case '/ai-tools':
        await handleAIToolsCommand(channel_id, text, res);
        break;
      case '/ai-config':
        await handleAIConfigCommand(channel_id, user_id, res);
        break;
      default:
        res.status(200).json({
          response_type: 'ephemeral',
          text: `Unknown command: ${command}`
        });
    }
  } catch (error) {
    console.error('Slack command error:', error);
    res.status(200).json({
      response_type: 'ephemeral',
      text: 'Sorry, something went wrong processing your command.'
    });
  }
}

async function handleAIToolsCommand(channelId: string, text: string, res: NextApiResponse) {
  const availableTools = await mcpService.getToolsForChannel(channelId);
  
  if (availableTools.length === 0) {
    res.status(200).json({
      response_type: 'ephemeral',
      text: 'No AI tools are configured for this channel. Contact your admin to set up tools.'
    });
    return;
  }

  const toolsList = availableTools.map(tool => 
    `• *${tool.name}*: ${tool.description}`
  ).join('\n');

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Available AI Tools in #${channelId}*\n\n${toolsList}`
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${availableTools.length} tools available • Use @ai-assistant to interact with these tools`
        }
      ]
    }
  ];

  res.status(200).json({
    response_type: 'ephemeral',
    blocks
  });
}

async function handleAIConfigCommand(channelId: string, userId: string, res: NextApiResponse) {
  // This would typically check if user is admin
  const configUrl = `${process.env.NEXTAUTH_URL}/admin?channel=${channelId}`;
  
  res.status(200).json({
    response_type: 'ephemeral',
    text: `Configure AI tools for this channel: ${configUrl}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*AI Configuration*\nManage AI tools and settings for this channel.'
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Open Admin Panel'
          },
          url: configUrl,
          action_id: 'open_admin'
        }
      }
    ]
  });
}

function parseSlackCommand(body: string) {
  const params = new URLSearchParams(body);
  return {
    command: params.get('command'),
    text: params.get('text') || '',
    channel_id: params.get('channel_id'),
    user_id: params.get('user_id'),
    user_name: params.get('user_name'),
    response_url: params.get('response_url')
  };
}

function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string,
  signingSecret: string
): boolean {
  const time = Math.floor(Date.now() / 1000);
  
  // Request is older than 5 minutes
  if (Math.abs(time - parseInt(timestamp)) > 300) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = `v0=${crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring)
    .digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(mySignature)
  );
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}