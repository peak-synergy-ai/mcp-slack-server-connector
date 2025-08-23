import { NextApiRequest, NextApiResponse } from 'next';
import { MCPService } from '../../../lib/mcp';
import { ApiResponse, MCPTool } from '../../../types';

const mcpService = new MCPService();

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    switch (req.method) {
      case 'GET':
        await handleGetTools(req, res);
        break;
      case 'POST':
        await handleCreateTool(req, res);
        break;
      case 'PUT':
        await handleUpdateTool(req, res);
        break;
      case 'DELETE':
        await handleDeleteTool(req, res);
        break;
      default:
        res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('MCP Tools API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

async function handleGetTools(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { channelId, toolId } = req.query;

  if (toolId && typeof toolId === 'string') {
    // Get specific tool
    const tool = await mcpService.getTool(toolId);
    if (!tool) {
      return res.status(404).json({ success: false, error: 'Tool not found' });
    }
    
    // Include health check
    const health = await mcpService.checkToolHealth(toolId);
    return res.status(200).json({ 
      success: true, 
      data: { ...tool, health } 
    });
  }

  if (channelId && typeof channelId === 'string') {
    // Get tools for specific channel
    const tools = await mcpService.getToolsForChannel(channelId);
    return res.status(200).json({ success: true, data: tools });
  }

  // Get all tools
  const tools = await mcpService.getAllTools();
  return res.status(200).json({ success: true, data: tools });
}

async function handleCreateTool(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const toolData = req.body as Partial<MCPTool>;

  if (!toolData.name || !toolData.description) {
    return res.status(400).json({ 
      success: false, 
      error: 'Tool name and description are required' 
    });
  }

  const tool = await mcpService.registerTool(toolData);
  res.status(201).json({ success: true, data: tool });
}

async function handleUpdateTool(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { toolId } = req.query;
  const updates = req.body as Partial<MCPTool>;

  if (!toolId || typeof toolId !== 'string') {
    return res.status(400).json({ success: false, error: 'Tool ID is required' });
  }

  const tool = await mcpService.updateTool(toolId, updates);
  res.status(200).json({ success: true, data: tool });
}

async function handleDeleteTool(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const { toolId } = req.query;

  if (!toolId || typeof toolId !== 'string') {
    return res.status(400).json({ success: false, error: 'Tool ID is required' });
  }

  await mcpService.deleteTool(toolId);
  res.status(200).json({ success: true, message: 'Tool deleted successfully' });
}