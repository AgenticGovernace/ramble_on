/**
 * electron/mcp/server.cjs
 *
 * Ramble On — MCP server using the official @modelcontextprotocol/sdk.
 * Owns only the transport + protocol wiring. Tool implementations live in
 * `./tools/*` and external service access lives in `./clients/*`.
 *
 * Transport: Streamable HTTP (stateless) on 127.0.0.1:${RAMBLE_MCP_PORT|3748}.
 * A fresh `Server` + `StreamableHTTPServerTransport` pair is created per
 * request because the SDK's stateless transport cannot be reused.
 *
 * Endpoints:
 *   GET  /health  → readiness probe
 *   POST /mcp     → MCP requests (JSON-RPC over Streamable HTTP)
 *   POST /        → alias for /mcp (backwards compat)
 */

'use strict';

const http = require('http');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
  StreamableHTTPServerTransport,
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const { CONFIG } = require('./env.cjs');
const { buildToolRegistry } = require('./tools/index.cjs');

const SERVER_INFO = { name: 'ramble-on', version: '1.0.0' };

const TOOL_REGISTRY = buildToolRegistry();
const TOOL_DESCRIPTORS = Object.values(TOOL_REGISTRY).map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
}));

/**
 * Creates a new MCP server instance with every Ramble On tool registered.
 *
 * @returns {import('@modelcontextprotocol/sdk/server/index.js').Server}
 */
const createMcpServer = () => {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DESCRIPTORS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = TOOL_REGISTRY[name];
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    const result = await tool.handler(args || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  });

  return server;
};

let httpServer = null;

const writeJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const applyCors = (req, res) => {
  const origin = req.headers.origin || '';
  if (
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('http://localhost')
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
};

/**
 * Handles a single MCP request with a freshly-constructed server + transport.
 * The SDK's stateless Streamable HTTP transport cannot be reused across
 * requests, so we build a per-request pair and dispose of it when done.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {Promise<void>}
 */
const handleMcpRequest = async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  transport.onerror = (err) => {
    console.error('[ramble-on MCP] Transport error:', err);
  };

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
};

/**
 * Starts the local MCP HTTP server used by desktop clients and tool routing.
 *
 * @returns {Promise<import('http').Server>} The running HTTP server instance.
 */
const startMcpServer = async () => {
  if (httpServer) return httpServer;

  httpServer = http.createServer(async (req, res) => {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const pathname = (req.url || '').split('?')[0];

    if (req.method === 'GET' && pathname === '/health') {
      writeJson(res, 200, {
        status: 'ok',
        server: SERVER_INFO.name,
        port: CONFIG.port,
      });
      return;
    }

    if (pathname === '/mcp' || pathname === '/') {
      try {
        await handleMcpRequest(req, res);
      } catch (err) {
        console.error('[ramble-on MCP] Request error:', err);
        if (!res.headersSent) {
          writeJson(res, 500, {
            jsonrpc: '2.0',
            id: null,
            error: { code: -32603, message: 'Internal error' },
          });
        }
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(
          `[ramble-on MCP] Port ${CONFIG.port} in use — MCP server not started. App will run without MCP.`,
        );
        httpServer = null;
        resolve();
      } else {
        reject(err);
      }
    };
    httpServer.once('error', onError);
    httpServer.listen(CONFIG.port, '127.0.0.1', () => {
      httpServer.removeListener('error', onError);
      const toolNames = Object.keys(TOOL_REGISTRY).join(', ');
      console.log(
        `[ramble-on MCP] Server running at http://127.0.0.1:${CONFIG.port}`,
      );
      console.log(`[ramble-on MCP] Tools: ${toolNames}`);
      resolve();
    });
  });

  return httpServer;
};

/**
 * Stops the local MCP HTTP server when the Electron app is shutting down.
 *
 * @returns {Promise<void>} Resolves once the server is closed.
 */
const stopMcpServer = async () => {
  if (httpServer) {
    const server = httpServer;
    httpServer = null;
    await new Promise((resolve) => server.close(() => resolve()));
    console.log('[ramble-on MCP] Server stopped.');
  }
};

module.exports = {
  startMcpServer,
  stopMcpServer,
  createMcpServer,
  SERVER_INFO,
};
