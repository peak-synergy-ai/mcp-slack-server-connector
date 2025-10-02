import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      checks: {
        slack: {
          botToken: !!process.env.SLACK_BOT_TOKEN,
          signingSecret: !!process.env.SLACK_SIGNING_SECRET,
          appToken: !!process.env.SLACK_APP_TOKEN,
        },
        ai: {
          openai: !!process.env.OPENAI_API_KEY,
          anthropic: !!process.env.ANTHROPIC_API_KEY,
        },
        auth: {
          nextAuthSecret: !!process.env.NEXTAUTH_SECRET,
          nextAuthUrl: !!process.env.NEXTAUTH_URL,
        }
      }
    };

    // Check if minimum required env vars are present
    const hasSlackConfig = health.checks.slack.botToken && health.checks.slack.signingSecret;
    const hasAIConfig = health.checks.ai.openai || health.checks.ai.anthropic;
    const hasAuthConfig = health.checks.auth.nextAuthSecret;

    if (!hasSlackConfig || !hasAIConfig || !hasAuthConfig) {
      health.status = 'unhealthy';
      return res.status(503).json(health);
    }

    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}