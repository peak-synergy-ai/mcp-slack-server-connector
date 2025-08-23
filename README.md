# Slack AI Service with MCP Tools

A TypeScript web service hosted on Vercel that connects your Slack organization to AI chat services with Model Context Protocol (MCP) tools integration.

## Features

- 🤖 **AI Chat Integration**: Connect multiple AI services (OpenAI, Claude, etc.)
- 🔧 **MCP Tools**: Pluggable tools via Model Context Protocol
- 💬 **Slack Integration**: Respond in channels or via direct mentions
- 🎛️ **Web UI**: Configure MCP tools and manage integrations
- ⚡ **Serverless**: Optimized for Vercel deployment
- 🔐 **Secure**: Proper authentication and API key management

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Slack workspace admin access
- Vercel account
- AI service API keys (OpenAI, Anthropic, etc.)

### 1. Clone and Install

```bash
git clone <your-repo>
cd slack-ai-service
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env.local` and fill in your credentials:

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# AI Service Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Application
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://your-domain.vercel.app
```

### 3. Slack App Setup

1. Go to [Slack API](https://api.slack.com/apps) and create a new app
2. Enable **Socket Mode** and generate an App Token
3. Add these **Bot Token Scopes**:
   - `app_mentions:read`
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `im:history`
   - `im:read`
   - `im:write`
4. Subscribe to these **Events**:
   - `app_mention`
   - `message.channels`
   - `message.im`
5. Install the app to your workspace

### 4. Deploy to Vercel

```bash
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments.

### 5. Configure MCP Tools

1. Visit your deployed app's admin panel: `https://your-domain.vercel.app/admin`
2. Add and configure MCP tools
3. Set up channel-specific tool routing

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Slack     │───▶│   Vercel     │───▶│ AI Services │
│  Workspace  │    │  Web Service │    │   + MCP     │
└─────────────┘    └──────────────┘    └─────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │  Admin UI    │
                   │ (MCP Config) │
                   └──────────────┘
```

## Usage

### In Slack Channels

- **Direct mention**: `@YourBot help me with this task`
- **Auto-response**: Configure channels for automatic AI responses
- **Tool routing**: Different channels can use different MCP tool sets

### Admin Interface

Access the web UI at `/admin` to:
- Configure MCP tools and their parameters
- Set up channel-specific routing rules
- Monitor usage and logs
- Manage AI service integrations

## MCP Tools Integration

The service supports any MCP-compatible tools. Example tools included:

- **File System**: Read/write files and directories
- **Git**: Repository operations and version control
- **Database**: Query databases and manage data
- **APIs**: Call external REST/GraphQL APIs
- **Custom Tools**: Add your own MCP implementations

### Adding Custom MCP Tools

1. Implement the MCP tool interface
2. Register it in the admin panel
3. Configure routing rules for Slack channels

## API Endpoints

- `POST /api/slack/events` - Slack event webhook
- `POST /api/slack/interactivity` - Slack interactive components
- `GET /api/mcp/tools` - List available MCP tools
- `POST /api/mcp/tools` - Add/update MCP tool
- `POST /api/ai/chat` - Direct AI chat API

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SLACK_BOT_TOKEN` | Slack bot user OAuth token | ✅ |
| `SLACK_SIGNING_SECRET` | Slack app signing secret | ✅ |
| `SLACK_APP_TOKEN` | Slack app-level token | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | ⚠️ |
| `ANTHROPIC_API_KEY` | Anthropic API key | ⚠️ |
| `NEXTAUTH_SECRET` | NextAuth.js secret | ✅ |
| `NEXTAUTH_URL` | Your app's URL | ✅ |

### MCP Tool Configuration

Tools are configured via the admin interface with:
- Tool name and description
- Connection parameters
- Channel routing rules
- Access permissions

## Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Lint and format
npm run lint
npm run format

# Type checking
npm run type-check
```

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on git push

### Manual Deployment

```bash
vercel --prod
```

## Security

- All API keys are stored as environment variables
- Slack requests are verified using signing secrets
- Admin interface requires authentication
- MCP tools run in isolated contexts

## Troubleshooting

### Common Issues

1. **Slack events not received**: Check webhook URL and signing secret
2. **AI responses failing**: Verify API keys and rate limits
3. **MCP tools not working**: Check tool configuration and permissions

### Logs

Check Vercel function logs or local console for detailed error messages.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details