/**
 * electron/mcp/tools/kb-write.cjs
 *
 * ramble.kb_write — write or append to a Notion KB page.
 */

'use strict';

const { kbWrite } = require('../clients/notion-client.cjs');

module.exports = {
  name: 'ramble.kb_write',
  description:
    'Write or append content to a Notion KB page. Provide page_id to append, or title to create a new child page.',
  inputSchema: {
    type: 'object',
    properties: {
      page_id: {
        type: 'string',
        description: 'Notion page ID to append to.',
      },
      title: {
        type: 'string',
        description: 'Title for a new page (used if no page_id).',
      },
      content: { type: 'string', description: 'Content to write.' },
      mode: {
        type: 'string',
        enum: ['append', 'create'],
        description: 'Write mode.',
      },
    },
    required: ['content'],
  },
  handler: kbWrite,
};
