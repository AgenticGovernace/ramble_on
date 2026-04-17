/**
 * electron/mcp/tools/to-platform-post.cjs
 *
 * ramble.to_platform_post — raw text → platform-formatted draft.
 */

'use strict';

const { generateText } = require('../clients/ai-client.cjs');
const { buildKbContext } = require('../kb-context.cjs');

const PLATFORM_RULES = {
  medium:
    'Medium.com: SEO title (60 chars max), subtitle (140 chars max), hook first paragraph, H2 sections, 1000-2500 words, tags array (1-5 lowercase). Conversational but substantive.',
  substack:
    'Substack: Subject line doubles as email subject (60 chars). Personal tone, intimate. End with question or reply invite. 500-2500 words.',
  linkedin:
    'LinkedIn: First 200 chars must hook before "see more". Short paragraphs (1-3 sentences). 1300 chars optimal. No external links in body. End with engagement question.',
  ghost:
    'Ghost blog: Full markdown. Can go long. Clean slug. Meta description 155 chars. H2/H3 structure for SEO.',
};

const handler = async ({
  text,
  platform = 'medium',
  additional_context = '',
  provider,
}) => {
  const kbContext = await buildKbContext(text);
  const rules = PLATFORM_RULES[platform.toLowerCase()] || PLATFORM_RULES.medium;

  const prompt = `You are a platform-aware content editor. Transform the raw input into a publication-ready draft for ${platform}.

PLATFORM RULES: ${rules}

KNOWLEDGE BASE CONTEXT (use for internal linking suggestions and voice consistency):
${kbContext}

USER INSTRUCTION: ${additional_context || 'None provided.'}

RAW INPUT:
${text}

OUTPUT: Complete platform-ready draft including title, subtitle/deck (if applicable), body, and tags. Then a brief Signal Check with KB cross-link suggestions.`;

  const output = await generateText({ provider, prompt });
  return { output, mode: 'platform_post', platform };
};

module.exports = {
  name: 'ramble.to_platform_post',
  description:
    'Transform raw input into a platform-ready draft (Medium, Substack, LinkedIn, Ghost).',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The raw input text.' },
      platform: {
        type: 'string',
        enum: ['medium', 'substack', 'linkedin', 'ghost'],
        description: 'Target publishing platform.',
      },
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
    required: ['text', 'platform'],
  },
  handler,
};
