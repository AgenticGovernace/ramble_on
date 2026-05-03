/**
 * electron/mcp/tools/kb-write.cjs
 *
 * ramble.kb_write — write or append to a Notion KB page.
 */

'use strict';

const { z } = require('zod');
const { kbWrite } = require('../clients/notion-client.cjs');

module.exports = {
  name: 'ramble.kb_write',
  title: 'Write to Notion KB',
  description:
    'Write or append content to a Notion KB page. Provide page_id to append, or title to create a new child page.',
  inputSchemaZod: {
    page_id: z.string().optional().describe('Notion page ID to append to.'),
    title: z
      .string()
      .optional()
      .describe('Title for a new page (used if no page_id).'),
    content: z.string().describe('Content to write.'),
    mode: z.enum(['append', 'create']).optional().describe('Write mode.'),
  },
  annotations: {
    title: 'Write to Notion KB',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  handler: kbWrite,
};
