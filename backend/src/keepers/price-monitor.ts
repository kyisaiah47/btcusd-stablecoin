/**
 * Price Monitor Keeper
 *
 * Monitors BTC price and sends alerts for significant changes.
 *
 * Process:
 * 1. Poll oracle for current price
 * 2. Track price changes over time
 * 3. Alert on significant drops or stale price
 * 4. Could trigger emergency actions if needed
 */

import pino from 'pino';
import { PRICE_CONFIG, PROTOCOL } from '../config/index.js';
import { getContracts } from '../services/starknet.js';
import type { PriceData, PriceAlert } from '../types/index.js';

const logger = pino({
  name: 'price-monitor',
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Price Monitor class
 */
class PriceMonitor {
  private running = false;
  private priceHistory: PriceData[] = [];
  private lastAlertTime = 0;
  private readonly ALERT_COOLDOWN = 300000; // 5 minutes

  async start() {
    if (!PRICE_CONFIG.enabled) {
      logger.warn('Price monitor is disabled');
      return;
    }

    logger.info('Starting price monitor...');
    logger.info(`Poll interval: ${PRICE_CONFIG.pollIntervalMs}ms`);
    logger.info(`Drop alert threshold: ${PRICE_CONFIG.priceDropAlertPercent}%`);
    logger.info(`Stale price threshold: ${PRICE_CONFIG.stalePriceAlertSeconds}s`);

    this.running = true;
    await this.runLoop();
  }

  async stop() {
    logger.info('Stopping price monitor...');
    this.running = false;
  }

  private async runLoop() {
    while (this.running) {
      try {
        await this.checkPrice();
      } catch (err) {
        logger.error({ err }, 'Price check failed');
      }

      await this.sleep(PRICE_CONFIG.pollIntervalMs);
    }
  }

  /**
   * Check current price and analyze
   */
  async checkPrice(): Promise<void> {
    const { oracle } = getContracts();

    const [priceResult, isStale] = await Promise.all([
      oracle.get_btc_price(),
      oracle.is_price_stale(),
    ]);

    const price = BigInt(priceResult[0].toString());
    const timestamp = Number(priceResult[1]);

    const priceData: PriceData = {
      btcPrice: price,
      timestamp,
      isStale,
      source: 'oracle',
    };

    const priceUSD = Number(price) / 1e8;
    logger.debug(`BTC Price: $${priceUSD.toFixed(2)}, Stale: ${isStale}`);

    // Check for stale price
    if (isStale) {
      await this.handleStalePrice(priceData);
    }

    // Track price history
    this.priceHistory.push(priceData);
    if (this.priceHistory.length > 60) {
      this.priceHistory.shift(); // Keep last hour of prices
    }

    // Check for significant price drop
    await this.checkPriceDrop(priceData);
  }

  /**
   * Check for significant price drops
   */
  private async checkPriceDrop(current: PriceData): Promise<void> {
    if (this.priceHistory.length < 2) return;

    // Get price from 5 minutes ago
    const fiveMinAgo = Date.now() - 300000;
    const recentPrice = this.priceHistory.find(
      (p) => p.timestamp * 1000 >= fiveMinAgo
    );

    if (!recentPrice) return;

    const dropPercent =
      ((Number(recentPrice.btcPrice) - Number(current.btcPrice)) /
        Number(recentPrice.btcPrice)) *
      100;

    if (dropPercent >= PRICE_CONFIG.priceDropAlertPercent) {
      const alert: PriceAlert = {
        type: 'price_drop',
        message: `BTC price dropped ${dropPercent.toFixed(2)}% in 5 minutes`,
        price: Number(current.btcPrice) / 1e8,
        changePercent: -dropPercent,
        timestamp: Date.now(),
      };

      logger.warn(alert, 'Significant price drop detected');
      await this.sendAlert(alert);
    }

    // Also check for price spikes (could indicate manipulation)
    if (dropPercent <= -PRICE_CONFIG.priceDropAlertPercent) {
      const alert: PriceAlert = {
        type: 'price_spike',
        message: `BTC price spiked ${Math.abs(dropPercent).toFixed(2)}% in 5 minutes`,
        price: Number(current.btcPrice) / 1e8,
        changePercent: Math.abs(dropPercent),
        timestamp: Date.now(),
      };

      logger.warn(alert, 'Significant price spike detected');
      await this.sendAlert(alert);
    }
  }

  /**
   * Handle stale price alert
   */
  private async handleStalePrice(price: PriceData): Promise<void> {
    const now = Date.now();
    const priceAge = now / 1000 - price.timestamp;

    if (priceAge >= PRICE_CONFIG.stalePriceAlertSeconds) {
      const alert: PriceAlert = {
        type: 'stale_price',
        message: `Oracle price is ${Math.floor(priceAge / 60)} minutes old`,
        price: Number(price.btcPrice) / 1e8,
        timestamp: Date.now(),
      };

      logger.warn(alert, 'Stale price detected');
      await this.sendAlert(alert);
    }
  }

  /**
   * Send alert to webhook
   */
  private async sendAlert(alert: PriceAlert): Promise<void> {
    // Cooldown check
    const now = Date.now();
    if (now - this.lastAlertTime < this.ALERT_COOLDOWN) {
      logger.debug('Alert cooldown active, skipping');
      return;
    }
    this.lastAlertTime = now;

    if (!PRICE_CONFIG.alertWebhook) return;

    const emoji =
      alert.type === 'price_drop'
        ? ':chart_with_downwards_trend:'
        : alert.type === 'price_spike'
        ? ':chart_with_upwards_trend:'
        : ':warning:';

    try {
      await fetch(PRICE_CONFIG.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${emoji} *${alert.type.toUpperCase()}*\n${alert.message}\nPrice: $${alert.price.toFixed(2)}`,
        }),
      });
    } catch (err) {
      logger.error({ err }, 'Failed to send alert');
    }
  }

  /**
   * Get current price
   */
  async getCurrentPrice(): Promise<PriceData> {
    const { oracle } = getContracts();

    const [priceResult, isStale] = await Promise.all([
      oracle.get_btc_price(),
      oracle.is_price_stale(),
    ]);

    return {
      btcPrice: BigInt(priceResult[0].toString()),
      timestamp: Number(priceResult[1]),
      isStale,
      source: 'oracle',
    };
  }

  /**
   * Get price history
   */
  getPriceHistory(): PriceData[] {
    return [...this.priceHistory];
  }

  /**
   * Calculate price change percentage
   */
  getPriceChange(minutes: number = 60): number {
    if (this.priceHistory.length < 2) return 0;

    const now = Date.now();
    const targetTime = now - minutes * 60 * 1000;

    const oldPrice = this.priceHistory.find(
      (p) => p.timestamp * 1000 >= targetTime
    );

    if (!oldPrice) return 0;

    const currentPrice = this.priceHistory[this.priceHistory.length - 1];

    return (
      ((Number(currentPrice.btcPrice) - Number(oldPrice.btcPrice)) /
        Number(oldPrice.btcPrice)) *
      100
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run if executed directly
const monitor = new PriceMonitor();

process.on('SIGINT', async () => {
  await monitor.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await monitor.stop();
  process.exit(0);
});

monitor.start().catch((err) => {
  logger.error({ err }, 'Failed to start monitor');
  process.exit(1);
});

export { PriceMonitor };
