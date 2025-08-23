import { SlackChannelConfig, AIProvider } from '../types';

export class ConfigService {
  private channelConfigs: Map<string, SlackChannelConfig> = new Map();
  private aiProviders: Map<string, AIProvider> = new Map();

  constructor() {
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs() {
    // Initialize default AI providers
    const defaultProviders: AIProvider[] = [
      {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai',
        enabled: !!process.env.OPENAI_API_KEY,
        config: {
          apiKey: process.env.OPENAI_API_KEY || '',
          timeout: 30000,
          maxTokens: 1000,
          temperature: 0.7
        },
        defaultModel: 'gpt-4',
        models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo-preview']
      },
      {
        id: 'anthropic',
        name: 'Anthropic Claude',
        type: 'anthropic',
        enabled: !!process.env.ANTHROPIC_API_KEY,
        config: {
          apiKey: process.env.ANTHROPIC_API_KEY || '',
          timeout: 30000,
          maxTokens: 1000,
          temperature: 0.7
        },
        defaultModel: 'claude-3-sonnet-20240229',
        models: ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-opus-20240229']
      }
    ];

    defaultProviders.forEach(provider => {
      this.aiProviders.set(provider.id, provider);
    });
  }

  // Channel Configuration Methods
  async getChannelConfig(channelId: string): Promise<SlackChannelConfig | null> {
    return this.channelConfigs.get(channelId) || null;
  }

  async setChannelConfig(config: SlackChannelConfig): Promise<void> {
    this.validateChannelConfig(config);
    this.channelConfigs.set(config.channelId, config);
  }

  async updateChannelConfig(channelId: string, updates: Partial<SlackChannelConfig>): Promise<SlackChannelConfig> {
    const existing = this.channelConfigs.get(channelId);
    if (!existing) {
      throw new Error(`Channel configuration for ${channelId} not found`);
    }

    const updated = { ...existing, ...updates };
    this.validateChannelConfig(updated);
    this.channelConfigs.set(channelId, updated);
    
    return updated;
  }

  async deleteChannelConfig(channelId: string): Promise<void> {
    this.channelConfigs.delete(channelId);
  }

  async getAllChannelConfigs(): Promise<SlackChannelConfig[]> {
    return Array.from(this.channelConfigs.values());
  }

  async getEnabledChannels(): Promise<SlackChannelConfig[]> {
    return Array.from(this.channelConfigs.values()).filter(config => config.enabled);
  }

  // AI Provider Configuration Methods
  async getAIProvider(providerId: string): Promise<AIProvider | null> {
    return this.aiProviders.get(providerId) || null;
  }

  async setAIProvider(provider: AIProvider): Promise<void> {
    this.validateAIProvider(provider);
    this.aiProviders.set(provider.id, provider);
  }

  async updateAIProvider(providerId: string, updates: Partial<AIProvider>): Promise<AIProvider> {
    const existing = this.aiProviders.get(providerId);
    if (!existing) {
      throw new Error(`AI provider ${providerId} not found`);
    }

    const updated = { ...existing, ...updates };
    this.validateAIProvider(updated);
    this.aiProviders.set(providerId, updated);
    
    return updated;
  }

  async deleteAIProvider(providerId: string): Promise<void> {
    this.aiProviders.delete(providerId);
  }

  async getAllAIProviders(): Promise<AIProvider[]> {
    return Array.from(this.aiProviders.values());
  }

  async getEnabledAIProviders(): Promise<AIProvider[]> {
    return Array.from(this.aiProviders.values()).filter(provider => provider.enabled);
  }

  // Helper Methods
  private validateChannelConfig(config: SlackChannelConfig): void {
    if (!config.channelId) {
      throw new Error('Channel ID is required');
    }

    if (!config.channelName) {
      throw new Error('Channel name is required');
    }

    if (!config.aiProvider) {
      throw new Error('AI provider is required');
    }

    if (!this.aiProviders.has(config.aiProvider)) {
      throw new Error(`AI provider ${config.aiProvider} not found`);
    }

    if (!Array.isArray(config.mcpTools)) {
      throw new Error('MCP tools must be an array');
    }

    if (!Array.isArray(config.triggerWords)) {
      config.triggerWords = [];
    }
  }

  private validateAIProvider(provider: AIProvider): void {
    if (!provider.id) {
      throw new Error('Provider ID is required');
    }

    if (!provider.name) {
      throw new Error('Provider name is required');
    }

    if (!['openai', 'anthropic', 'custom'].includes(provider.type)) {
      throw new Error('Invalid provider type');
    }

    if (!provider.config.apiKey && provider.enabled) {
      throw new Error('API key is required for enabled providers');
    }

    if (!Array.isArray(provider.models) || provider.models.length === 0) {
      throw new Error('At least one model must be specified');
    }

    if (!provider.models.includes(provider.defaultModel)) {
      throw new Error('Default model must be in the models list');
    }
  }

  // Configuration Templates
  async createChannelConfigTemplate(channelId: string, channelName: string): Promise<SlackChannelConfig> {
    const defaultProvider = Array.from(this.aiProviders.values()).find(p => p.enabled);
    if (!defaultProvider) {
      throw new Error('No enabled AI providers available');
    }

    return {
      channelId,
      channelName,
      enabled: true,
      autoRespond: false,
      aiProvider: defaultProvider.id,
      mcpTools: [], // No tools by default
      triggerWords: ['help', 'ai', 'assistant']
    };
  }

  // Bulk Operations
  async bulkUpdateChannelConfigs(updates: Array<{ channelId: string; config: Partial<SlackChannelConfig> }>): Promise<SlackChannelConfig[]> {
    const results: SlackChannelConfig[] = [];
    
    for (const update of updates) {
      try {
        const updated = await this.updateChannelConfig(update.channelId, update.config);
        results.push(updated);
      } catch (error) {
        console.error(`Failed to update channel ${update.channelId}:`, error);
        throw error;
      }
    }
    
    return results;
  }

  // Configuration Export/Import
  async exportConfiguration(): Promise<{
    channels: SlackChannelConfig[];
    aiProviders: AIProvider[];
    exportedAt: Date;
  }> {
    return {
      channels: await this.getAllChannelConfigs(),
      aiProviders: await this.getAllAIProviders(),
      exportedAt: new Date()
    };
  }

  async importConfiguration(data: {
    channels?: SlackChannelConfig[];
    aiProviders?: AIProvider[];
  }): Promise<void> {
    if (data.aiProviders) {
      for (const provider of data.aiProviders) {
        await this.setAIProvider(provider);
      }
    }

    if (data.channels) {
      for (const channel of data.channels) {
        await this.setChannelConfig(channel);
      }
    }
  }

  // Configuration Statistics
  async getConfigurationStats(): Promise<{
    totalChannels: number;
    enabledChannels: number;
    totalAIProviders: number;
    enabledAIProviders: number;
    channelsWithAutoRespond: number;
  }> {
    const allChannels = await this.getAllChannelConfigs();
    const allProviders = await this.getAllAIProviders();

    return {
      totalChannels: allChannels.length,
      enabledChannels: allChannels.filter(c => c.enabled).length,
      totalAIProviders: allProviders.length,
      enabledAIProviders: allProviders.filter(p => p.enabled).length,
      channelsWithAutoRespond: allChannels.filter(c => c.autoRespond).length
    };
  }

  // Configuration Validation
  async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate AI providers
    const providers = await this.getAllAIProviders();
    const enabledProviders = providers.filter(p => p.enabled);
    
    if (enabledProviders.length === 0) {
      errors.push('No enabled AI providers found');
    }

    for (const provider of enabledProviders) {
      if (!provider.config.apiKey) {
        errors.push(`AI provider ${provider.name} is missing API key`);
      }
    }

    // Validate channel configurations
    const channels = await this.getAllChannelConfigs();
    for (const channel of channels) {
      if (channel.enabled && !this.aiProviders.has(channel.aiProvider)) {
        errors.push(`Channel ${channel.channelName} references non-existent AI provider: ${channel.aiProvider}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Environment-specific configurations
  async getEnvironmentConfig(): Promise<{
    nodeEnv: string;
    hasSlackTokens: boolean;
    hasOpenAIKey: boolean;
    hasAnthropicKey: boolean;
    vercelUrl?: string;
  }> {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasSlackTokens: !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET),
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      vercelUrl: process.env.VERCEL_URL
    };
  }
}