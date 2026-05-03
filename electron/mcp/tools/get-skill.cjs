/**
 * electron/mcp/tools/get-skill.cjs
 *
 * ramble.get_skill — return the bundled SKILL.md so any Claude client can
 * apply the Ramble On skill inline (Tier 2 of the three-tier degradation).
 *
 * Shaped for the modern McpServer.registerTool API from day one: declares a
 * Zod input shape, annotations, and a `formatResponse` that emits both
 * unstructured `content` (legacy shape) and `structuredContent` (modern
 * SDK guidance for clients that read it).
 */

'use strict';

const path = require('path');
const fsp = require('fs/promises');
const { ok, err, assertResult } = require('../../lib/result.cjs');

const SKILL_FILENAME = 'SKILL.md';

/**
 * Resolves the absolute path to the bundled SKILL.md, mirroring
 * `electron/main.cjs`'s skill source resolution. We can't import `app` from
 * Electron here because this module also runs under plain Node when the MCP
 * server is exercised by tests, so we read `process.resourcesPath`
 * defensively.
 *
 * @returns {string} Absolute path to SKILL.md.
 */
const resolveSkillPath = () => {
  if (process.resourcesPath && process.resourcesPath !== process.execPath) {
    const packagedPath = path.join(
      process.resourcesPath,
      'ramble-on',
      SKILL_FILENAME,
    );
    return packagedPath;
  }
  return path.join(__dirname, '..', '..', '..', 'ramble-on', SKILL_FILENAME);
};

/**
 * Reads SKILL.md as a Result so callers never need to catch an exception.
 *
 * @returns {Promise<{ok: true, value: string} | {ok: false, error: {code: string, message: string}}>}
 */
const readSkillSafe = async () => {
  try {
    const skillPath = resolveSkillPath();
    const text = await fsp.readFile(skillPath, 'utf8');
    return assertResult(ok(text));
  } catch (e) {
    return assertResult(
      err({
        code: 'SKILL_READ_FAILED',
        message: String(e?.message ?? e),
      }),
    );
  }
};

const handler = async () => {
  const r = await readSkillSafe();
  if (!r.ok) {
    return { error: r.error };
  }
  return { skill: r.value };
};

/**
 * Modern-shape response formatter. Returns both `content` (unstructured
 * text, identical to legacy wrapper output) and `structuredContent`
 * (modern SDK guidance) so any client reads the skill cleanly.
 *
 * @param {{skill?: string, error?: {code: string, message: string}}} result
 */
const formatResponse = (result) => {
  if (result.error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: result.error }),
        },
      ],
      isError: true,
    };
  }
  return {
    content: [{ type: 'text', text: result.skill }],
    structuredContent: { skill: result.skill },
  };
};

module.exports = {
  name: 'ramble.get_skill',
  title: 'Retrieve Ramble On skill',
  description:
    'Retrieve the bundled Ramble On SKILL.md so any Claude client can apply the skill inline. Used as a fallback when the Claude Desktop skill is not installed locally.',
  inputSchemaZod: {},
  annotations: {
    title: 'Retrieve Ramble On skill',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler,
  formatResponse,
};
