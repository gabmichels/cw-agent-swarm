/**
 * ChannelManager.ts - Manages secure communication channels between agents
 * 
 * This module provides a central management system for secure channels between agents,
 * handling channel creation, destruction, and lookup.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  SecureChannel, 
  ChannelSecurityLevel, 
  ChannelAuthMethod, 
  ChannelState,
  SecureChannelConfig
} from './SecureChannel';

/**
 * Channel information
 */
export interface ChannelInfo {
  /**
   * ID of the channel
   */
  channelId: string;
  
  /**
   * ID of the local agent
   */
  localAgentId: string;
  
  /**
   * ID of the remote agent
   */
  remoteAgentId: string;
  
  /**
   * Current state of the channel
   */
  state: ChannelState;
  
  /**
   * Security level of the channel
   */
  securityLevel: ChannelSecurityLevel;
  
  /**
   * When the channel was created
   */
  createdAt: Date;
  
  /**
   * When the channel was last used
   */
  lastUsedAt: Date;
}

/**
 * Options for channel creation
 */
export interface CreateChannelOptions {
  /**
   * ID of the remote agent
   */
  remoteAgentId: string;
  
  /**
   * Security level for the channel
   */
  securityLevel?: ChannelSecurityLevel;
  
  /**
   * Authentication method
   */
  authMethod?: ChannelAuthMethod;
  
  /**
   * Authentication credentials
   */
  authCredentials?: Record<string, unknown>;
  
  /**
   * Whether to automatically initialize the channel
   */
  autoInitialize?: boolean;
}

/**
 * Channel lookup options
 */
export interface ChannelLookupOptions {
  /**
   * Only return channels with this state
   */
  state?: ChannelState;
  
  /**
   * Only return channels with this security level
   */
  securityLevel?: ChannelSecurityLevel;
  
  /**
   * Only return channels created after this date
   */
  createdAfter?: Date;
  
  /**
   * Only return channels used after this date
   */
  usedAfter?: Date;
}

/**
 * Channel manager for an agent
 */
export class ChannelManager {
  /**
   * ID of the agent this channel manager belongs to
   */
  private readonly agentId: string;
  
  /**
   * Map of channel ID to channel
   */
  private readonly channels: Map<string, SecureChannel> = new Map();
  
  /**
   * Map of remote agent ID to channel ID
   */
  private readonly remoteAgentChannels: Map<string, string[]> = new Map();
  
  /**
   * Channel metadata
   */
  private readonly channelMetadata: Map<string, {
    localAgentId: string;
    remoteAgentId: string;
    securityLevel: ChannelSecurityLevel;
    createdAt: Date;
    lastUsedAt: Date;
  }> = new Map();
  
  /**
   * Create a new channel manager
   */
  constructor(agentId: string) {
    this.agentId = agentId;
  }
  
  /**
   * Create a new channel to a remote agent
   */
  async createChannel(options: CreateChannelOptions): Promise<SecureChannel> {
    // Create channel config
    const config: SecureChannelConfig = {
      localAgentId: this.agentId,
      remoteAgentId: options.remoteAgentId,
      securityLevel: options.securityLevel,
      authMethod: options.authMethod,
      authCredentials: options.authCredentials
    };
    
    // Create channel
    const channel = new SecureChannel(config);
    
    // Store channel
    const channelId = channel.getChannelId();
    this.channels.set(channelId, channel);
    
    // Store channel in remote agent map
    if (!this.remoteAgentChannels.has(options.remoteAgentId)) {
      this.remoteAgentChannels.set(options.remoteAgentId, []);
    }
    this.remoteAgentChannels.get(options.remoteAgentId)?.push(channelId);
    
    // Store metadata
    this.channelMetadata.set(channelId, {
      localAgentId: this.agentId,
      remoteAgentId: options.remoteAgentId,
      securityLevel: options.securityLevel ?? ChannelSecurityLevel.STANDARD,
      createdAt: new Date(),
      lastUsedAt: new Date()
    });
    
    // Initialize channel if requested
    if (options.autoInitialize) {
      await channel.initialize();
    }
    
    return channel;
  }
  
  /**
   * Get a channel by ID
   */
  getChannel(channelId: string): SecureChannel | undefined {
    // Update last used time
    const metadata = this.channelMetadata.get(channelId);
    if (metadata) {
      metadata.lastUsedAt = new Date();
    }
    
    return this.channels.get(channelId);
  }
  
  /**
   * Get all channels to a remote agent
   */
  getChannelsToAgent(remoteAgentId: string): SecureChannel[] {
    const channelIds = this.remoteAgentChannels.get(remoteAgentId) || [];
    return channelIds
      .map(id => this.channels.get(id))
      .filter(Boolean) as SecureChannel[];
  }
  
