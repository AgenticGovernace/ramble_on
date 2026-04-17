/**
 * electron/mcp/clients/notion-client.cjs
 *
 * Notion REST client used by the KB tools. Owns the API base URL, version
 * header, and auth. All KB operations go through `notionRequest()`.
 */

'use strict';

const https = require('https');
const { CONFIG, requireNotionToken } = require('../env.cjs');

/**
 * Sends an authenticated request to the Notion API.
 *
 * @param {string} method The HTTP method to send.
 * @param {string} endpoint The Notion API path beginning with `/`.
 * @param {object | null} [body=null] The optional JSON body to serialize.
 * @returns {Promise<object>} The parsed Notion API response body.
 */
const notionRequest = (method, endpoint, body = null) => {
  const token = requireNotionToken();
  const url = `${CONFIG.notion.apiBase}${endpoint}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': CONFIG.notion.version,
      'Content-Type': 'application/json',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (
            res.statusCode < 200 ||
            res.statusCode >= 300 ||
            parsed.object === 'error'
          ) {
            reject(
              new Error(
                parsed.message ||
                  `Notion API returned status ${res.statusCode}`,
              ),
            );
          } else {
            resolve(parsed);
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

/**
 * Extracts the human-readable title from a Notion page object.
 *
 * @param {object} page The Notion page payload.
 * @returns {string} The page title or 'Untitled' when missing.
 */
const extractPageTitle = (page) =>
  page?.properties?.title?.title?.[0]?.plain_text ||
  page?.properties?.Name?.title?.[0]?.plain_text ||
  'Untitled';

/**
 * Search the Notion KB for pages relevant to a query.
 *
 * @param {{query: string, max_results?: number}} params The search query and
 * optional result limit.
 * @returns {Promise<{pages: Array<object>, query: string}>} The matched pages
 * and the original query text.
 */
const kbSearch = async ({ query, max_results = 5 }) => {
  const result = await notionRequest('POST', '/search', {
    query,
    filter: { property: 'object', value: 'page' },
    page_size: max_results,
  });

  const pages = (result.results || []).map((page) => ({
    id: page.id,
    title: extractPageTitle(page),
    url: page.url,
    last_edited: page.last_edited_time,
  }));

  return { pages, query };
};

/**
 * Fetch the full content of a Notion page by ID.
 *
 * @param {{page_id: string}} params The Notion page identifier to fetch.
 * @returns {Promise<{title: string, body: string, page_id: string, url: string}>}
 * The page title, flattened body text, source id, and URL.
 */
const kbFetchPage = async ({ page_id }) => {
  const [page, blocks] = await Promise.all([
    notionRequest('GET', `/pages/${page_id}`),
    notionRequest('GET', `/blocks/${page_id}/children?page_size=100`),
  ]);

  const title = extractPageTitle(page);

  const extractText = (block) => {
    const type = block.type;
    const content = block[type];
    if (!content?.rich_text) return '';
    return content.rich_text.map((rt) => rt.plain_text).join('');
  };

  const bodyText = (blocks.results || [])
    .map(extractText)
    .filter(Boolean)
    .join('\n');

  return { title, body: bodyText, page_id, url: page.url };
};

/**
 * Write or append content to a Notion KB page.
 *
 * @param {{page_id?: string, title?: string, content: string, mode?: string}}
 * params The page target, optional title, content payload, and write mode.
 * @returns {Promise<object>} The write result including success state and page
 * metadata.
 */
const kbWrite = async ({ page_id, title, content, mode = 'append' }) => {
  if (page_id && mode === 'append') {
    await notionRequest('PATCH', `/blocks/${page_id}/children`, {
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content } }],
          },
        },
      ],
    });
    return { success: true, mode: 'appended', page_id };
  }

  if (title) {
    const newPage = await notionRequest('POST', '/pages', {
      parent: { page_id: page_id || CONFIG.notion.rootPage },
      properties: {
        title: { title: [{ type: 'text', text: { content: title } }] },
      },
      children: content
        ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content } }],
              },
            },
          ]
        : [],
    });
    return {
      success: true,
      mode: 'created',
      page_id: newPage.id,
      url: newPage.url,
    };
  }

  throw new Error(
    'kbWrite requires either page_id (to append) or title (to create).',
  );
};

/**
 * Get the user's voice model from Notion.
 *
 * @returns {Promise<object>} The voice-model lookup result and page content
 * when found.
 */
const getVoiceModel = async () => {
  const result = await notionRequest(
    'GET',
    `/blocks/${CONFIG.notion.rootPage}/children?page_size=25`,
  );
  const voicePage = (result.results || []).find(
    (block) =>
      block.type === 'child_page' &&
      block.child_page?.title?.toLowerCase().includes('voice model'),
  );

  if (!voicePage) {
    return {
      found: false,
      message:
        'No Voice Model page found in Notion KB. Run init to scaffold one.',
    };
  }

  const content = await kbFetchPage({ page_id: voicePage.id });
  return { found: true, ...content };
};

module.exports = {
  notionRequest,
  kbSearch,
  kbFetchPage,
  kbWrite,
  getVoiceModel,
};
