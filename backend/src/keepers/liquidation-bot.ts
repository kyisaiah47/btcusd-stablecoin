/**
 * Liquidation Keeper Bot
 *
 * Monitors positions and executes liquidations when profitable.
 *
 * Process:
 * 1. Scan all positions for health factor < LIQUIDATION_THRESHOLD
 * 2. Calculate potential profit for each liquidatable position
 * 3. Execute liquidations that meet profit threshold
 * 4. Log results and send alerts
 */

import pino from 'pino';
import { LIQUIDATION_CONFIG, PROTOCOL } from '../config/index.js';
import { getContracts, getKeeperAccount, executeTransaction } from '../services/starknet.js';
import type { PositionWithHealth, LiquidationCandidate, LiquidationResult } from '../types/index.js';

const logger = pino({
  name: 'liquidation-bot',
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Main liquidation bot class
 */
class LiquidationBot {
  private running = false;
  private lastScan = 0;

  async start() {
    if (!LIQUIDATION_CONFIG.enabled) {
      logger.warn('Liquidation keeper is disabled');
      return;
    }

    logger.info('Starting liquidation bot...');
    logger.info(`Poll interval: ${LIQUIDATION_CONFIG.pollIntervalMs}ms`);
    logger.info(`Health threshold: ${LIQUIDATION_CONFIG.healthThreshold} (${LIQUIDATION_CONFIG.healthThreshold / 100}%)`);
    logger.info(`Min profit: $${LIQUIDATION_CONFIG.minProfitUSD}`);

    this.running = true;
    await this.runLoop();
  }

  async stop() {
    logger.info('Stopping liquidation bot...');
    this.running = false;
  }

  private async runLoop() {
    while (this.running) {
      try {
        await this.scan();
      } catch (err) {
        logger.error({ err }, 'Scan failed');
      }

      // Wait for next poll
      await this.sleep(LIQUIDATION_CONFIG.pollIntervalMs);
    }
  }

  /**
   * Scan for liquidatable positions
   */
  async scan(): Promise<void> {
    const startTime = Date.now();
    logger.debug('Scanning for liquidatable positions...');

    // Get BTC price first
    const { oracle, vault } = getContracts();
    const [priceResult, isStale] = await Promise.all([
      oracle.get_btc_price(),
      oracle.is_price_stale(),
    ]);

    if (isStale) {
      logger.warn('Price is stale, skipping scan');
      return;
    }

    const btcPrice = BigInt(priceResult[0].toString());
    logger.debug(`Current BTC price: $${Number(btcPrice) / 1e8}`);

    // TODO: In production, you'd need to track all users with positions
    // For now, this is a placeholder showing the pattern
    // You could:
    // 1. Listen to PositionUpdated events to build a user list
    // 2. Use a subgraph/indexer to query positions
    // 3. Store users in a database

    const userAddresses: string[] = []; // Would come from event indexing

    const candidates: LiquidationCandidate[] = [];

    for (const user of userAddresses) {
      try {
        const isLiquidatable = await vault.is_liquidatable(user);

        if (isLiquidatable) {
          const position = await this.getPositionWithHealth(user, btcPrice);
          const candidate = await this.evaluateLiquidation(user, position, btcPrice);

          if (candidate && candidate.estimatedProfit >= LIQUIDATION_CONFIG.minProfitUSD) {
            candidates.push(candidate);
          }
        }
      } catch (err) {
        logger.error({ err, user }, 'Failed to check position');
      }
    }

    logger.info(`Found ${candidates.length} profitable liquidation candidates`);

    // Sort by profit and execute top N
    candidates.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
    const batch = candidates.slice(0, LIQUIDATION_CONFIG.batchSize);

    for (const candidate of batch) {
      await this.executeLiquidation(candidate);
    }

    this.lastScan = Date.now();
    logger.debug(`Scan completed in ${Date.now() - startTime}ms`);
  }

  /**
   * Get position with health metrics
   */
  private async getPositionWithHealth(
    user: string,
    btcPrice: bigint
  ): Promise<PositionWithHealth> {
    const { vault } = getContracts();

    const [position, ratio] = await Promise.all([
      vault.get_position(user),
      vault.get_collateral_ratio(user),
    ]);

    const collateral = BigInt(position.collateral.toString());
    const debt = BigInt(position.debt.toString());
    const collateralRatio = BigInt(ratio.toString());

    // Calculate USD values
    const collateralValueUSD =
      (Number(collateral) * Number(btcPrice)) / (1e8 * 1e8);
    const debtValueUSD = Number(debt) / 1e18;

    return {
      user,
      collateral,
      debt,
      lastUpdate: Number(position.last_update),
      collateralRatio,
      healthFactor: Number(collateralRatio) / Number(PROTOCOL.PRECISION),
      isLiquidatable: collateralRatio < PROTOCOL.LIQUIDATION_THRESHOLD,
      collateralValueUSD,
      debtValueUSD,
    };
  }

  /**
   * Evaluate liquidation profitability
   */
  private async evaluateLiquidation(
    user: string,
    position: PositionWithHealth,
    btcPrice: bigint
  ): Promise<LiquidationCandidate | null> {
    const { liquidator } = getContracts();

    // Calculate max liquidation (50% of debt)
    const maxLiquidation = position.debt / 2n;

    try {
      // Get liquidation preview
      const [collateralSeized, debtRepaid, bonus] =
        await liquidator.calculate_liquidation(user, maxLiquidation);

      const collateralValue =
        (Number(collateralSeized) * Number(btcPrice)) / (1e8 * 1e8);
      const debtValue = Number(debtRepaid) / 1e18;
      const bonusValue = (Number(bonus) * Number(btcPrice)) / (1e8 * 1e8);

      // Estimate gas cost (rough estimate)
      const estimatedGas = 0.001; // ~$2-5 on Starknet

      // Profit = bonus - gas
      const estimatedProfit = bonusValue - estimatedGas * (Number(btcPrice) / 1e8);

      return {
        user,
        position,
        maxLiquidation,
        estimatedProfit,
        estimatedGas,
      };
    } catch (err) {
      logger.error({ err, user }, 'Failed to calculate liquidation');
      return null;
    }
  }

  /**
   * Execute liquidation
   */
  private async executeLiquidation(
    candidate: LiquidationCandidate
  ): Promise<LiquidationResult | null> {
    logger.info(
      {
        user: candidate.user,
        debt: candidate.position.debtValueUSD,
        profit: candidate.estimatedProfit,
      },
      'Executing liquidation'
    );

    try {
      const { liquidator } = getContracts(getKeeperAccount());

      const txHash = await executeTransaction([
        liquidator.populate('liquidate', [
          candidate.user,
          candidate.maxLiquidation,
        ]),
      ]);

      const result: LiquidationResult = {
        txHash,
        user: candidate.user,
        collateralSeized: 0n, // Would get from tx receipt
        debtRepaid: candidate.maxLiquidation,
        profit: candidate.estimatedProfit,
        timestamp: Date.now(),
      };

      logger.info({ result }, 'Liquidation successful');

      // Send alert
      await this.sendAlert('Liquidation Executed', {
        user: candidate.user,
        profit: candidate.estimatedProfit,
        txHash,
      });

      return result;
    } catch (err) {
      logger.error({ err, user: candidate.user }, 'Liquidation failed');
      return null;
    }
  }

  /**
   * Send alert to webhook
   */
  private async sendAlert(title: string, data: any): Promise<void> {
    if (!LIQUIDATION_CONFIG.alertWebhook) return;

    try {
      await fetch(LIQUIDATION_CONFIG.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*${title}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``,
        }),
      });
    } catch (err) {
      logger.error({ err }, 'Failed to send alert');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run if executed directly
const bot = new LiquidationBot();

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await bot.stop();
  process.exit(0);
});

bot.start().catch((err) => {
  logger.error({ err }, 'Failed to start bot');
  process.exit(1);
});

export { LiquidationBot };
