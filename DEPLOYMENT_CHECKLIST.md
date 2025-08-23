# Deployment Checklist

Follow this checklist to ensure your Slack AI Service is properly deployed and configured.

## Pre-Deployment

### 1. Environment Setup
- [ ] Create `.env.local` file with required variables
- [ ] Test the application locally with `npm run dev`
- [ ] Verify all AI providers are working
- [ ] Test the admin panel at `http://localhost:3000/admin`

### 2. Code Preparation
- [ ] All dependencies installed (`npm install`)
- [ ] TypeScript compilation successful (`npm run type-check`)
- [ ] No linting errors (`npm run lint`)
- [ ] Build successful (`npm run build`)

## Vercel Deployment

### 3. Deploy to Vercel
- [ ] Connect GitHub repository to Vercel
- [ ] Or deploy using Vercel CLI: `vercel --prod`
- [ ] Note your deployment URL (e.g., `https://your-app.vercel.app`)

### 4. Configure Environment Variables in Vercel
Go to Vercel Dashboard → Your Project → Settings → Environment Variables

**Required Variables:**
- [ ] `SLACK_BOT_TOKEN` - Your Slack bot token (xoxb-...)
- [ ] `SLACK_SIGNING_SECRET` - Your Slack app signing secret
- [ ] `SLACK_APP_TOKEN` - Your Slack app-level token (xapp-...)
- [ ] `OPENAI_API_KEY` - Your OpenAI API key (sk-...)
- [ ] `ANTHROPIC_API_KEY` - Your Anthropic API key (sk-ant-...)
- [ ] `NEXTAUTH_SECRET` - Random secret string for NextAuth
- [ ] `NEXTAUTH_URL` - Your Vercel deployment URL

**Optional Variables:**
- [ ] `DATABASE_URL` - If using persistent storage
- [ ] `NODE_ENV` - Set to "production"

### 5. Verify Deployment
- [ ] Visit your deployment URL
- [ ] Check `/api/health` endpoint
- [ ] Access admin panel at `/admin`
- [ ] Run verification script: `node scripts/verify-setup.js [your-url]`

## Slack App Configuration

### 6. Create Slack App
- [ ] Go to [Slack API Apps](https://api.slack.com/apps)
- [ ] Create new app "From scratch"
- [ ] Name your app and select workspace

### 7. Basic Information
- [ ] Copy **Signing Secret** → Set as `SLACK_SIGNING_SECRET`
- [ ] Add app icon and description (optional)

### 8. OAuth & Permissions
- [ ] Add required Bot Token Scopes:
  - `app_mentions:read`
  - `channels:history`
  - `channels:read`  
  - `chat:write`
  - `im:history`
  - `im:read`
  - `im:write`
  - `users:read`
- [ ] Install app to workspace
- [ ] Copy **Bot User OAuth Token** → Set as `SLACK_BOT_TOKEN`

### 9. Socket Mode (Development Only)
- [ ] Enable Socket Mode
- [ ] Generate App-Level Token → Set as `SLACK_APP_TOKEN`
- [ ] **Disable for production deployment**

### 10. Event Subscriptions
- [ ] Enable Event Subscriptions
- [ ] Set Request URL: `https://your-app.vercel.app/api/slack/events`
- [ ] Wait for verification ✅
- [ ] Subscribe to bot events:
  - `app_mention`
  - `message.channels`
  - `message.im`
- [ ] Save changes

### 11. Interactive Components (Optional)
- [ ] Enable Interactivity
- [ ] Set Request URL: `https://your-app.vercel.app/api/slack/interactivity`

### 12. Slash Commands (Optional)
- [ ] Create `/ai-tools` command
- [ ] Set Request URL: `https://your-app.vercel.app/api/slack/commands`

## Post-Deployment Testing

### 13. Basic Functionality
- [ ] Health check: `curl https://your-app.vercel.app/api/health`
- [ ] Admin panel accessible at `/admin`
- [ ] Environment variables properly loaded

### 14. Slack Integration
- [ ] Invite bot to a test channel: `/invite @YourBot`
- [ ] Test direct mention: `@YourBot hello`
- [ ] Test direct message to bot
- [ ] Test slash command: `/ai-tools`
- [ ] Verify responses are received

### 15. AI and MCP Tools
- [ ] Configure at least one AI provider (OpenAI or Anthropic)
- [ ] Test AI responses in Slack
- [ ] Add MCP server via admin panel
- [ ] Verify tools are discovered and available
- [ ] Test tool usage in Slack conversation

## Production Configuration

### 16. Channel Setup
- [ ] Access admin panel: `https://your-app.vercel.app/admin`
- [ ] Add channel configurations for target Slack channels
- [ ] Enable/disable auto-respond as needed
- [ ] Assign appropriate MCP tools to channels
- [ ] Set trigger words if using selective responses

### 17. MCP Server Configuration
- [ ] Add external MCP servers via admin UI
- [ ] Test tool discovery
- [ ] Verify tools appear in Vercel AI SDK
- [ ] Test tool execution in Slack

### 18. Monitoring and Maintenance
- [ ] Set up monitoring for Vercel functions
- [ ] Monitor Slack app event delivery
- [ ] Set up alerts for failed API calls
- [ ] Plan for regular MCP tool discovery refresh

## Security Checklist

### 19. Security Best Practices
- [ ] All API keys stored as environment variables (never in code)
- [ ] Slack request signature verification enabled
- [ ] Admin panel access secured (consider adding authentication)
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] Rate limiting considered for public endpoints

### 20. Access Control
- [ ] Bot permissions limited to necessary scopes
- [ ] Channel access controlled via admin panel
- [ ] MCP tool access restricted by channel
- [ ] Admin panel access secured

## Troubleshooting

### Common Issues:
- **Bot not responding**: Check environment variables and Slack event subscriptions
- **Verification failed**: Ensure Request URL is correct and service is deployed
- **Permission errors**: Verify bot scopes and channel membership
- **Tool not working**: Check MCP server connection and tool discovery

### Debug Commands:
```bash
# Check deployment health
curl https://your-app.vercel.app/api/health

# View Vercel logs
vercel logs your-project-name

# Test local setup
npm run dev
```

## Success Criteria

✅ **Deployment Complete When:**
- [ ] Health endpoint returns 200 with all checks passing
- [ ] Admin panel loads without errors
- [ ] Bot responds to mentions in Slack
- [ ] At least one AI provider is working
- [ ] MCP tools can be added and discovered
- [ ] Tools are usable in Slack conversations

---

**Need Help?**
- Check the logs in Vercel dashboard
- Review Slack app event delivery status
- Test individual API endpoints
- Use the verification script: `node scripts/verify-setup.js`