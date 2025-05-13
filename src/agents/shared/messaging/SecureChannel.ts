/**
 * SecureChannel.ts - Secure communication channel between agents
 * 
 * This module implements secure communication channels between agents with
 * strong encryption, authentication, and message integrity verification.
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Security level for the channel
 */
export enum ChannelSecurityLevel {
  /**
   * Standard encryption for most communications
   */
  STANDARD = 'standard',
  
  /**
   * High-security channel with stronger encryption
   */
  HIGH = 'high',
  
  /**
   * Maximum security with additional authentication layers
   */
  MAXIMUM = 'maximum'
}

/**
 * Channel authentication method
 */
export enum ChannelAuthMethod {
  /**
   * Shared key authentication
   */
  SHARED_KEY = 'shared_key',
  
  /**
   * Token-based authentication
   */
  TOKEN = 'token',
  
  /**
   * Multi-factor authentication
   */
  MULTI_FACTOR = 'multi_factor'
}

/**
 * Channel state
 */
export enum ChannelState {
  /**
   * Channel has been created but not initialized
   */
  CREATED = 'created',
  
  /**
   * Channel initialization in progress
   */
  INITIALIZING = 'initializing',
  
  /**
   * Channel is ready for use
   */
  READY = 'ready',
  
  /**
   * Channel is paused
   */
  PAUSED = 'paused',
  
  /**
   * Channel is closed
   */
  CLOSED = 'closed',
  
  /**
   * Channel has encountered an error
   */
  ERROR = 'error'
}

/**
 * Configuration for a secure channel
 */
export interface SecureChannelConfig {
  /**
   * ID of the local agent (this end of the channel)
   */
  localAgentId: string;
  
  /**
   * ID of the remote agent (other end of the channel)
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
   * Authentication credentials (varies by method)
   */
  authCredentials?: Record<string, unknown>;
  
  /**
   * Whether to enable message signing
   */
  enableSigning?: boolean;
  
  /**
   * Time-to-live for messages in milliseconds
   */
  messageTtl?: number;
}

/**
 * Message to be sent through the secure channel
 */
export interface ChannelMessage {
  /**
   * Unique ID for the message
   */
  id: string;
  
  /**
   * Payload of the message
   */
  payload: unknown;
  
  /**
   * Timestamp when the message was created
   */
  timestamp: number;
  
  /**
   * Message expiration time (epoch milliseconds)
   */
  expiration?: number;
  
  /**
   * Message signature (if signing is enabled)
   */
  signature?: string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Encrypted message format
 */
interface EncryptedMessage {
  /**
   * Message ID
   */
  id: string;
  
  /**
   * Initialization vector for encryption
   */
  iv: string;
  
  /**
   * Encrypted content
   */
  content: string;
  
  /**
   * Authentication tag
   */
  authTag?: string;
  
  /**
   * Timestamp when the message was created
   */
  timestamp: number;
  
  /**
   * Message expiration time (epoch milliseconds)
   */
  expiration?: number;
}

/**
 * Event listener for channel events
 */
export type ChannelEventListener = (event: string, data?: unknown) => void;

/**
 * Secure communication channel between agents
 */
export class SecureChannel {
  /**
   * Unique identifier for this channel
   */
  private readonly channelId: string;
  
  /**
   * Channel configuration
   */
  private readonly config: Required<SecureChannelConfig>;
  
  /**
   * Encryption key for this channel
   */
  private encryptionKey?: Buffer;
  
  /**
   * Signing key for this channel
   */
  private signingKey?: Buffer;
  
  /**
   * Current state of the channel
   */
  private state: ChannelState = ChannelState.CREATED;
  
  /**
   * Event listeners
   */
  private eventListeners: Record<string, ChannelEventListener[]> = {};
  
