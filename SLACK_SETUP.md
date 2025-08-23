# Slack Integration Setup Guide

This guide will walk you through connecting your deployed service to Slack.

## Prerequisites

- Your service deployed on Vercel (or note your deployment URL)
- Slack workspace admin access
- The environment variables configured in Vercel

## Step 1: Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter:
   - **App Name**: `AI Assistant` (or your preferred name)
   - **Workspace**: Select your Slack workspace
5. Click **"Create App"**

## Step 2: Configure Basic Information

1. In your app dashboard, go to **"Basic Information"**
2. Under **"App Credentials"**, note down:
   - **Signing Secret** (you'll need this for `SLACK_SIGNING_SECRET`)
3. Scroll down to **"Display Information"**
4. Add an app icon and description (optional but recommended)

## Step 3: Set Up OAuth & Permissions

1. Go to **"OAuth & Permissions"** in the sidebar
2. Scroll down to **"Scopes"**
3. Under **"Bot Token Scopes"**, add these scopes:
   ```
   app_mentions:read
   channels:history
   channels:read
   chat:write
   im:history
   im:read
   im:write
   users:read
   ```

4. Scroll up to **"OAuth Tokens for Your Workspace"**
5. Click **"Install to Workspace"**
6. Review permissions and click **"Allow"**
7. Copy the **"Bot User OAuth Token"** (starts with `xoxb-`)
   - This is your `SLACK_BOT_TOKEN`

## Step 4: Enable Socket Mode (for development)

1. Go to **"Socket Mode"** in the sidebar
2. Toggle **"Enable Socket Mode"** to ON
3. Under **"Token Name"**, enter: `socket-token`
4. Click **"Generate"**
5. Copy the **App-Level Token** (starts with `xapp-`)
   - This is your `SLACK_APP_TOKEN`

## Step 5: Configure Event Subscriptions

1. Go to **"Event Subscriptions"** in the sidebar
2. Toggle **"Enable Events"** to ON
3. In **"Request URL"**, enter your Vercel deployment URL + `/api/slack/events`
   ```
   https://your-app-name.vercel.app/api/slack/events
   ```
4. Slack will send a verification request. If your service is deployed correctly, it should verify automatically.

5. Under **"Subscribe to bot events"**, add these events:
   ```
   app_mention
   message.channels
   message.im
   ```

6. Click **"Save Changes"**

## Step 6: Configure Interactive Components (Optional)

1. Go to **"Interactivity & Shortcuts"** in the sidebar
2. Toggle **"Interactivity"** to ON
3. Set **"Request URL"** to:
   ```
   https://your-app-name.vercel.app/api/slack/interactivity
   ```

## Step 7: Add Slash Commands (Optional)

1. Go to **"Slash Commands"** in the sidebar
2. Click **"Create New Command"**
3. Configure the `/ai-tools` command:
   - **Command**: `/ai-tools`
   - **Request URL**: `https://your-app-name.vercel.app/api/slack/commands`
   - **Short Description**: `Show available AI tools`
   - **Usage Hint**: `[channel]`

## Step 8: Configure Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```bash
# Required Slack Variables
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here

# Required AI Service Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Required NextAuth
NEXTAUTH_SECRET=your-random-secret-string
NEXTAUTH_URL=https://your-app-name.vercel.app

# Optional
NODE_ENV=production
```

5. Click **"Save"** and redeploy your app

## Step 9: Test the Integration

1. **Invite the bot to a channel**:
   - In Slack, go to any channel
   - Type `/invite @YourBotName`
   - Or go to channel settings → Integrations → Add apps

2. **Test direct mention**:
   ```
   @YourBotName hello, can you help me?
   ```

3. **Test direct message**:
   - Send a DM to your bot
   - It should respond automatically

4. **Test slash command**:
   ```
   /ai-tools
   ```

## Step 10: Configure Channel Settings (Admin Panel)

1. Go to your admin panel: `https://your-app-name.vercel.app/admin`
2. Click the **"Channels"** tab
3. Add channel configurations:
   - **Channel ID**: You can find this in Slack by right-clicking the channel → "Copy link" → extract the ID from the URL
   - **AI Provider**: Choose OpenAI or Anthropic
   - **Auto Respond**: Enable for automatic responses
   - **MCP Tools**: Select which tools to enable

## Troubleshooting

### Bot Not Responding

1. **Check Vercel logs**:
   ```bash
   vercel logs your-app-name
   ```

2. **Verify environment variables** in Vercel dashboard

3. **Check Slack Event Subscription URL**:
   - Go to your Slack app → Event Subscriptions
   - Re-verify the Request URL

### "App not responding" error

1. **Socket Mode**: Make sure Socket Mode is enabled for development
2. **Production**: For production, disable Socket Mode and use Event Subscriptions

### Events not received

1. **Bot permissions**: Ensure bot has required scopes
2. **Channel membership**: Bot must be invited to channels
3. **Event subscriptions**: Verify events are properly subscribed

### Environment Variables

```bash
# Check if variables are set correctly
curl -X POST https://your-app-name.vercel.app/api/health
```

## Development vs Production

### Development (Local)
- Use Socket Mode (easier for development)
- Use ngrok for webhook URLs if testing locally:
  ```bash
  ngrok http 3000
  # Use the ngrok URL for Slack webhooks
  ```

### Production (Vercel)
- Disable Socket Mode
- Use direct HTTPS webhooks
- Ensure all environment variables are set in Vercel

## Security Considerations

1. **Never commit API keys** to your repository
2. **Use environment variables** for all sensitive data
3. **Verify Slack requests** using signing secrets (handled automatically by Slack Bolt)
4. **Restrict bot permissions** to only what's needed

## Advanced Configuration

### Multiple Workspaces
To support multiple Slack workspaces, you'll need to:
1. Implement OAuth flow for installation
2. Store multiple workspace tokens
3. Handle workspace-specific configurations

### Custom App Distribution
To distribute your app to other workspaces:
1. Go to **"Manage Distribution"** in your Slack app
2. Complete the security checklist
3. Submit for review (if public distribution needed)