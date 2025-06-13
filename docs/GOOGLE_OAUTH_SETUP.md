# Google OAuth2 Setup Guide

This guide walks you through setting up Google OAuth2 credentials for workspace integration.

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" at the top
3. Click "New Project"
4. Enter a project name (e.g., "CW Agent Workspace")
5. Click "Create"

## Step 2: Enable Required APIs

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable the following APIs:
   - **Gmail API** - For email access
   - **Google Calendar API** - For calendar access
   - **Google Drive API** - For file access
   - **Google People API** - For contact information

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (unless you have a Google Workspace account)
3. Fill in the required information:
   - **App name**: CW Agent Workspace
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click "Save and Continue"
5. Add scopes (optional for testing, but recommended):
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
6. Add test users (your email address) if in testing mode
7. Click "Save and Continue"

## Step 4: Create OAuth2 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Enter a name (e.g., "CW Agent Workspace Client")
5. Add authorized redirect URIs:
   - For development: `http://localhost:3000/api/workspace/callback`
   - For production: `https://yourdomain.com/api/workspace/callback`
6. Click "Create"
7. Copy the **Client ID** and **Client Secret**

## Step 5: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Google Workspace Integration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/workspace/callback
```

## Step 6: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open your application and click on "Workspace" in the header
3. Try connecting to Google Workspace
4. You should be redirected to Google's OAuth consent screen

## Security Notes

- **Never commit your client secret to version control**
- Use different credentials for development and production
- Regularly rotate your client secrets
- Monitor API usage in the Google Cloud Console
- Consider using service accounts for server-to-server operations

## Troubleshooting

### "redirect_uri_mismatch" Error
- Ensure the redirect URI in your Google Cloud Console exactly matches the one in your environment variables
- Check for trailing slashes or protocol mismatches (http vs https)

### "access_denied" Error
- Make sure your app is not in testing mode, or add your email as a test user
- Check that you've enabled the required APIs

### "invalid_client" Error
- Verify your client ID and client secret are correct
- Ensure there are no extra spaces or characters in your environment variables

## Production Considerations

1. **Domain Verification**: Verify your domain in Google Search Console
2. **App Verification**: Submit your app for verification if you need access to sensitive scopes
3. **Rate Limits**: Monitor and respect Google's API rate limits
4. **Error Handling**: Implement proper error handling for expired tokens
5. **Security**: Use HTTPS in production and secure your client secrets

## Next Steps

Once you have Google OAuth2 working:
1. Test the workspace connection flow
2. Verify that connections are stored in the database
3. Test the connection validation and revocation features
4. Set up Microsoft 365 and Zoho providers (future phases) 