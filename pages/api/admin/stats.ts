import { NextApiRequest, NextApiResponse } from 'next';
import { AdminStats, ApiResponse } from '../../../types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<AdminStats>>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      data: null,
      message: `Method ${req.method} Not Allowed`
    });
  }

  try {
    // In production, fetch real stats from database/analytics
    const stats: AdminStats = {
      totalMessages: 1250,
      totalChannels: 8,
      activeMCPTools: 12,
      errorRate: 2.1,
      lastUpdated: new Date().toISOString()
    };
    
    res.status(200).json({
      success: true,
      data: stats,
      message: 'Stats retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to retrieve stats'
    });
  }
}
