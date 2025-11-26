/**
 * Bridge Server Entry Point
 *
 * Starts the BTC ↔ wBTC bridge API server and monitoring services.
 *
 * Usage: npx ts-node src/bridge-server.ts
 * Or with environment: BRIDGE_ENABLED=true npx ts-node src/bridge-server.ts
 */

import { startBridgeApi } from './api/bridge-api.js';
import pino from 'pino';

// @ts-ignore - pino ESM typing issue
const createLogger = pino.default || pino;
const logger = createLogger({ name: 'bridge-server' });

async function main(): Promise<void> {
  logger.info('Starting BTCUSD Bridge Server...');

  try {
    await startBridgeApi();
    logger.info('Bridge server is running');

    // Log available endpoints
    logger.info(`
Bridge API Endpoints:
  POST /api/bridge/deposit          - Request a new deposit address
  GET  /api/bridge/deposit/:id      - Get deposit status by ID
  GET  /api/bridge/user/:address    - Get all deposits for a user
  GET  /api/bridge/stats            - Get bridge statistics
  GET  /api/bridge/health           - Health check
    `);
  } catch (error: any) {
    logger.error({ error: error?.message || error, stack: error?.stack }, 'Failed to start bridge server');
    process.exit(1);
  }
}

main();
