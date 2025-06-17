# Multi-Tenant Social Media Integration Setup Guide

## 🏗️ **Complete Multi-Platform Architecture**

This guide covers setting up OAuth applications for **ALL** social media platforms in our multi-tenant SaaS architecture. Each platform follows the same pattern: **One app serves unlimited customers**.

### 🎯 **Architecture Overview**

```
Your SaaS App (One OAuth App per Platform)
├── Twitter OAuth App → Serves all customers
├── LinkedIn OAuth App → Serves all customers  
├── TikTok OAuth App → Serves all customers
├── Facebook OAuth App → Serves all customers
├── Instagram OAuth App → Serves all customers
└── Reddit OAuth App → Serves all customers

Each Customer Company
├── Connects their own Twitter accounts
├── Connects their own LinkedIn accounts
├── Connects their own TikTok accounts
└── Posts appear as THEM, not your SaaS app
```

---

## 🐦 **1. Twitter/X Setup**

### Create Twitter Developer App

1. **Go to Twitter Developer Portal**
   - Visit: https://developer.twitter.com/en/portal/dashboard
   - Sign in with your Twitter account

2. **Create New App**
   - Click "Create App"
   - App Name: `YourSaaS Social Media Manager`
   - Description: `Multi-tenant social media management platform`

3. **Configure OAuth 2.0**
   ```
   App Type: Web App
   
   # For Local Development:
   Callback URLs: http://localhost:3000/api/social-media/callback/twitter
   Website URL: http://localhost:3000
   
   # For Production:
   Callback URLs: https://yourdomain.com/api/social-media/callback/twitter
   Website URL: https://yourdomain.com
   Terms of Service: https://yourdomain.com/terms
   Privacy Policy: https://yourdomain.com/privacy
   ```

4. **Required Permissions**
   - ✅ Read Tweets
   - ✅ Write Tweets  
   - ✅ Read Users
   - ✅ Offline Access (for refresh tokens)

5. **Environment Variables**
   ```bash
   TWITTER_CLIENT_ID=your_client_id
   TWITTER_CLIENT_SECRET=your_client_secret
   ```

---

## 💼 **2. LinkedIn Setup**

### Create LinkedIn Developer App

1. **Go to LinkedIn Developer Portal**
   - Visit: https://www.linkedin.com/developers/apps
   - Sign in with your LinkedIn account

2. **Create New App**
   - App Name: `YourSaaS Social Media Manager`
   - LinkedIn Page: Your company page
   - App Logo: Your SaaS logo

3. **Configure OAuth 2.0**
   ```
   # For Local Development:
   Authorized Redirect URLs: 
   http://localhost:3000/api/social-media/callback/linkedin
   
   # For Production:
   Authorized Redirect URLs: 
   https://yourdomain.com/api/social-media/callback/linkedin
   ```

4. **Required Products** (Request these from LinkedIn)
   - ✅ **Sign In with LinkedIn using OpenID Connect** (provides: `openid`, `profile`, `email`)
   - ✅ **Share on LinkedIn** (provides: `w_member_social`)
   - ✅ **Marketing Developer Platform** (optional, for company pages)

5. **Environment Variables**
   ```bash
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
   ```

---

## 🎵 **3. TikTok Setup**

### Create TikTok Developer App

1. **Go to TikTok for Developers**
   - Visit: https://developers.tiktok.com/
   - Sign in with your TikTok account

2. **Create New App**
   - App Name: `YourSaaS Social Media Manager`
   - App Type: `Web`
   - Category: `Social Media Management`

3. **Configure OAuth 2.0**
   ```
   # For Local Development:
   Redirect URI: http://localhost:3000/api/social-media/callback/tiktok
   
   # For Production:
   Redirect URI: https://yourdomain.com/api/social-media/callback/tiktok
   ```

4. **Required Scopes**
   - ✅ user.info.basic
   - ✅ video.list
   - ✅ video.upload
   - ✅ video.publish

5. **Environment Variables**
   ```bash
   TIKTOK_CLIENT_ID=your_client_key
   TIKTOK_CLIENT_SECRET=your_client_secret
   ```

---

## 📘 **4. Facebook Setup**

### Create Facebook Developer App

1. **Go to Facebook for Developers**
   - Visit: https://developers.facebook.com/
   - Sign in with your Facebook account

2. **Create New App**
   - App Type: `Business`
   - App Name: `YourSaaS Social Media Manager`
   - Contact Email: your-email@domain.com

3. **Add Facebook Login Product**
   ```
   # For Local Development:
   Valid OAuth Redirect URIs:
   http://localhost:3000/api/social-media/callback/facebook
   
   # For Production:
   Valid OAuth Redirect URIs:
   https://yourdomain.com/api/social-media/callback/facebook
   ```

4. **Required Permissions**
   - ✅ pages_manage_posts
   - ✅ pages_read_engagement
   - ✅ pages_show_list
   - ✅ publish_to_groups (if needed)

5. **Environment Variables**
   ```bash
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   ```

---

## 📸 **5. Instagram Setup**

### Create Instagram Basic Display App

