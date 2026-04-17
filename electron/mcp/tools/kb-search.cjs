/**
 * electron/mcp/tools/kb-search.cjs
 *
 * ramble.kb_search — search the Notion KB.
 */

'use strict';

const { kbSearch } = require('../clients/notion-client.cjs');

module.exports = {
  name: 'ramble.kb_search',
  description:
    'Search the Notion KB for pages relevant to a query. Returns titles, IDs, and URLs.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query.' },
      max_results: {
        type: 'number',
        description: 'Max pages to return (default 5).',
      },
    },
    required: ['query'],
  },
  handler: kbSearch,
};
