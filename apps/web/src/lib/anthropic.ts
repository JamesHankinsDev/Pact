import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | undefined;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set in apps/web/.env.local');
  }
  _client = new Anthropic({ apiKey });
  return _client;
}
