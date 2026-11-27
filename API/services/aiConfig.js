// The AI meal suggestions need an API key (or gateway token) in .env. The rest of
// the system never depends on it: without one, suggestions are simply switched
// off and everything else works as normal.

const PLACEHOLDERS = new Set(['', 'your-key-here']);

function readKey() {
  return (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '').trim();
}

function isAiConfigured() {
  return !PLACEHOLDERS.has(readKey());
}

// Safe to log or show: says where requests go, never the key itself.
function describeAi() {
  const base = process.env.ANTHROPIC_BASE_URL || 'api.anthropic.com';
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  return `model ${model} via ${base.replace(/^https?:\/\//, '')}`;
}

module.exports = { isAiConfigured, describeAi };