1. **Use Facebook Developer Console**
   - Instagram uses Facebook's developer platform
   - Add "Instagram Basic Display" to your Facebook app

2. **Configure Instagram Product**
   ```
   # For Local Development:
   Valid OAuth Redirect URIs:
   http://localhost:3000/api/social-media/callback/instagram
   
   # For Production:
   Valid OAuth Redirect URIs:
   https://yourdomain.com/api/social-media/callback/instagram
   ```

3. **Required Permissions**
   - ✅ instagram_basic
   - ✅ instagram_content_publish
   - ✅ instagram_manage_insights

4. **Environment Variables**
   ```bash
   INSTAGRAM_CLIENT_ID=your_instagram_app_id
   INSTAGRAM_CLIENT_SECRET=your_instagram_app_secret
   ```

---

## 🤖 **6. Reddit Setup**

### Create Reddit App

1. **Go to Reddit App Preferences**
   - Visit: https://www.reddit.com/prefs/apps
   - Sign in with your Reddit account

2. **Create New App**
   - App Type: `web app`
   - Name: `YourSaaS Social Media Manager`
   - Description: `Multi-tenant social media management`
   - **For Local Development:**
     - Redirect URI: `http://localhost:3000/api/social-media/callback/reddit`
   - **For Production:**
     - Redirect URI: `https://yourdomain.com/api/social-media/callback/reddit`

3. **Required Scopes**
   - ✅ identity
   - ✅ submit
   - ✅ read
   - ✅ edit

4. **Environment Variables**
   ```bash
   REDDIT_CLIENT_ID=your_client_id
   REDDIT_CLIENT_SECRET=your_client_secret
   ```

---

## 🔐 **Environment Configuration**

### Complete .env.local File

```bash
# Social Media OAuth Credentials
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

TIKTOK_CLIENT_ID=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret

FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

INSTAGRAM_CLIENT_ID=your_instagram_app_id
INSTAGRAM_CLIENT_SECRET=your_instagram_app_secret

REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# Security Configuration
ENCRYPTION_MASTER_KEY=your_64_character_hex_key
SOCIAL_MEDIA_JWT_SECRET=your_jwt_secret

# App Configuration
# For Local Development:
NEXT_PUBLIC_APP_URL=http://localhost:3000

# For Production:
# NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## 🚀 **Testing the Integration**

### 1. Test OAuth Flows

```bash
# Test Twitter connection
curl -X POST http://localhost:3000/api/social-media/connect \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "accountType": "personal",
    "tenantId": "test_tenant",
    "userId": "test_user"
  }'

# Test LinkedIn connection
curl -X POST http://localhost:3000/api/social-media/connect \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "linkedin",
    "accountType": "company",
    "tenantId": "test_tenant",
    "userId": "test_user"
  }'

# Test TikTok connection
curl -X POST http://localhost:3000/api/social-media/connect \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "tiktok",
    "accountType": "creator",
    "tenantId": "test_tenant",
    "userId": "test_user"
  }'
```

### 2. Test Platform Information

```bash
# Get all available platforms
curl http://localhost:3000/api/social-media/connect
```

---

## 🏢 **Multi-Tenant Architecture Benefits**

### ✅ **Scalability**
- **One app serves unlimited customers**
- No need to create separate apps for each client
- Centralized management and monitoring

### ✅ **Authentic Posting**
- Posts appear as the customer's brand
- Not as your SaaS application
- Maintains brand authenticity

### ✅ **Security & Isolation**
- Each tenant's data is completely isolated
- Encrypted token storage per tenant
- No cross-tenant data access

### ✅ **Easy Onboarding**
- Customers connect their own accounts
- Self-service OAuth flows
- No manual setup required

---

## 🔧 **Implementation Status**

### ✅ **Completed Platforms**
- [x] **Twitter/X** - Full OAuth + posting
- [x] **LinkedIn** - Full OAuth + posting  
- [x] **TikTok** - Full OAuth + video upload
- [x] **Facebook** - Full OAuth + posting + scheduling + analytics
- [x] **Instagram** - Full OAuth + posting + stories + analytics

### 🚧 **Pending Platforms** (Easy to add)
- [ ] **Reddit** - Provider class ready

### 📋 **Adding New Platforms**

To add a new platform:

1. **Create Provider Class**
   ```typescript
   export class MultiTenantNewPlatformProvider extends MultiTenantProviderBase {
     // Implement abstract methods
   }
   ```

2. **Add to Provider Registry**
   ```typescript
   const providers = {
     // ... existing
     newplatform: () => new MultiTenantNewPlatformProvider(),
   };
   ```

3. **Configure OAuth App** (following this guide)

4. **Add Environment Variables**

---

## 🎯 **Next Steps**

1. **Set up OAuth apps** for all platforms you want to support
2. **Configure environment variables** with your credentials
3. **Test OAuth flows** using the provided curl commands
4. **Integrate with your UI** using the API endpoints
5. **Add database persistence** for production use

The architecture is designed to be **platform-agnostic** and **infinitely scalable** - perfect for a multi-tenant SaaS platform! 🚀 