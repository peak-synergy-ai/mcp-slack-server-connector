import { NextApiRequest, NextApiResponse } from 'next';
import { EnhancedMCPService } from '../../../lib/mcp-enhanced';
import { ApiResponse } from '../../../types';

const mcpService = new EnhancedMCPService();

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    switch (req.method) {
      case 'GET':
        await handleGetServers(req, res);
        break;
      case 'POST':
        await handleCreateServer(req, res);
        break;
      case 'PUT':
        await handleUpdateServer(req, res);
        break;
      case 'DELETE':
        await handleDeleteServer(req, res);
        break;
      default:
        res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('MCP Servers API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

async function handleGetServers(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { serverId } = req.query;

  if (serverId && typeof serverId === 'string') {
    // Get specific server
    const server = await mcpService.getMCPServer(serverId);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    return res.status(200).json({ success: true, data: server });
  }

  // Get all servers
  const servers = await mcpService.getAllMCPServers();
  return res.status(200).json({ success: true, data: servers });
}

async function handleCreateServer(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { name, description, endpoint, apiKey, connectionType } = req.body;

  if (!name || !endpoint) {
    return res.status(400).json({ 
      success: false, 
      error: 'Name and endpoint are required' 
    });
  }

  try {
    const server = await mcpService.addMCPServer({
      name,
      description,
      endpoint,
      apiKey,
      connectionType: connectionType || 'http'
    });

    res.status(201).json({ 
      success: true, 
      data: server,
      message: 'MCP server added successfully. Tools discovery initiated.' 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to add server' 
    });
  }
}

async function handleUpdateServer(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { serverId } = req.query;
  const updates = req.body;

  if (!serverId || typeof serverId !== 'string') {
    return res.status(400).json({ success: false, error: 'Server ID is required' });
  }

  const server = await mcpService.updateMCPServer(serverId, updates);
  res.status(200).json({ success: true, data: server });
}

async function handleDeleteServer(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { serverId } = req.query;

  if (!serverId || typeof serverId !== 'string') {
    return res.status(400).json({ success: false, error: 'Server ID is required' });
  }

  await mcpService.deleteMCPServer(serverId);
  res.status(200).json({ 
    success: true, 
    message: 'MCP server and all associated tools deleted successfully' 
  });
}