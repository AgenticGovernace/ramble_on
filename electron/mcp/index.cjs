/**
 * electron/mcp/index.cjs
 *
 * Public facade for the Ramble On MCP layer. Re-exports the server
 * lifecycle helpers and the client factory so callers (including
 * electron/main.cjs) only need to import one module.
 */

'use strict';

const { startMcpServer, stopMcpServer, createMcpServer, SERVER_INFO } = require('./server.cjs');
const { createMcpClient, pingMcpServer, CLIENT_INFO } = require('./client.cjs');

module.exports = {
  startMcpServer,
  stopMcpServer,
  createMcpServer,
  createMcpClient,
  pingMcpServer,
  SERVER_INFO,
  CLIENT_INFO,
};
