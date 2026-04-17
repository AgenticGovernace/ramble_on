/**
 * electron/mcp/tools/index.cjs
 *
 * Aggregates all tool modules into a single registry consumed by the MCP
 * server. Each tool exports `{ name, description, inputSchema, handler }`.
 */

'use strict';

const translate = require('./translate.cjs');
const toAtp = require('./to-atp.cjs');
const toPlatformPost = require('./to-platform-post.cjs');
const kbSearch = require('./kb-search.cjs');
const kbWrite = require('./kb-write.cjs');
const getVoiceModel = require('./get-voice-model.cjs');

const ALL_TOOLS = [
  translate,
  toAtp,
  toPlatformPost,
  kbSearch,
  kbWrite,
  getVoiceModel,
];

/**
 * Builds a name → tool lookup from the registered tool modules.
 *
 * @returns {Record<string, {name: string, description: string, inputSchema: object, handler: Function}>}
 */
const buildToolRegistry = () => {
  const registry = Object.create(null);
  for (const tool of ALL_TOOLS) {
    registry[tool.name] = tool;
  }
  return registry;
};

module.exports = { ALL_TOOLS, buildToolRegistry };
