/**
 * electron/mcp/clients/ai-client.cjs
 *
 * Unified text-generation client. Adapts Gemini, OpenAI, and Anthropic
 * behind a single async `generateText({ provider, prompt })` interface.
 */

'use strict';

const { GoogleGenAI } = require('@google/genai');
const { CONFIG, normalizeProvider, requireApiKey } = require('../env.cjs');

/**
 * Extracts plain text content from an OpenAI Responses API payload.
 *
 * @param {any} data The parsed OpenAI response body.
 * @returns {string} The flattened text content.
 */
const extractOpenAIText = (data) => {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  const outputItems = Array.isArray(data?.output) ? data.output : [];
  const text = outputItems
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .filter(
      (content) => content?.type === 'output_text' || content?.type === 'text',
    )
    .map((content) => content?.text || '')
    .join('');

  if (!text.trim()) {
    throw new Error('OpenAI returned an empty response.');
  }

  return text;
};

const generateWithGemini = async (prompt) => {
  const ai = new GoogleGenAI({ apiKey: requireApiKey('gemini') });
  const response = await ai.models.generateContent({
    model: CONFIG.models.gemini,
    contents: [{ text: prompt }],
  });
  const text = response.text || '';
  if (!text.trim()) {
    throw new Error('Gemini returned an empty response.');
  }
  return text;
};

const generateWithOpenAI = async (prompt) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireApiKey('openai')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.models.openai,
      input: prompt,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI request failed: ${response.status} ${response.statusText}`,
    );
  }

  return extractOpenAIText(await response.json());
};

const generateWithAnthropic = async (prompt) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': requireApiKey('anthropic'),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.models.anthropic,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const text = (Array.isArray(data?.content) ? data.content : [])
    .filter((item) => item?.type === 'text')
    .map((item) => item?.text || '')
    .join('');

  if (!text.trim()) {
    throw new Error('Anthropic returned an empty response.');
  }

  return text;
};

/**
 * Generates text through the requested provider using a shared prompt
 * interface.
 *
 * @param {{provider?: string, prompt: string}} options The provider override
 * and prompt to send.
 * @returns {Promise<string>} The generated text.
 */
const generateText = async ({ provider, prompt }) => {
  const selected = normalizeProvider(provider || CONFIG.defaultProvider);

  if (selected === 'gemini') return generateWithGemini(prompt);
  if (selected === 'openai') return generateWithOpenAI(prompt);
  return generateWithAnthropic(prompt);
};

module.exports = { generateText };
