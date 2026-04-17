/**
 * electron/mcp/client.cjs
 *
 * Ramble On — MCP client. Thin wrapper around the official SDK `Client`
 * + `StreamableHTTPClientTransport`, pre-configured to talk to the local
 * Ramble On server.
 *
 * Usage:
 *   const { createMcpClient } = require('./electron/mcp/client.cjs');
 *   const client = await createMcpClient();
 *   const tools = await client.listTools();
 *   const res = await client.callTool({
 *     name: 'ramble.translate',
 *     arguments: { text: 'raw note' },
 *   });
 *   await client.close();
 */

'use strict';

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const {
  StreamableHTTPClientTransport,
} = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const { CONFIG } = require('./env.cjs');

const CLIENT_INFO = { name: 'ramble-on-client', version: '1.0.0' };

/**
 * Creates and connects a Ramble On MCP client.
 *
 * @param {{url?: string}} [options] Connection overrides. `url` defaults to
 * the local server address built from the configured port.
 * @returns {Promise<import('@modelcontextprotocol/sdk/client/index.js').Client>}
 * A connected client. Callers must `await client.close()` when done.
 */
const createMcpClient = async (options = {}) => {
  const endpoint =
    options.url || `http://127.0.0.1:${CONFIG.port}/mcp`;

  const transport = new StreamableHTTPClientTransport(new URL(endpoint));
  const client = new Client(CLIENT_INFO, { capabilities: {} });
  await client.connect(transport);
  return client;
};

/**
 * Health-checks the local MCP HTTP server.
 *
 * @param {{url?: string}} [options] Override for the health URL.
 * @returns {Promise<boolean>} True when the server responds with 200.
 */
const pingMcpServer = async (options = {}) => {
  const endpoint =
    options.url || `http://127.0.0.1:${CONFIG.port}/health`;
  try {
    const res = await fetch(endpoint);
    await res.body?.cancel().catch(() => {});
    return res.ok;
  } catch {
    return false;
  }
};

module.exports = { createMcpClient, pingMcpServer, CLIENT_INFO };