  /**
   * Create a new secure channel
   */
  constructor(config: SecureChannelConfig) {
    this.channelId = uuidv4();
    
    // Set default configuration values
    this.config = {
      localAgentId: config.localAgentId,
      remoteAgentId: config.remoteAgentId,
      securityLevel: config.securityLevel ?? ChannelSecurityLevel.STANDARD,
      authMethod: config.authMethod ?? ChannelAuthMethod.SHARED_KEY,
      authCredentials: config.authCredentials ?? {},
      enableSigning: config.enableSigning ?? true,
      messageTtl: config.messageTtl ?? 60 * 60 * 1000 // 1 hour
    };
  }
  
  /**
   * Get the channel ID
   */
  getChannelId(): string {
    return this.channelId;
  }
  
  /**
   * Get the current state of the channel
   */
  getState(): ChannelState {
    return this.state;
  }
  
  /**
   * Initialize the secure channel
   * 
   * This sets up encryption keys and performs authentication
   */
  async initialize(): Promise<boolean> {
    try {
      // Update state
      this.state = ChannelState.INITIALIZING;
      this.emitEvent('initializing');
      
      // Generate or load encryption key based on authentication method
      switch (this.config.authMethod) {
        case ChannelAuthMethod.SHARED_KEY:
          await this.initializeWithSharedKey();
          break;
        case ChannelAuthMethod.TOKEN:
          await this.initializeWithToken();
          break;
        case ChannelAuthMethod.MULTI_FACTOR:
          await this.initializeWithMultiFactor();
          break;
        default:
          throw new Error(`Unsupported authentication method: ${this.config.authMethod}`);
      }
      
      // Generate signing key if signing is enabled
      if (this.config.enableSigning) {
        this.signingKey = await this.generateSigningKey();
      }
      
      // Update state
      this.state = ChannelState.READY;
      this.emitEvent('ready');
      
      return true;
    } catch (error) {
      // Update state
      this.state = ChannelState.ERROR;
      this.emitEvent('error', error);
      
      return false;
    }
  }
  
  /**
   * Initialize with shared key authentication
   */
  private async initializeWithSharedKey(): Promise<void> {
    const sharedSecret = this.config.authCredentials.sharedSecret;
    
    if (!sharedSecret || typeof sharedSecret !== 'string') {
      throw new Error('Shared secret is required for SHARED_KEY authentication');
    }
    
    // Derive encryption key from shared secret
    this.encryptionKey = await this.deriveKeyFromSecret(
      sharedSecret,
      this.getKeySize()
    );
  }
  
  /**
   * Initialize with token authentication
   */
  private async initializeWithToken(): Promise<void> {
    const token = this.config.authCredentials.token;
    
    if (!token || typeof token !== 'string') {
      throw new Error('Token is required for TOKEN authentication');
    }
    
    // Fetch encryption key using token
    this.encryptionKey = await this.deriveKeyFromToken(token);
  }
  
  /**
   * Initialize with multi-factor authentication
   */
  private async initializeWithMultiFactor(): Promise<void> {
    const primaryFactor = this.config.authCredentials.primaryFactor;
    const secondaryFactor = this.config.authCredentials.secondaryFactor;
    
    if (!primaryFactor || !secondaryFactor) {
      throw new Error('Both primary and secondary factors are required for MULTI_FACTOR authentication');
    }
    
    // Combine factors to derive encryption key
    this.encryptionKey = await this.deriveKeyFromMultipleFactors(
      primaryFactor,
      secondaryFactor,
      this.getKeySize()
    );
  }
  
  /**
   * Get the appropriate key size based on security level
   */
  private getKeySize(): number {
    switch (this.config.securityLevel) {
      case ChannelSecurityLevel.STANDARD:
        return 16; // 128 bits
      case ChannelSecurityLevel.HIGH:
        return 24; // 192 bits
      case ChannelSecurityLevel.MAXIMUM:
        return 32; // 256 bits
      default:
        return 16; // 128 bits default
    }
  }
  
  /**
   * Derive encryption key from a secret
   */
  private async deriveKeyFromSecret(secret: string, keyLength: number): Promise<Buffer> {
    // In a real implementation, this would use a proper key derivation function like PBKDF2
    // This is a simplified version for demonstration
    const keyMaterial = createHash('sha256').update(secret).digest();
    return keyMaterial.slice(0, keyLength);
  }
  