  /**
   * Get the "best" channel to a remote agent
   * 
   * This returns the most recently used channel that is in the READY state,
   * or the highest security level channel if multiple are available.
   */
  getBestChannelToAgent(remoteAgentId: string): SecureChannel | undefined {
    const channels = this.getChannelsToAgent(remoteAgentId);
    
    // Filter to ready channels
    const readyChannels = channels.filter(channel => 
      channel.getState() === ChannelState.READY
    );
    
    if (readyChannels.length === 0) {
      return undefined;
    }
    
    if (readyChannels.length === 1) {
      return readyChannels[0];
    }
    
    // Group by security level
    const channelsBySecurityLevel: Record<string, SecureChannel[]> = {};
    
    for (const channel of readyChannels) {
      const channelId = channel.getChannelId();
      const metadata = this.channelMetadata.get(channelId);
      
      if (!metadata) continue;
      
      const securityLevel = metadata.securityLevel;
      
      if (!channelsBySecurityLevel[securityLevel]) {
        channelsBySecurityLevel[securityLevel] = [];
      }
      
      channelsBySecurityLevel[securityLevel].push(channel);
    }
    
    // Get channels with highest security level
    const securityLevels = [
      ChannelSecurityLevel.MAXIMUM,
      ChannelSecurityLevel.HIGH,
      ChannelSecurityLevel.STANDARD
    ];
    
    for (const level of securityLevels) {
      const channels = channelsBySecurityLevel[level];
      if (channels && channels.length > 0) {
        // Sort by last used time (most recent first)
        return channels.sort((a, b) => {
          const metadataA = this.channelMetadata.get(a.getChannelId());
          const metadataB = this.channelMetadata.get(b.getChannelId());
          
          if (!metadataA || !metadataB) return 0;
          
          return metadataB.lastUsedAt.getTime() - metadataA.lastUsedAt.getTime();
        })[0];
      }
    }
    
    // Fallback to first channel
    return readyChannels[0];
  }
  
  /**
   * Get all channels
   */
  getAllChannels(options?: ChannelLookupOptions): ChannelInfo[] {
    const result: ChannelInfo[] = [];
    
    for (const [channelId, channel] of Array.from(this.channels.entries())) {
      const metadata = this.channelMetadata.get(channelId);
      
      if (!metadata) continue;
      
      // Apply filters
      if (options?.state && channel.getState() !== options.state) continue;
      if (options?.securityLevel && metadata.securityLevel !== options.securityLevel) continue;
      if (options?.createdAfter && metadata.createdAt < options.createdAfter) continue;
      if (options?.usedAfter && metadata.lastUsedAt < options.usedAfter) continue;
      
      // Add to result
      result.push({
        channelId,
        localAgentId: metadata.localAgentId,
        remoteAgentId: metadata.remoteAgentId,
        state: channel.getState(),
        securityLevel: metadata.securityLevel,
        createdAt: metadata.createdAt,
        lastUsedAt: metadata.lastUsedAt
      });
    }
    
    return result;
  }
  
  /**
   * Close a channel
   */
  async closeChannel(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    
    if (!channel) {
      return false;
    }
    
    // Close the channel
    await channel.close();
    
    // Remove from maps
    this.channels.delete(channelId);
    
    const metadata = this.channelMetadata.get(channelId);
    if (metadata) {
      const remoteAgentId = metadata.remoteAgentId;
      const channelIds = this.remoteAgentChannels.get(remoteAgentId) || [];
      const index = channelIds.indexOf(channelId);
      
      if (index >= 0) {
        channelIds.splice(index, 1);
        
        if (channelIds.length === 0) {
          this.remoteAgentChannels.delete(remoteAgentId);
        } else {
          this.remoteAgentChannels.set(remoteAgentId, channelIds);
        }
      }
      
      this.channelMetadata.delete(channelId);
    }
    
    return true;
  }
  
  /**
   * Close all channels to a remote agent
   */
  async closeAllChannelsToAgent(remoteAgentId: string): Promise<number> {
    const channelIds = this.remoteAgentChannels.get(remoteAgentId) || [];
    let closedCount = 0;
    
    for (const channelId of channelIds) {
      const success = await this.closeChannel(channelId);
      if (success) {
        closedCount++;
      }
    }
    
    return closedCount;
  }
  
  /**
   * Close all channels
   */
  async closeAllChannels(): Promise<number> {
    const channelIds = Array.from(this.channels.keys());
    let closedCount = 0;
    
    for (const channelId of channelIds) {
      const success = await this.closeChannel(channelId);
      if (success) {
        closedCount++;
      }
    }
    
    return closedCount;
  }
  
  /**
   * Get channel statistics
   */
  getChannelStats(): {
    totalChannels: number;
    channelsByState: Record<string, number>;
    channelsBySecurityLevel: Record<string, number>;
    channelsByRemoteAgent: Record<string, number>;
  } {
    const stats = {
      totalChannels: this.channels.size,
      channelsByState: {} as Record<string, number>,
      channelsBySecurityLevel: {} as Record<string, number>,
      channelsByRemoteAgent: {} as Record<string, number>
    };
    
    // Count channels by remote agent
    for (const [remoteAgentId, channelIds] of Array.from(this.remoteAgentChannels.entries())) {
      stats.channelsByRemoteAgent[remoteAgentId] = channelIds.length;
    }
    
    // Count channels by state and security level
    for (const [channelId, channel] of Array.from(this.channels.entries())) {
      const state = channel.getState();
      const metadata = this.channelMetadata.get(channelId);
      
      if (!metadata) continue;
      
      const securityLevel = metadata.securityLevel;
      
      // Count by state
      if (!stats.channelsByState[state]) {
        stats.channelsByState[state] = 0;
      }
      stats.channelsByState[state]++;
      
      // Count by security level
      if (!stats.channelsBySecurityLevel[securityLevel]) {
        stats.channelsBySecurityLevel[securityLevel] = 0;
      }
      stats.channelsBySecurityLevel[securityLevel]++;
    }
    
    return stats;
  }
} 