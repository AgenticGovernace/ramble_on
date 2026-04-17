/**
 * electron/mcp-server.cjs
 *
 * Backwards-compatibility shim. The MCP server was split into
 * `electron/mcp/*` — this file re-exports the public lifecycle so existing
 * imports (e.g. `electron/main.cjs`) keep working unchanged.
 */

'use strict';

module.exports = require('./mcp/index.cjs');
