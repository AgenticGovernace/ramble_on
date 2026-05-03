/**
 * electron/mcp/tools/kb-search.cjs
 *
 * ramble.kb_search — search the Notion KB.
 */

'use strict';

const { z } = require('zod');
const { kbSearch } = require('../clients/notion-client.cjs');

module.exports = {
  name: 'ramble.kb_search',
  title: 'Search Notion KB',
  description:
    'Search the Notion KB for pages relevant to a query. Returns titles, IDs, and URLs.',
  inputSchemaZod: {
    query: z.string().describe('Search query.'),
    max_results: z
      .number()
      .optional()
      .describe('Max pages to return (default 5).'),
  },
  annotations: {
    title: 'Search Notion KB',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: kbSearch,
};
