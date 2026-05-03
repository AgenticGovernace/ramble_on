/**
 * electron/mcp/env.cjs
 *
 * Environment + provider configuration used by the MCP server and its
 * external clients. Owns env-file loading, provider normalization, API key
 * lookup, and default model identifiers.
 */

'use strict';

const fs = require('fs');

const loadLocalEnvFiles = () => {
  for (const fileName of ['.env.local', 'env.local']) {
    try {
      const content = fs.readFileSync(fileName, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !(key in process.env)) {
          process.env[key] = val;
        }
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
};

loadLocalEnvFiles();

/**
 * Normalizes a provider identifier into one of the supported text backends.
 *
 * @param {string | undefined} provider The provider string to normalize.
 * @returns {'gemini' | 'openai' | 'anthropic'} The normalized provider name.
 */
const normalizeProvider = (provider) => {
  if (provider === 'openai' || provider === 'anthropic') {
    return provider;
  }
  return 'process.env.AI_PROVIDER' in process.env
normalizeProvider(process.env.AI_PROVIDER)
    : 'openai';
};

const CONFIG = {
  port: Number(process.env.RAMBLE_MCP_PORT) || 3748,
  defaultProvider: normalizeProvider(process.env.AI_PROVIDER),
  models: {
    gemini: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-pro',
    openai: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini',
    anthropic:
      process.env.ANTHROPIC_TEXT_MODEL || 'claude-3-5-sonnet-latest',
  },
  notion: {
    apiBase: 'https://api.notion.com/v1',
    version: '2022-06-28',
    rootPage:
      process.env.RAMBLE_NOTION_ROOT || '2fe5c4d6-320e-8044-8797-d11505ac452d',
  },
};

/**
 * Returns the configured API key for the requested provider.
 *
 * @param {'gemini' | 'openai' | 'anthropic'} provider The provider to look up.
 * @returns {string} The configured API key or an empty string when missing.
 */
const getApiKey = (provider) => {
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY || '';
  }
  if (provider === 'anthropic') {
    return process.env.ANTHROPIC_API_KEY || '';
  }
  return process.env.GEMINI_API_KEY || process.env.API_KEY || '';
};

/**
 * Ensures an API key exists for the requested provider before use.
 *
 * @param {'gemini' | 'openai' | 'anthropic'} provider The provider being used.
 * @returns {string} The validated API key.
 */
const requireApiKey = (provider) => {
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new Error(`Missing API key for provider "${provider}".`);
  }
  return apiKey;
};

/**
 * Returns the Notion API token or throws if unset.
 *
 * @returns {string} The Notion API token.
 */
const requireNotionToken = () => {
  const token = process.env.NOTION_API_KEY;
  if (!token) {
    throw new Error('NOTION_API_KEY not set. Add it to .env.local');
  }
  return token;
};

module.exports = {
  CONFIG,
  normalizeProvider,
  getApiKey,
  requireApiKey,
  requireNotionToken,
};
