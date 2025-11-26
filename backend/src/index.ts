/**
 * BTCUSD Backend - Main Entry Point
 *
 * Runs all keeper bots:
 * - Liquidation Bot: Monitors and liquidates unhealthy positions
 * - Yield Harvester: Harvests yield from the yield manager
 * - Price Monitor: Monitors BTC price and sends alerts
 */

import pino from 'pino';
import { LIQUIDATION_CONFIG, YIELD_CONFIG, PRICE_CONFIG, CONTRACTS } from './config/index.js';
import { LiquidationBot } from './keepers/liquidation-bot.js';
import { YieldHarvester } from './keepers/yield-harvester.js';
import { PriceMonitor } from './keepers/price-monitor.js';

// @ts-ignore - pino ESM typing issue
const createLogger = pino.default || pino;
const logger = createLogger({
  name: 'btcusd-backend',
  level: process.env.LOG_LEVEL || 'info',
});

async function main() {
  logger.info('Starting BTCUSD Backend...');
  logger.info('Contract addresses:');
  logger.info(`  Vault: ${CONTRACTS.vault}`);
  logger.info(`  Liquidator: ${CONTRACTS.liquidator}`);
  logger.info(`  Oracle: ${CONTRACTS.oracle}`);
  logger.info(`  YieldManager: ${CONTRACTS.yieldManager}`);

  const keepers: Array<{ name: string; start: () => Promise<void>; stop: () => Promise<void> }> = [];

  // Initialize keepers based on config
  if (LIQUIDATION_CONFIG.enabled) {
    logger.info('Liquidation keeper enabled');
    const bot = new LiquidationBot();
    keepers.push({ name: 'liquidation', start: () => bot.start(), stop: () => bot.stop() });
  }

  if (YIELD_CONFIG.enabled) {
    logger.info('Yield keeper enabled');
    const harvester = new YieldHarvester();
    keepers.push({ name: 'yield', start: () => harvester.start(), stop: () => harvester.stop() });
  }

  if (PRICE_CONFIG.enabled) {
    logger.info('Price keeper enabled');
    const monitor = new PriceMonitor();
    keepers.push({ name: 'price', start: () => monitor.start(), stop: () => monitor.stop() });
  }

  if (keepers.length === 0) {
    logger.warn('No keepers enabled! Set LIQUIDATION_KEEPER_ENABLED, YIELD_KEEPER_ENABLED, or PRICE_KEEPER_ENABLED to true');
    return;
  }

  // Start all keepers
  for (const keeper of keepers) {
    try {
      await keeper.start();
      logger.info(`${keeper.name} keeper started`);
    } catch (err) {
      logger.error({ err }, `Failed to start ${keeper.name} keeper`);
    }
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    for (const keeper of keepers) {
      try {
        await keeper.stop();
        logger.info(`${keeper.name} keeper stopped`);
      } catch (err) {
        logger.error({ err }, `Failed to stop ${keeper.name} keeper`);
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error');
  process.exit(1);
});
