/**
 * electron/mcp/tools/translate.cjs
 *
 * ramble.translate — raw text → polished note.
 */

'use strict';

const { generateText } = require('../clients/ai-client.cjs');
const { buildKbContext } = require('../kb-context.cjs');

const handler = async ({ text, additional_context = '', provider }) => {
  const kbContext = await buildKbContext(text);

  const prompt = `You are a signal translation layer. Your job is to take raw, fast, non-linear input and translate it into a clean, structured note — preserving the author's voice exactly.

RULES:
- Keep the voice. Fragments that are intentional stay.
- Surface the structure already latent in the input. Don't impose it.
- Remove filler, never ideas.
- Never add ideas not in the original.
- One idea per paragraph.

KNOWLEDGE BASE CONTEXT (use to ground connections and maintain voice consistency):
${kbContext}

USER INSTRUCTION: ${additional_context || 'None provided.'}

RAW INPUT:
${text}

OUTPUT: A clean, structured markdown note. Include a Signal Check at the end — any KB connections found, suggested Notion update if relevant.`;

  const output = await generateText({ provider, prompt });
  return { output, mode: 'polished_note' };
};

module.exports = {
  name: 'ramble.translate',
  description:
    'Translate raw ramble into a clean, structured polished note. Preserves voice. Grounds context in Notion KB.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The raw input text to translate.' },
      additional_context: {
        type: 'string',
        description: 'Optional instruction or framing from the user.',
      },
      provider: {
        type: 'string',
        enum: ['gemini', 'openai', 'anthropic'],
        description: 'Optional AI provider override.',
      },
    },
    required: ['text'],
  },
  handler,
};
