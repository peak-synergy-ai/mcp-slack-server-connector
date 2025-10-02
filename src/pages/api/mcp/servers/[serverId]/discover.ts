import { NextApiRequest, NextApiResponse } from 'next';
import { EnhancedMCPService } from '../../../../../lib/mcp-enhanced';
import { ApiResponse } from '../../../../../types';

const mcpService = new EnhancedMCPService();

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { serverId } = req.query;

  if (!serverId || typeof serverId !== 'string') {
    return res.status(400).json({ success: false, error: 'Server ID is required' });
  }

  try {
    const discoveredTools = await mcpService.discoverMCPTools(serverId);
    
    res.status(200).json({ 
      success: true, 
      data: discoveredTools,
      message: `Successfully discovered ${discoveredTools.length} tools. They are now available in the Vercel AI SDK.`
    });
  } catch (error) {
    console.error('Tool discovery error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Tool discovery failed' 
    });
  }
}