/**
 * electron/mcp/kb-context.cjs
 *
 * Builds a short KB context string for grounding translation prompts.
 * Failures degrade to a neutral placeholder; the tool still runs.
 */

'use strict';

const { kbSearch, kbFetchPage } = require('./clients/notion-client.cjs');

/**
 * Fetch KB context from Notion to ground the translation.
 *
 * @param {string} rawText The raw user text that needs Knowledge Base context.
 * @returns {Promise<string>} A flattened Knowledge Base context string.
 */
const buildKbContext = async (rawText) => {
  try {
    const searchQuery = rawText.slice(0, 200).replace(/\s+/g, ' ').trim();
    const searchResults = await kbSearch({ query: searchQuery, max_results: 3 });

    if (!searchResults.pages.length) return 'No relevant KB context found.';

    const pageContents = await Promise.all(
      searchResults.pages
        .slice(0, 2)
        .map((p) => kbFetchPage({ page_id: p.id }).catch(() => null)),
    );

    return pageContents
      .filter(Boolean)
      .map((p) => `## ${p.title}\n${p.body}`)
      .join('\n\n---\n\n');
  } catch {
    return 'KB context unavailable (Notion unreachable).';
  }
};

module.exports = { buildKbContext };