  /**
   * Derive encryption key from a token
   */
  private async deriveKeyFromToken(token: string): Promise<Buffer> {
    // In a real implementation, this would verify the token with an auth service
    // and then derive a key based on the verified token
    const keyMaterial = createHash('sha256')
      .update(`${token}_${this.config.localAgentId}_${this.config.remoteAgentId}`)
      .digest();
    
    return keyMaterial.slice(0, this.getKeySize());
  }
  
  /**
   * Derive encryption key from multiple authentication factors
   */
  private async deriveKeyFromMultipleFactors(
    primaryFactor: unknown,
    secondaryFactor: unknown,
    keyLength: number
  ): Promise<Buffer> {
    // In a real implementation, this would use a proper key derivation function
    // This is a simplified version for demonstration
    const combinedFactors = `${JSON.stringify(primaryFactor)}_${JSON.stringify(secondaryFactor)}`;
    const keyMaterial = createHash('sha256').update(combinedFactors).digest();
    return keyMaterial.slice(0, keyLength);
  }
  
  /**
   * Generate a signing key
   */
  private async generateSigningKey(): Promise<Buffer> {
    // In a real implementation, this would use a proper signing key generation algorithm
    if (!this.encryptionKey) throw new Error('Encryption key must be initialized first');
    
    return createHash('sha256')
      .update(this.encryptionKey)
      .update('signing_key_material')
      .digest();
  }
  
  /**
   * Sign a message
   */
  private signMessage(message: ChannelMessage): string {
    if (!this.signingKey) throw new Error('Signing key not initialized');
    
    const content = JSON.stringify({
      id: message.id,
      payload: message.payload,
      timestamp: message.timestamp,
      expiration: message.expiration
    });
    
    return createHash('sha256')
      .update(this.signingKey)
      .update(content)
      .digest('hex');
  }
  
  /**
   * Verify a message signature
   */
  private verifySignature(message: ChannelMessage): boolean {
    if (!this.signingKey || !message.signature) return false;
    
    const expectedSignature = this.signMessage(message);
    return expectedSignature === message.signature;
  }
  
  /**
   * Encrypt a message
   */
  private encryptMessage(message: ChannelMessage): EncryptedMessage {
    if (!this.encryptionKey) throw new Error('Encryption key not initialized');
    
    // Generate initialization vector
    const iv = randomBytes(16);
    
    // Serialize message content
    const content = JSON.stringify({
      payload: message.payload,
      metadata: message.metadata,
      signature: message.signature
    });
    
    // Create cipher
    const algorithm = this.getEncryptionAlgorithm();
    const cipher = createCipheriv(algorithm, this.encryptionKey, iv);
    
    // Encrypt content
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag if applicable
    const authTag = algorithm.includes('gcm') ? 
      // Use type assertion for GCM cipher
      (cipher as unknown as { getAuthTag(): Buffer }).getAuthTag().toString('hex') : 
      undefined;
    
    // Create encrypted message
    return {
      id: message.id,
      iv: iv.toString('hex'),
      content: encrypted,
      authTag,
      timestamp: message.timestamp,
      expiration: message.expiration
    };
  }
  
