# Security Setup Guide

## Environment Variables Required

```bash
# Master encryption key for all tokens (REQUIRED)
ENCRYPTION_MASTER_KEY=your-64-character-hex-key-here

# Social Media OAuth Credentials  
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

# Workspace OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret

# Application URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Generate Secure Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Security Features

### Token Encryption (All Platforms)
- **Algorithm**: AES-256-CBC with HMAC authentication
- **Key Derivation**: PBKDF2 (100,000 iterations)  
- **Scope**: Social media tokens AND workspace tokens
- **Storage**: All tokens encrypted before database storage
- **API Security**: Sensitive tokens never exposed in API responses

### OAuth State Management
- **Storage**: Database-backed with auto-expiry (10 minutes)
- **Cleanup**: Automatic cleanup of expired states
- **PKCE Support**: Full PKCE for Twitter OAuth 2.0
- **Cross-Platform**: Unified state management for all providers

### Database Security
- **Encryption at Rest**: All OAuth tokens encrypted
- **Audit Logging**: Complete audit trail
- **Connection Pooling**: Proper database management
- **Transactions**: ACID compliance

## Production Checklist

- [ ] Set secure `ENCRYPTION_MASTER_KEY` (64-character hex)
- [ ] Never commit keys to version control
- [ ] Use HTTPS for OAuth callbacks
- [ ] Monitor audit logs
- [ ] Test token refresh functionality
- [ ] Verify API responses don't expose tokens

## Token Migration

If upgrading from plain text tokens:
1. Existing tokens are automatically encrypted on first database access
2. Migration is transparent to end users
3. No manual intervention required
4. Backup database before major updates

## Troubleshooting

### "Using weak encryption key" Warning
- Set `ENCRYPTION_MASTER_KEY` environment variable
- Ensure key is 64 characters (32 bytes in hex)

### "Decryption failed" Errors
- Check if encryption key changed
- Verify key format (hex string)
- Check for data corruption

### OAuth State Errors
- Verify database connectivity
- Check state expiration (10 minutes)
- Ensure proper cleanup is running
