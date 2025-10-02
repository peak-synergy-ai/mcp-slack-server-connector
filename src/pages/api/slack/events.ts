import { NextApiRequest, NextApiResponse } from 'next';
import { SlackService } from '../../../lib/slack';

// Initialize Slack service
const slackService = new SlackService();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle Slack URL verification challenge
    if (req.body.challenge) {
      return res.status(200).json({ challenge: req.body.challenge });
    }

    // Get the Express receiver from SlackService
    const receiver = slackService.getReceiver();
    
    // Use Slack Bolt's built-in request handling
    await new Promise<void>((resolve, reject) => {
      receiver.app(req as any, res as any, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

  } catch (error) {
    console.error('Slack events API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Disable body parsing for Slack's raw body verification
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}