import { NextApiRequest, NextApiResponse } from 'next';
import { SlackService } from '../../../lib/slack';

// This endpoint handles Slack interactive components like buttons, select menus, modals, etc.
const slackService = new SlackService();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the payload from Slack
    const payload = JSON.parse(req.body.payload);
    
    switch (payload.type) {
      case 'block_actions':
        await handleBlockActions(payload, res);
        break;
      case 'view_submission':
        await handleViewSubmission(payload, res);
        break;
      case 'shortcut':
        await handleShortcut(payload, res);
        break;
      default:
        res.status(200).json({ ok: true });
    }
  } catch (error) {
    console.error('Slack interactivity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleBlockActions(payload: any, res: NextApiResponse) {
  const action = payload.actions[0];
  
  switch (action.action_id) {
    case 'select_mcp_tool':
      await handleToolSelection(payload, action, res);
      break;
    case 'open_admin':
      // Button click - just acknowledge
      res.status(200).json({ ok: true });
      break;
    default:
      res.status(200).json({ ok: true });
  }
}

async function handleToolSelection(payload: any, action: any, res: NextApiResponse) {
  const selectedTool = action.selected_option?.value;
  const channelId = payload.channel?.id;
  const userId = payload.user?.id;

  // Update the message to show the selected tool
  const updateMessage = {
    replace_original: true,
    text: `Selected tool: ${selectedTool}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ You selected the *${selectedTool}* tool for this channel.`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'You can now use this tool by mentioning @ai-assistant in your messages.'
          }
        ]
      }
    ]
  };

  res.status(200).json(updateMessage);
}

async function handleViewSubmission(payload: any, res: NextApiResponse) {
  // Handle modal submissions (if you add modals for configuration)
  const view = payload.view;
  const values = view.state.values;

  // Process form submission
  console.log('Modal submission:', values);

  res.status(200).json({
    response_action: 'clear'
  });
}

async function handleShortcut(payload: any, res: NextApiResponse) {
  // Handle global shortcuts or message shortcuts
  console.log('Shortcut triggered:', payload.callback_id);
  
  res.status(200).json({ ok: true });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}