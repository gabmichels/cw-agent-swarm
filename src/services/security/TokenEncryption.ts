import * as crypto from 'crypto';

export class TokenEncryption {
  private readonly algorithm = 'aes-256-cbc';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 32;
  private readonly iterations = 100000;
  private masterKey: string;

  constructor(masterKey?: string) {
    this.masterKey = masterKey || process.env.ENCRYPTION_MASTER_KEY || this.generateSecureKey();
    if (this.masterKey === 'default-key-change-in-production' || this.masterKey.length < 32) {
      console.warn('⚠️  WARNING: Using weak encryption key. Set ENCRYPTION_MASTER_KEY environment variable.');
    }
  }

  private generateSecureKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(this.masterKey, salt, this.iterations, this.keyLength, 'sha256');
  }

  encrypt(plaintext: string): string {
    const salt = crypto.randomBytes(this.saltLength);
    const iv = crypto.randomBytes(this.ivLength);
    const encKey = this.deriveKey(salt);
    const cipher = crypto.createCipheriv(this.algorithm, encKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const combined = Buffer.concat([salt, iv, Buffer.from(encrypted, 'hex')]);
    return combined.toString('base64');
  }

  decrypt(encryptedData: string): string {
    const combined = Buffer.from(encryptedData, 'base64');
    const salt = combined.subarray(0, this.saltLength);
    const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength);
    const encrypted = combined.subarray(this.saltLength + this.ivLength);
    const encKey = this.deriveKey(salt);
    const decipher = crypto.createDecipheriv(this.algorithm, encKey, iv);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  encryptTokens(tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  }): string {
    const tokenData = { ...tokens, encrypted_at: new Date().toISOString(), version: '1.0' };
    return this.encrypt(JSON.stringify(tokenData));
  }

  decryptTokens(encryptedTokens: string): {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
    encrypted_at?: string;
    version?: string;
  } {
    const decrypted = this.decrypt(encryptedTokens);
    return JSON.parse(decrypted);
  }

  areTokensExpired(encryptedTokens: string): boolean {
    try {
      const tokens = this.decryptTokens(encryptedTokens);
      if (!tokens.expires_in || !tokens.encrypted_at) return false;
      const encryptedAt = new Date(tokens.encrypted_at);
      const expiresAt = new Date(encryptedAt.getTime() + (tokens.expires_in * 1000));
      return new Date() > expiresAt;
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true;
    }
  }
}

export const tokenEncryption = new TokenEncryption();
