import React, { useState, useEffect } from 'react';
import { MCPTool, SlackChannelConfig, AdminStats, ApiResponse } from '../types';
import { MCPServerManager } from '../components/MCPServerManager';

interface AdminPageProps {}

const AdminPage: React.FC<AdminPageProps> = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'servers' | 'tools' | 'channels' | 'settings'>('overview');
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [channels, setChannels] = useState<SlackChannelConfig[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load tools
      const toolsResponse = await fetch('/api/mcp/tools');
      const toolsData: ApiResponse<MCPTool[]> = await toolsResponse.json();
      if (toolsData.success && toolsData.data) {
        setTools(toolsData.data);
      }

      // Load channels
      const channelsResponse = await fetch('/api/channels');
      const channelsData: ApiResponse<SlackChannelConfig[]> = await channelsResponse.json();
      if (channelsData.success && channelsData.data) {
        setChannels(channelsData.data);
      }

      // Load stats
      const statsResponse = await fetch('/api/admin/stats');
      const statsData: ApiResponse<AdminStats> = await statsResponse.json();
      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }

    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = async (toolId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/mcp/tools?toolId=${toolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error toggling tool:', error);
    }
  };

  const toggleChannel = async (channelId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/channels?channelId=${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error toggling channel:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Slack AI Service Admin</h1>
            <button
              onClick={loadData}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {['overview', 'servers', 'tools', 'channels', 'settings'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewTab stats={stats} toolsCount={tools.length} channelsCount={channels.length} />
        )}

        {activeTab === 'servers' && (
          <MCPServersTab onRefresh={loadData} />
        )}

        {activeTab === 'tools' && (
          <ToolsTab tools={tools} onToggleTool={toggleTool} onRefresh={loadData} />
        )}

        {activeTab === 'channels' && (
          <ChannelsTab channels={channels} onToggleChannel={toggleChannel} onRefresh={loadData} />
        )}

        {activeTab === 'settings' && (
          <SettingsTab />
        )}
      </div>
    </div>
  );
};

// MCP Servers Tab Component
const MCPServersTab: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => (
  <MCPServerManager onRefresh={onRefresh} />
);

// Overview Tab Component
const OverviewTab: React.FC<{ stats: AdminStats | null; toolsCount: number; channelsCount: number }> = ({ stats, toolsCount, channelsCount }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <StatsCard title="Total Messages" value={stats?.totalMessages || 0} />
    <StatsCard title="Active Channels" value={stats?.totalChannels || channelsCount} />
    <StatsCard title="MCP Tools" value={stats?.activeMCPTools || toolsCount} />
    <StatsCard title="Error Rate" value={`${stats?.errorRate || 0}%`} />
  </div>
);

// Tools Tab Component
const ToolsTab: React.FC<{ tools: MCPTool[]; onToggleTool: (id: string, enabled: boolean) => void; onRefresh: () => void }> = ({ tools, onToggleTool }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold">MCP Tools</h2>
      <AddToolButton />
    </div>
    
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channels</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tools.map((tool) => (
            <tr key={tool.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tool.name}</td>
              <td className="px-6 py-4 text-sm text-gray-500">{tool.description}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  tool.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {tool.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {tool.channels.length === 0 ? 'All channels' : `${tool.channels.length} channels`}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => onToggleTool(tool.id, !tool.enabled)}
                  className={`mr-2 px-3 py-1 rounded text-sm ${
                    tool.enabled 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {tool.enabled ? 'Disable' : 'Enable'}
                </button>
                <button className="text-blue-600 hover:text-blue-900">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Channels Tab Component
const ChannelsTab: React.FC<{ channels: SlackChannelConfig[]; onToggleChannel: (id: string, enabled: boolean) => void; onRefresh: () => void }> = ({ channels, onToggleChannel }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold">Slack Channels</h2>
      <AddChannelButton />
    </div>
    
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Provider</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auto Respond</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tools</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {channels.map((channel) => (
            <tr key={channel.channelId}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{channel.channelName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{channel.aiProvider}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {channel.autoRespond ? 'Yes' : 'No'}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">{channel.mcpTools.length} tools</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  channel.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {channel.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => onToggleChannel(channel.channelId, !channel.enabled)}
                  className={`mr-2 px-3 py-1 rounded text-sm ${
                    channel.enabled 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {channel.enabled ? 'Disable' : 'Enable'}
                </button>
                <button className="text-blue-600 hover:text-blue-900">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Settings Tab Component
const SettingsTab: React.FC = () => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold">Settings</h2>
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium mb-4">Environment Configuration</h3>
      <div className="space-y-2">
        <ConfigItem label="Slack Bot Token" value={process.env.SLACK_BOT_TOKEN ? 'Configured' : 'Missing'} />
        <ConfigItem label="OpenAI API Key" value={process.env.OPENAI_API_KEY ? 'Configured' : 'Missing'} />
        <ConfigItem label="Anthropic API Key" value={process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Missing'} />
        <ConfigItem label="Environment" value={process.env.NODE_ENV || 'development'} />
      </div>
    </div>
  </div>
);

// Helper Components
const StatsCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
  <div className="bg-white overflow-hidden shadow rounded-lg">
    <div className="p-5">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-500 rounded-md"></div>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-lg font-medium text-gray-900">{value}</dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
);

const ConfigItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="text-sm text-gray-600">{label}:</span>
    <span className="text-sm font-medium text-gray-900">{value}</span>
  </div>
);

const AddToolButton: React.FC = () => (
  <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
    Add Tool
  </button>
);

const AddChannelButton: React.FC = () => (
  <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
    Add Channel
  </button>
);

export default AdminPage;