  /**
   * Decrypt an encrypted message
   */
  private decryptMessage(encryptedMessage: EncryptedMessage): ChannelMessage {
    if (!this.encryptionKey) throw new Error('Encryption key not initialized');
    
    // Convert IV from hex string to Buffer
    const iv = Buffer.from(encryptedMessage.iv, 'hex');
    
    // Create decipher
    const algorithm = this.getEncryptionAlgorithm();
    const decipher = createDecipheriv(algorithm, this.encryptionKey, iv);
    
    // Set authentication tag if applicable
    if (algorithm.includes('gcm') && encryptedMessage.authTag) {
      // Use type assertion for GCM decipher
      (decipher as unknown as { setAuthTag(tag: Buffer): void })
        .setAuthTag(Buffer.from(encryptedMessage.authTag, 'hex'));
    }
    
    // Decrypt content
    let decrypted = decipher.update(encryptedMessage.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse decrypted content
    const decryptedContent = JSON.parse(decrypted);
    
    // Create channel message
    return {
      id: encryptedMessage.id,
      payload: decryptedContent.payload,
      timestamp: encryptedMessage.timestamp,
      expiration: encryptedMessage.expiration,
      signature: decryptedContent.signature,
      metadata: decryptedContent.metadata
    };
  }
  
  /**
   * Get the encryption algorithm based on security level
   */
  private getEncryptionAlgorithm(): string {
    switch (this.config.securityLevel) {
      case ChannelSecurityLevel.STANDARD:
        return 'aes-128-cbc';
      case ChannelSecurityLevel.HIGH:
        return 'aes-192-cbc';
      case ChannelSecurityLevel.MAXIMUM:
        return 'aes-256-gcm';
      default:
        return 'aes-128-cbc';
    }
  }
  
  /**
   * Send a message through the secure channel
   */
  async sendMessage(payload: unknown, metadata?: Record<string, unknown>): Promise<string> {
    // Check channel state
    if (this.state !== ChannelState.READY) {
      throw new Error(`Cannot send message when channel is in state: ${this.state}`);
    }
    
    // Create message
    const messageId = uuidv4();
    const timestamp = Date.now();
    const expiration = timestamp + this.config.messageTtl;
    
    const message: ChannelMessage = {
      id: messageId,
      payload,
      timestamp,
      expiration,
      metadata
    };
    
    // Sign message if signing is enabled
    if (this.config.enableSigning && this.signingKey) {
      message.signature = this.signMessage(message);
    }
    
    // Encrypt message
    const encryptedMessage = this.encryptMessage(message);
    
    // Emit message sent event
    this.emitEvent('messageSent', { messageId, timestamp });
    
    // In a real implementation, this would send the encrypted message to the remote agent
    // For now, we'll just return the message ID
    return messageId;
  }
  
  /**
   * Receive an encrypted message
   */
  async receiveMessage(encryptedMessage: EncryptedMessage): Promise<ChannelMessage | null> {
    // Check channel state
    if (this.state !== ChannelState.READY) {
      throw new Error(`Cannot receive message when channel is in state: ${this.state}`);
    }
    
    try {
      // Check message expiration
      if (encryptedMessage.expiration && encryptedMessage.expiration < Date.now()) {
        this.emitEvent('messageExpired', { messageId: encryptedMessage.id });
        return null;
      }
      
      // Decrypt message
      const message = this.decryptMessage(encryptedMessage);
      
      // Verify signature if signing is enabled
      if (this.config.enableSigning && message.signature) {
        const isValid = this.verifySignature(message);
        if (!isValid) {
          this.emitEvent('invalidSignature', { messageId: message.id });
          return null;
        }
      }
      
      // Emit message received event
      this.emitEvent('messageReceived', { messageId: message.id, timestamp: message.timestamp });
      
      return message;
    } catch (error) {
      // Emit error event
      this.emitEvent('error', { messageId: encryptedMessage.id, error });
      return null;
    }
  }
  
  /**
   * Close the channel
   */
  async close(): Promise<void> {
    // Update state
    this.state = ChannelState.CLOSED;
    
    // Clear sensitive data
    this.encryptionKey = undefined;
    this.signingKey = undefined;
    
    // Emit closed event
    this.emitEvent('closed');
  }
  
  /**
   * Add an event listener
   */
  addEventListener(event: string, listener: ChannelEventListener): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(listener);
  }
  
  /**
   * Remove an event listener
   */
  removeEventListener(event: string, listener: ChannelEventListener): void {
    if (!this.eventListeners[event]) return;
    
    this.eventListeners[event] = this.eventListeners[event].filter(l => l !== listener);
  }
  
  /**
   * Emit an event
   */
  private emitEvent(event: string, data?: unknown): void {
    if (!this.eventListeners[event]) return;
    
    for (const listener of this.eventListeners[event]) {
      listener(event, data);
    }
  }
} 