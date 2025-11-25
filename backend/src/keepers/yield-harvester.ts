/**
 * Yield Harvester Keeper
 *
 * Periodically harvests yield for all users.
 *
 * Process:
 * 1. Get list of users with deposits
 * 2. Check each user's accumulated yield
 * 3. Harvest yield if above threshold
 * 4. Can also trigger batch harvest_all()
 */

import pino from 'pino';
import { CronJob } from 'cron';
import { YIELD_CONFIG } from '../config/index.js';
import { getContracts, getKeeperAccount, executeTransaction } from '../services/starknet.js';
import type { UserYield, HarvestResult } from '../types/index.js';

const logger = pino({
  name: 'yield-harvester',
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Yield Harvester class
 */
class YieldHarvester {
  private cronJob: CronJob | null = null;
  private running = false;

  async start() {
    if (!YIELD_CONFIG.enabled) {
      logger.warn('Yield harvester is disabled');
      return;
    }

    logger.info('Starting yield harvester...');
    logger.info(`Cron schedule: ${YIELD_CONFIG.harvestCron}`);
    logger.info(`Min harvest amount: ${Number(YIELD_CONFIG.minHarvestAmount) / 1e8} wBTC`);

    // Set up cron job
    this.cronJob = new CronJob(
      YIELD_CONFIG.harvestCron,
      () => this.runHarvest(),
      null,
      true,
      'UTC'
    );

    this.running = true;
    logger.info('Yield harvester started');

    // Run initial harvest
    await this.runHarvest();
  }

  async stop() {
    logger.info('Stopping yield harvester...');
    this.cronJob?.stop();
    this.running = false;
  }

  /**
   * Run harvest cycle
   */
  async runHarvest(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting harvest cycle...');

    try {
      // Option 1: Batch harvest all users
      await this.harvestAll();

      // Option 2: Individual harvests (for more control)
      // await this.harvestIndividual();

      logger.info(`Harvest cycle completed in ${Date.now() - startTime}ms`);
    } catch (err) {
      logger.error({ err }, 'Harvest cycle failed');
    }
  }

  /**
   * Harvest all users in one transaction
   */
  private async harvestAll(): Promise<void> {
    const { yieldManager } = getContracts();

    // Check total yield first
    const totalYield = await yieldManager.get_total_yield();
    logger.info(`Total protocol yield: ${Number(totalYield) / 1e8} wBTC`);

    if (BigInt(totalYield.toString()) === 0n) {
      logger.info('No yield to harvest');
      return;
    }

    // Execute batch harvest
    const account = getKeeperAccount();
    const yieldManagerWithAccount = getContracts(account).yieldManager;

    const txHash = await executeTransaction([
      yieldManagerWithAccount.populate('harvest_all', []),
    ]);

    logger.info({ txHash }, 'Batch harvest executed');

    await this.sendAlert('Yield Harvested', {
      totalYield: Number(totalYield) / 1e8,
      txHash,
    });
  }

  /**
   * Harvest individual users (more granular control)
   */
  private async harvestIndividual(): Promise<HarvestResult[]> {
    const results: HarvestResult[] = [];

    // TODO: Get list of users with deposits from events/indexer
    const users: string[] = [];

    const { yieldManager } = getContracts();

    for (const user of users) {
      try {
        const userYield = await yieldManager.get_user_yield(user);
        const yieldAmount = BigInt(userYield.toString());

        if (yieldAmount < YIELD_CONFIG.minHarvestAmount) {
          logger.debug({ user, yield: yieldAmount }, 'Yield below threshold');
          continue;
        }

        logger.info({ user, yield: Number(yieldAmount) / 1e8 }, 'Harvesting user yield');

        const account = getKeeperAccount();
        const yieldManagerWithAccount = getContracts(account).yieldManager;

        const txHash = await executeTransaction([
          yieldManagerWithAccount.populate('harvest_yield', [user]),
        ]);

        results.push({
          txHash,
          user,
          amount: yieldAmount,
          timestamp: Date.now(),
        });

        logger.info({ user, txHash }, 'Harvest successful');
      } catch (err) {
        logger.error({ err, user }, 'Failed to harvest user');
      }
    }

    return results;
  }

  /**
   * Get yield info for a specific user
   */
  async getUserYield(user: string): Promise<UserYield> {
    const { yieldManager } = getContracts();

    const [deposit, earnedYield] = await Promise.all([
      yieldManager.get_user_deposit(user),
      yieldManager.get_user_yield(user),
    ]);

    const deposited = BigInt(deposit.toString());
    const earned = BigInt(earnedYield.toString());

    // Calculate user share (70%)
    const userShare = (earned * 7000n) / 10000n;

    return {
      user,
      deposited,
      earnedYield: earned,
      userShare,
      lastHarvest: 0, // Would track this in a database
    };
  }

  /**
   * Get protocol yield stats
   */
  async getProtocolYieldStats() {
    const { yieldManager } = getContracts();

    const [totalDeposits, totalYield, yieldRate] = await Promise.all([
      yieldManager.get_total_deposits(),
      yieldManager.get_total_yield(),
      // yieldManager.get_yield_rate(), // If available
    ]);

    return {
      totalDeposits: BigInt(totalDeposits.toString()),
      totalYield: BigInt(totalYield.toString()),
      // apy: Number(yieldRate) / 100,
    };
  }

  /**
   * Send alert to webhook
   */
  private async sendAlert(title: string, data: any): Promise<void> {
    if (!YIELD_CONFIG.alertWebhook) return;

    try {
      await fetch(YIELD_CONFIG.alertWebhook, {
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
}

// Run if executed directly
const harvester = new YieldHarvester();

process.on('SIGINT', async () => {
  await harvester.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await harvester.stop();
  process.exit(0);
});

harvester.start().catch((err) => {
  logger.error({ err }, 'Failed to start harvester');
  process.exit(1);
});

export { YieldHarvester };
