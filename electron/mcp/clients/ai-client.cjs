/**
 * electron/mcp/clients/ai-client.cjs
 *
 * Unified AI client that runs in the privileged main process. Adapts Gemini,
 * OpenAI, and Anthropic behind a single async surface for text generation,
 * audio transcription, and Gemini video generation. The renderer never
 * touches raw API keys — it calls these functions through IPC.
 */

'use strict';

const { GoogleGenAI } = require('@google/genai');
const {
  CONFIG,
  normalizeProvider,
  getApiKey,
  requireApiKey,
} = require('../env.cjs');

const TRANSCRIPTION_MODELS = {
  gemini:
    process.env.GEMINI_TRANSCRIPTION_MODEL || CONFIG.models.gemini,
  openai: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
};

const VIDEO_MODEL =
  process.env.GEMINI_VIDEO_MODEL || 'veo-2.0-generate-001';

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

const generateWithGemini = async (prompt, geminiConfig) => {
  const ai = new GoogleGenAI({ apiKey: requireApiKey('gemini') });
  const response = await ai.models.generateContent({
    model: CONFIG.models.gemini,
    contents: [{ text: prompt }],
    config: geminiConfig,
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
 * interface. `geminiConfig` is forwarded to the Gemini SDK to enable
 * structured-output flows; non-Gemini providers ignore it.
 *
 * @param {{provider?: string, prompt: string, geminiConfig?: object}} options
 * @returns {Promise<string>} The generated text.
 */
const generateText = async ({ provider, prompt, geminiConfig }) => {
  const selected = normalizeProvider(provider || CONFIG.defaultProvider);
  if (selected === 'gemini') return generateWithGemini(prompt, geminiConfig);
  if (selected === 'openai') return generateWithOpenAI(prompt);
  return generateWithAnthropic(prompt);
};

const resolveSpeechProvider = (provider) => {
  if (provider === 'gemini' || provider === 'openai') return provider;
  if (getApiKey('openai')) return 'openai';
  if (getApiKey('gemini')) return 'gemini';
  throw new Error(
    'No transcription provider available. Configure OPENAI_API_KEY or GEMINI_API_KEY.',
  );
};

const getBaseMimeType = (mimeType) =>
  String(mimeType || '').split(';', 1)[0].trim().toLowerCase();

const getAudioFileExtension = (mimeType) => {
  switch (getBaseMimeType(mimeType)) {
    case 'audio/webm':
      return 'webm';
    case 'audio/mp4':
    case 'audio/m4a':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    default:
      return 'webm';
  }
};

const transcribeWithGemini = async ({ audioBase64, mimeType }) => {
  const ai = new GoogleGenAI({ apiKey: requireApiKey('gemini') });
  const response = await ai.models.generateContent({
    model: TRANSCRIPTION_MODELS.gemini,
    contents: [
      { text: 'Generate a complete, detailed transcript of this audio.' },
      { inlineData: { mimeType, data: audioBase64 } },
    ],
  });
  return response.text || '';
};

const transcribeWithOpenAI = async ({ audioBase64, mimeType }) => {
  const uploadMimeType = getBaseMimeType(mimeType) || 'audio/webm';
  const buffer = Buffer.from(audioBase64, 'base64');
  const blob = new Blob([buffer], { type: uploadMimeType });
  const formData = new FormData();
  formData.append(
    'file',
    blob,
    `recording.${getAudioFileExtension(uploadMimeType)}`,
  );
  formData.append('model', TRANSCRIPTION_MODELS.openai);

  const response = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${requireApiKey('openai')}` },
      body: formData,
    },
  );

  if (!response.ok) {
    const errorText = (await response.text()).trim();
    throw new Error(
      `OpenAI transcription failed: ${response.status} ${response.statusText}${
        errorText ? ` - ${errorText}` : ''
      }`,
    );
  }

  const data = await response.json();
  return typeof data?.text === 'string' ? data.text : '';
};

/**
 * Transcribes audio using the configured speech provider, falling back from
 * Anthropic to OpenAI/Gemini since Anthropic does not offer transcription.
 *
 * @param {{provider?: string, audioBase64: string, mimeType: string}} options
 * @returns {Promise<string>} The transcribed text.
 */
const transcribeAudio = async ({ provider, audioBase64, mimeType }) => {
  const requested = normalizeProvider(provider || CONFIG.defaultProvider);
  const selected = resolveSpeechProvider(requested);
  if (selected === 'gemini') return transcribeWithGemini({ audioBase64, mimeType });
  return transcribeWithOpenAI({ audioBase64, mimeType });
};

/**
 * Generates a Veo video for the given prompt, polling until completion and
 * downloading the result so the Gemini API key never crosses the IPC
 * boundary in a URL.
 *
 * @param {{prompt: string}} options
 * @returns {Promise<{buffer: ArrayBuffer, contentType: string}>}
 */
const generateVideo = async ({ prompt }) => {
  const apiKey = requireApiKey('gemini');
  const ai = new GoogleGenAI({ apiKey });

  let operation = await ai.models.generateVideos({
    model: VIDEO_MODEL,
    prompt,
    config: { numberOfVideos: 1 },
  });

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error('Video generation finished, but no video URL was returned.');
  }

  const fetchUrl = `${downloadLink}&key=${apiKey}`;
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch video file: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'video/mp4';
  return { buffer, contentType };
};

module.exports = {
  generateText,
  transcribeAudio,
  generateVideo,
};
