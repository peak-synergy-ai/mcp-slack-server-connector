import React, { useState, useEffect } from 'react';
import { MCPServer, MCPTool } from '../types';

interface MCPServerManagerProps {
  onRefresh?: () => void;
}

export const MCPServerManager: React.FC<MCPServerManagerProps> = ({ onRefresh }) => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [discoveredTools, setDiscoveredTools] = useState<Record<string, MCPTool[]>>({});

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mcp/servers');
      const data = await response.json();
      if (data.success) {
        setServers(data.data);
        
        // Load tools for each server
        const toolsMap: Record<string, MCPTool[]> = {};
        for (const server of data.data) {
          const toolsResponse = await fetch(`/api/mcp/servers/${server.id}/tools`);
          const toolsData = await toolsResponse.json();
          if (toolsData.success) {
            toolsMap[server.id] = toolsData.data;
          }
        }
        setDiscoveredTools(toolsMap);
      }
    } catch (error) {
      console.error('Error loading MCP servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const addServer = async (serverData: {
    name: string;
    description: string;
    endpoint: string;
    apiKey?: string;
    connectionType: 'http' | 'websocket' | 'stdio';
  }) => {
    try {
      const response = await fetch('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData)
      });

      const data = await response.json();
      if (data.success) {
        await loadServers();
        setShowAddForm(false);
        if (onRefresh) onRefresh();
      } else {
        alert(`Error adding server: ${data.error}`);
      }
    } catch (error) {
      console.error('Error adding MCP server:', error);
      alert('Error adding MCP server');
    }
  };

  const deleteServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to delete this MCP server and all its tools?')) {
      return;
    }

    try {
      const response = await fetch(`/api/mcp/servers?serverId=${serverId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadServers();
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Error deleting MCP server:', error);
    }
  };

  const discoverTools = async (serverId: string) => {
    try {
      const response = await fetch(`/api/mcp/servers/${serverId}/discover`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        await loadServers();
        if (onRefresh) onRefresh();
      } else {
        alert(`Tool discovery failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error discovering tools:', error);
      alert('Error discovering tools');
    }
  };

  const toggleServerEnabled = async (serverId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/mcp/servers?serverId=${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        await loadServers();
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Error toggling server:', error);
    }
  };

  if (loading) {
    return <div className="text-center">Loading MCP servers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">MCP Servers</h2>
        <div className="space-x-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Add MCP Server
          </button>
          <button
            onClick={loadServers}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Add Server Form Modal */}
      {showAddForm && (
        <AddServerForm
          onAdd={addServer}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Servers List */}
      <div className="grid grid-cols-1 gap-6">
        {servers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            tools={discoveredTools[server.id] || []}
            onDelete={() => deleteServer(server.id)}
            onDiscover={() => discoverTools(server.id)}
            onToggleEnabled={(enabled) => toggleServerEnabled(server.id, enabled)}
            onViewDetails={() => setSelectedServer(server)}
          />
        ))}
      </div>

      {servers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No MCP servers configured. Add one to get started!
        </div>
      )}

      {/* Server Details Modal */}
      {selectedServer && (
        <ServerDetailsModal
          server={selectedServer}
          tools={discoveredTools[selectedServer.id] || []}
          onClose={() => setSelectedServer(null)}
          onRefresh={loadServers}
        />
      )}
    </div>
  );
};

// Add Server Form Component
const AddServerForm: React.FC<{
  onAdd: (data: any) => void;
  onCancel: () => void;
}> = ({ onAdd, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    endpoint: '',
    apiKey: '',
    connectionType: 'http' as const
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Add MCP Server</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endpoint URL *
            </label>
            <input
              type="url"
              value={formData.endpoint}
              onChange={(e) => setFormData({...formData, endpoint: e.target.value})}
              placeholder="https://your-mcp-server.com/api"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key (optional)
            </label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Connection Type
            </label>
            <select
              value={formData.connectionType}
              onChange={(e) => setFormData({...formData, connectionType: e.target.value as any})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="http">HTTP</option>
              <option value="websocket">WebSocket</option>
              <option value="stdio">STDIO</option>
            </select>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Add Server
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Server Card Component
const ServerCard: React.FC<{
  server: MCPServer;
  tools: MCPTool[];
  onDelete: () => void;
  onDiscover: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onViewDetails: () => void;
}> = ({ server, tools, onDelete, onDiscover, onToggleEnabled, onViewDetails }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'disconnected': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">{server.name}</h3>
          <p className="text-gray-600 text-sm">{server.description}</p>
          <p className="text-gray-500 text-xs mt-1">{server.endpoint}</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(server.connectionStatus)}`}>
            {server.connectionStatus}
          </span>
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
            server.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {server.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">{tools.length}</span> tools discovered
          {server.lastDiscovery && (
            <span className="ml-2">
              (Last: {new Date(server.lastDiscovery).toLocaleDateString()})
            </span>
          )}
        </div>
        
        {server.error && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
            {server.error}
          </div>
        )}
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => onToggleEnabled(!server.enabled)}
          className={`px-3 py-1 rounded text-sm ${
            server.enabled 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {server.enabled ? 'Disable' : 'Enable'}
        </button>
        
        <button
          onClick={onDiscover}
          className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm"
        >
          Discover Tools
        </button>
        
        <button
          onClick={onViewDetails}
          className="px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-sm"
        >
          View Details
        </button>
        
        <button
          onClick={onDelete}
          className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

// Server Details Modal
const ServerDetailsModal: React.FC<{
  server: MCPServer;
  tools: MCPTool[];
  onClose: () => void;
  onRefresh: () => void;
}> = ({ server, tools, onClose, onRefresh }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold">{server.name}</h3>
            <p className="text-gray-600">{server.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h4 className="font-semibold mb-2">Server Information</h4>
            <div className="space-y-1 text-sm">
              <div><strong>Endpoint:</strong> {server.endpoint}</div>
              <div><strong>Connection:</strong> {server.connectionType}</div>
              <div><strong>Status:</strong> {server.connectionStatus}</div>
              <div><strong>Created:</strong> {new Date(server.createdAt).toLocaleString()}</div>
              <div><strong>Last Updated:</strong> {new Date(server.updatedAt).toLocaleString()}</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Statistics</h4>
            <div className="space-y-1 text-sm">
              <div><strong>Tools:</strong> {tools.length}</div>
              <div><strong>Enabled Tools:</strong> {tools.filter(t => t.enabled).length}</div>
              <div><strong>Last Discovery:</strong> {
                server.lastDiscovery 
                  ? new Date(server.lastDiscovery).toLocaleString()
                  : 'Never'
              }</div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Discovered Tools</h4>
          {tools.length > 0 ? (
            <div className="space-y-2">
              {tools.map((tool) => (
                <div key={tool.id} className="border rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium">{tool.name}</h5>
                      <p className="text-sm text-gray-600">{tool.description}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${
                      tool.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tool.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-4">
              No tools discovered yet. Click "Discover Tools" to scan for available tools.
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};