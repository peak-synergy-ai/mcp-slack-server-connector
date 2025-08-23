import { NextApiRequest, NextApiResponse } from 'next';
import { SlackChannelConfig, ApiResponse } from '../../types';

// Mock data for now - in production this would come from a database
const mockChannels: SlackChannelConfig[] = [
  {
    channelId: 'C1234567890',
    channelName: 'general',
    aiProvider: 'openai',
    autoRespond: true,
    enabled: true,
    mcpTools: ['tool1', 'tool2']
  },
  {
    channelId: 'C0987654321',
    channelName: 'random',
    aiProvider: 'anthropic',
    autoRespond: false,
    enabled: true,
    mcpTools: ['tool1']
  }
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SlackChannelConfig[]>>
) {
  if (req.method === 'GET') {
    try {
      // In production, fetch from database
      const channels = mockChannels;
      
      res.status(200).json({
        success: true,
        data: channels,
        message: 'Channels retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        message: 'Failed to retrieve channels'
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const { channelId } = req.query;
      const { enabled } = req.body;
      
      // In production, update database
      const channel = mockChannels.find(c => c.channelId === channelId);
      if (channel) {
        channel.enabled = enabled;
      }
      
      res.status(200).json({
        success: true,
        data: mockChannels,
        message: 'Channel updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        message: 'Failed to update channel'
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).json({
      success: false,
      data: null,
      message: `Method ${req.method} Not Allowed`
    });
  }
}
