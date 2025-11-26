/**
 * Bridge API Server
 *
 * REST API endpoints for the BTC ↔ wBTC bridge.
 * Handles deposit requests, status queries, and withdrawal operations.
 */

import http from 'http';
import { URL } from 'url';
import pino from 'pino';
import { BRIDGE_CONFIG } from '../config/index.js';
import {
  getBridgeService,
  DEFAULT_ATOMIQ_CONFIG,
  type BridgeDepositRequest,
  type BridgeDeposit,
  BridgeDepositStatus,
} from '../services/atomiq-bridge.js';
import { getBitcoinMonitor } from '../services/bitcoin-monitor.js';
import { closeDatabase } from '../services/database.js';

// @ts-ignore - pino ESM typing issue
const createLogger = pino.default || pino;
const logger = createLogger({ name: 'bridge-api' });

// ============ Types ============

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface DepositRequestBody {
  starknetAddress: string;
  amountSats: number;
}

interface WithdrawalRequestBody {
  starknetAddress: string;
  amountSats: number;
  btcAddress: string;
}

// ============ Helper Functions ============

function setCorsHeaders(res: http.ServerResponse): void {
  const origins = BRIDGE_CONFIG.corsOrigins;
  res.setHeader('Access-Control-Allow-Origin', origins.join(', ') || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson<T>(res: http.ServerResponse, statusCode: number, data: ApiResponse<T>): void {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, statusCode: number, message: string): void {
  sendJson(res, statusCode, { success: false, error: message });
}

async function parseBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// Convert BridgeDeposit to API response format
function formatDeposit(deposit: BridgeDeposit) {
  return {
    depositId: deposit.id,
    user: deposit.starknetAddress,
    amountSats: deposit.amountSats,
    btcAddress: deposit.btcAddress,
    status: deposit.status,
    btcTxHash: deposit.btcTxHash,
    starknetTxHash: deposit.starknetTxHash,
    confirmations: deposit.confirmations,
    requiredConfirmations: deposit.requiredConfirmations,
    createdAt: deposit.createdAt,
    updatedAt: deposit.updatedAt,
    expiresAt: deposit.expiresAt,
    claimedAt: deposit.claimedAt,
    error: deposit.error,
    explorerUrl: deposit.btcTxHash
      ? getBitcoinMonitor().getTransactionUrl(deposit.btcTxHash)
      : null,
  };
}

// ============ Route Handlers ============

async function handleRequestDeposit(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  try {
    const body = await parseBody<DepositRequestBody>(req);

    if (!body.starknetAddress || !body.amountSats) {
      sendError(res, 400, 'Missing required fields: starknetAddress, amountSats');
      return;
    }

    if (body.amountSats < BRIDGE_CONFIG.minDepositSats) {
      sendError(res, 400, `Minimum deposit is ${BRIDGE_CONFIG.minDepositSats} sats`);
      return;
    }

    if (body.amountSats > BRIDGE_CONFIG.maxDepositSats) {
      sendError(res, 400, `Maximum deposit is ${BRIDGE_CONFIG.maxDepositSats} sats`);
      return;
    }

    const bridgeService = getBridgeService(DEFAULT_ATOMIQ_CONFIG);
    const result = await bridgeService.requestDeposit({
      starknetAddress: body.starknetAddress,
      amountSats: BigInt(body.amountSats),
    });

    logger.info({
      depositId: result.depositId,
      user: body.starknetAddress,
      amountSats: body.amountSats,
    }, 'Deposit requested');

    sendJson(res, 200, {
      success: true,
      data: {
        depositId: result.depositId,
        btcAddress: result.btcAddress,
        amountSats: Number(result.amountSats),
        expiresAt: result.expiresAt,
        requiredConfirmations: BRIDGE_CONFIG.requiredConfirmations,
        explorerUrl: getBitcoinMonitor().getAddressUrl(result.btcAddress),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to request deposit');
    sendError(res, 500, error.message || 'Failed to request deposit');
  }
}

async function handleGetDeposit(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  depositId: string
): Promise<void> {
  try {
    const bridgeService = getBridgeService(DEFAULT_ATOMIQ_CONFIG);
    const deposit = await bridgeService.getDepositStatus(depositId);

    if (!deposit) {
      sendError(res, 404, 'Deposit not found');
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: formatDeposit(deposit),
    });
  } catch (error: any) {
    logger.error({ error, depositId }, 'Failed to get deposit');
    sendError(res, 500, error.message || 'Failed to get deposit status');
  }
}

async function handleGetUserDeposits(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  starknetAddress: string
): Promise<void> {
  try {
    const bridgeService = getBridgeService(DEFAULT_ATOMIQ_CONFIG);
    const deposits = await bridgeService.getUserDeposits(starknetAddress);

    sendJson(res, 200, {
      success: true,
      data: {
        deposits: deposits.map(formatDeposit),
        count: deposits.length,
      },
    });
  } catch (error: any) {
    logger.error({ error, starknetAddress }, 'Failed to get user deposits');
    sendError(res, 500, error.message || 'Failed to get user deposits');
  }
}

async function handleGetStats(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  try {
    const bridgeService = getBridgeService(DEFAULT_ATOMIQ_CONFIG);
    const stats = bridgeService.getStats();

    sendJson(res, 200, {
      success: true,
      data: {
        ...stats,
        totalValuePending: Number(stats.totalValuePending),
        config: {
          requiredConfirmations: BRIDGE_CONFIG.requiredConfirmations,
          minDepositSats: BRIDGE_CONFIG.minDepositSats,
          maxDepositSats: BRIDGE_CONFIG.maxDepositSats,
          depositExpirySeconds: BRIDGE_CONFIG.depositExpirySeconds,
          bitcoinNetwork: BRIDGE_CONFIG.bitcoinNetwork,
        },
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to get stats');
    sendError(res, 500, error.message || 'Failed to get bridge stats');
  }
}

async function handleHealth(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  try {
    // Check Bitcoin monitor connectivity
    const bitcoinMonitor = getBitcoinMonitor();
    const blockHeight = await bitcoinMonitor.getBlockHeight();

    sendJson(res, 200, {
      success: true,
      data: {
        status: 'healthy',
        bitcoinNetwork: BRIDGE_CONFIG.bitcoinNetwork,
        bitcoinBlockHeight: blockHeight,
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    sendJson(res, 503, {
      success: false,
      error: 'Service unhealthy',
      data: {
        status: 'unhealthy',
        error: error.message,
      },
    });
  }
}

// ============ Request Router ============

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const { method, url } = req;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL
  const parsedUrl = new URL(url || '/', `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  logger.debug({ method, pathname }, 'Incoming request');

  try {
    // Route handling
    if (pathname === '/api/bridge/health' && method === 'GET') {
      await handleHealth(req, res);
    } else if (pathname === '/api/bridge/deposit' && method === 'POST') {
      await handleRequestDeposit(req, res);
    } else if (pathname.startsWith('/api/bridge/deposit/') && method === 'GET') {
      const depositId = pathname.split('/').pop();
      if (depositId) {
        await handleGetDeposit(req, res, depositId);
      } else {
        sendError(res, 400, 'Missing deposit ID');
      }
    } else if (pathname.startsWith('/api/bridge/user/') && method === 'GET') {
      const parts = pathname.split('/');
      const starknetAddress = parts[parts.length - 2] === 'user' ? parts[parts.length - 1] : null;
      if (starknetAddress) {
        await handleGetUserDeposits(req, res, starknetAddress);
      } else {
        sendError(res, 400, 'Missing user address');
      }
    } else if (pathname === '/api/bridge/stats' && method === 'GET') {
      await handleGetStats(req, res);
    } else {
      sendError(res, 404, 'Not found');
    }
  } catch (error: any) {
    logger.error({ error, method, pathname }, 'Request handler error');
    sendError(res, 500, 'Internal server error');
  }
}

// ============ Server Setup ============

let server: http.Server | null = null;

export async function startBridgeApi(): Promise<void> {
  if (!BRIDGE_CONFIG.enabled) {
    logger.info('Bridge API disabled');
    return;
  }

  // Initialize Bitcoin monitor
  const bitcoinMonitor = getBitcoinMonitor();
  await bitcoinMonitor.initialize();

  // Initialize bridge service
  const bridgeService = getBridgeService(DEFAULT_ATOMIQ_CONFIG);
  await bridgeService.initialize();

  // Start monitoring
  await bridgeService.startMonitoring();

  // Create HTTP server
  server = http.createServer(handleRequest);

  server.listen(BRIDGE_CONFIG.apiPort, BRIDGE_CONFIG.apiHost, () => {
    logger.info({
      host: BRIDGE_CONFIG.apiHost,
      port: BRIDGE_CONFIG.apiPort,
    }, 'Bridge API server started');
  });
}

export function stopBridgeApi(): void {
  if (server) {
    server.close();
    logger.info('Bridge API server stopped');
  }

  const bridgeService = getBridgeService(DEFAULT_ATOMIQ_CONFIG);
  bridgeService.stopMonitoring();

  // Close database connection
  closeDatabase();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  stopBridgeApi();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  stopBridgeApi();
  process.exit(0);
});
