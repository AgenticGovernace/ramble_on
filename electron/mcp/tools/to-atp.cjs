/**
 * electron/mcp/tools/to-atp.cjs
 *
 * ramble.to_atp — raw text → ATP dispatch.
 */

'use strict';

const { generateText } = require('../clients/ai-client.cjs');
const { buildKbContext } = require('../kb-context.cjs');

const handler = async ({ text, additional_context = '', provider }) => {
  const kbContext = await buildKbContext(text);

  const prompt = `You are an ATP (Artemis Transmission Protocol) formatter. Convert the raw input into a structured ATP dispatch for agent or human handoff.

KNOWLEDGE BASE CONTEXT:
${kbContext}

USER INSTRUCTION: ${additional_context || 'None provided.'}

RAW INPUT:
${text}

OUTPUT: A valid ATP block with all required fields. MetaLink is required when KB context is available. Format:

[[Mode]]: [Build|Review|Organize|Capture|Synthesize|Commit]
[[Context]]: [one sentence mission goal]
[[Priority]]: [Critical|High|Normal|Low]
[[ActionType]]: [Summarize|Scaffold|Execute|Reflect]
[[TargetZone]]: [Notion path or project area]
[[SpecialNotes]]: [constraints, caveats]
[[Suggested KB Actions]]:
- [specific Notion page ops]
[[MetaLink]]: #tag - /path - insight

---
[cleaned version of original input]`;

  const output = await generateText({ provider, prompt });
  return { output, mode: 'atp' };
};

module.exports = {
  name: 'ramble.to_atp',
  description:
    'Convert raw input into an ATP (Artemis Transmission Protocol) structured dispatch for agent or human handoff.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The raw input text.' },
      additional_context: {
        type: 'string',
        description: 'Optional instruction.',
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
