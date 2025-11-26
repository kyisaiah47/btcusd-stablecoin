/**
 * Protocol Monitoring Service
 *
 * Collects and exposes protocol metrics for monitoring dashboards.
 * Metrics include:
 * - TVL (Total Value Locked)
 * - Total debt
 * - Collateral ratios
 * - Yield statistics
 * - Position health
 */

import { Contract } from 'starknet';
import { getProvider, getContracts } from './starknet.js';
import { CONTRACTS, PROTOCOL } from '../config/index.js';
import pino from 'pino';

// @ts-ignore - pino ESM typing issue
const createLogger = pino.default || pino;
const logger = createLogger({ name: 'monitoring' });

/**
 * Protocol metrics snapshot
 */
export interface ProtocolMetrics {
  // TVL
  totalCollateral: bigint;
  totalCollateralUSD: number;

  // Debt
  totalDebt: bigint;
  totalDebtUSD: number;

  // Health
  globalCollateralRatio: number;
  lowestHealthFactor: number;
  positionsAtRisk: number;
  totalPositions: number;

  // Yield
  totalYieldGenerated: bigint;
  currentAPY: number;
  pendingYield: bigint;

  // Price
  btcPriceUSD: number;
  lastPriceUpdate: number;
  isPriceStale: boolean;

  // Activity (24h)
  dailyVolume: bigint;
  dailyTransactions: number;

  // Timestamps
  timestamp: number;
  blockNumber: number;
}

/**
 * Position summary for monitoring
 */
export interface PositionSummary {
  user: string;
  collateral: bigint;
  debt: bigint;
  collateralRatio: number;
  healthFactor: number;
  isLiquidatable: boolean;
  yield: bigint;
}

/**
 * Alert types for monitoring
 */
export enum AlertType {
  LowCollateralRatio = 'LOW_COLLATERAL_RATIO',
  StalePriceData = 'STALE_PRICE_DATA',
  HighGasPrice = 'HIGH_GAS_PRICE',
  LiquidationOpportunity = 'LIQUIDATION_OPPORTUNITY',
  LargeDeposit = 'LARGE_DEPOSIT',
  LargeWithdrawal = 'LARGE_WITHDRAWAL',
  ProtocolPaused = 'PROTOCOL_PAUSED',
}

export interface Alert {
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: Record<string, any>;
  timestamp: number;
}

/**
 * Monitoring Service
 */
export class MonitoringService {
  private metricsHistory: ProtocolMetrics[] = [];
  private alerts: Alert[] = [];
  private pollInterval: NodeJS.Timeout | null = null;
  private pollIntervalMs = 60000; // 1 minute default

  /**
   * Start monitoring
   */
  async start(intervalMs?: number): Promise<void> {
    if (intervalMs) {
      this.pollIntervalMs = intervalMs;
    }

    logger.info(`Starting monitoring service (interval: ${this.pollIntervalMs}ms)`);

    // Initial metrics collection
    await this.collectMetrics();

    // Start polling
    this.pollInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error({ error }, 'Failed to collect metrics');
      }
    }, this.pollIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      logger.info('Monitoring service stopped');
    }
  }

  /**
   * Collect all protocol metrics
   */
  async collectMetrics(): Promise<ProtocolMetrics> {
    const provider = getProvider();
    const contracts = getContracts();

    try {
      // Get block number
      const block = await provider.getBlock('latest');
      const blockNumber = block.block_number;

      // Get protocol stats from vault
      const [totalCollateral, totalDebt] = await contracts.vault.get_protocol_stats();

      // Get BTC price
      const [btcPrice, lastUpdate] = await contracts.oracle.get_btc_price();
      const isPriceStale = await contracts.oracle.is_price_stale();

      // Calculate USD values
      const btcPriceUSD = Number(btcPrice) / 1e8;
      const totalCollateralUSD =
        (Number(totalCollateral) / 1e8) * btcPriceUSD;
      const totalDebtUSD = Number(totalDebt) / 1e18;

      // Calculate global collateral ratio
      let globalCollateralRatio = 0;
      if (totalDebt > 0n) {
        globalCollateralRatio =
          (Number(totalCollateral) * btcPriceUSD * 1e10) / Number(totalDebt);
      }

      // Get yield stats
      const totalYieldGenerated = await contracts.yieldManager.get_total_yield();
      const totalDeposits = await contracts.yieldManager.get_total_deposits();

      // Calculate APY (simplified - based on yield rate)
      let currentAPY = 0;
      if (totalDeposits > 0n) {
        // Assume yield generated over ~1 year equivalent
        currentAPY = (Number(totalYieldGenerated) / Number(totalDeposits)) * 100;
      }

      // Build metrics
      const metrics: ProtocolMetrics = {
        totalCollateral: BigInt(totalCollateral.toString()),
        totalCollateralUSD,
        totalDebt: BigInt(totalDebt.toString()),
        totalDebtUSD,
        globalCollateralRatio,
        lowestHealthFactor: 0, // Would need to scan all positions
        positionsAtRisk: 0, // Would need to scan all positions
        totalPositions: 0, // Would need position count
        totalYieldGenerated: BigInt(totalYieldGenerated.toString()),
        currentAPY,
        pendingYield: 0n, // Would aggregate from all positions
        btcPriceUSD,
        lastPriceUpdate: Number(lastUpdate),
        isPriceStale: Boolean(isPriceStale),
        dailyVolume: 0n, // Would need event indexing
        dailyTransactions: 0, // Would need event indexing
        timestamp: Date.now(),
        blockNumber,
      };

      // Store in history (keep last 24 hours)
      this.metricsHistory.push(metrics);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      this.metricsHistory = this.metricsHistory.filter(
        (m) => m.timestamp > oneDayAgo
      );

      // Check for alerts
      await this.checkAlerts(metrics);

      logger.debug(
        {
          tvl: totalCollateralUSD.toFixed(2),
          debt: totalDebtUSD.toFixed(2),
          ratio: globalCollateralRatio.toFixed(2),
          btcPrice: btcPriceUSD.toFixed(2),
        },
        'Metrics collected'
      );

      return metrics;
    } catch (error) {
      logger.error({ error }, 'Failed to collect metrics');
      throw error;
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(metrics: ProtocolMetrics): Promise<void> {
    // Stale price alert
    if (metrics.isPriceStale) {
      this.addAlert({
        type: AlertType.StalePriceData,
        severity: 'warning',
        message: 'BTC price data is stale',
        data: { lastUpdate: metrics.lastPriceUpdate },
        timestamp: Date.now(),
      });
    }

    // Low global collateral ratio
    if (
      metrics.globalCollateralRatio > 0 &&
      metrics.globalCollateralRatio < PROTOCOL.LIQUIDATION_THRESHOLD
    ) {
      this.addAlert({
        type: AlertType.LowCollateralRatio,
        severity: 'critical',
        message: `Global collateral ratio (${metrics.globalCollateralRatio.toFixed(
          2
        )}%) below liquidation threshold`,
        data: { ratio: metrics.globalCollateralRatio },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Add an alert
   */
  private addAlert(alert: Alert): void {
    // Deduplicate alerts of same type within 5 minutes
    const recentSimilar = this.alerts.find(
      (a) =>
        a.type === alert.type && a.timestamp > Date.now() - 5 * 60 * 1000
    );

    if (!recentSimilar) {
      this.alerts.push(alert);
      logger.warn({ alert }, 'Alert triggered');

      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-100);
      }
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): ProtocolMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): ProtocolMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  /**
   * Get active alerts
   */
  getAlerts(since?: number): Alert[] {
    if (since) {
      return this.alerts.filter((a) => a.timestamp > since);
    }
    return [...this.alerts];
  }

  /**
   * Get metrics summary for dashboard
   */
  getSummary(): {
    current: ProtocolMetrics | null;
    change24h: {
      tvl: number;
      debt: number;
      yield: number;
      price: number;
    };
    alerts: Alert[];
  } {
    const current = this.getCurrentMetrics();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Find metrics from ~24h ago
    const oldMetrics = this.metricsHistory.find(
      (m) => m.timestamp <= oneDayAgo
    );

    // Calculate 24h changes
    let change24h = {
      tvl: 0,
      debt: 0,
      yield: 0,
      price: 0,
    };

    if (current && oldMetrics) {
      const tvlChange =
        oldMetrics.totalCollateralUSD > 0
          ? ((current.totalCollateralUSD - oldMetrics.totalCollateralUSD) /
              oldMetrics.totalCollateralUSD) *
            100
          : 0;

      const debtChange =
        oldMetrics.totalDebtUSD > 0
          ? ((current.totalDebtUSD - oldMetrics.totalDebtUSD) /
              oldMetrics.totalDebtUSD) *
            100
          : 0;

      const yieldChange =
        Number(oldMetrics.totalYieldGenerated) > 0
          ? ((Number(current.totalYieldGenerated) -
              Number(oldMetrics.totalYieldGenerated)) /
              Number(oldMetrics.totalYieldGenerated)) *
            100
          : 0;

      const priceChange =
        oldMetrics.btcPriceUSD > 0
          ? ((current.btcPriceUSD - oldMetrics.btcPriceUSD) /
              oldMetrics.btcPriceUSD) *
            100
          : 0;

      change24h = {
        tvl: tvlChange,
        debt: debtChange,
        yield: yieldChange,
        price: priceChange,
      };
    }

    // Get recent alerts
    const recentAlerts = this.alerts.filter(
      (a) => a.timestamp > Date.now() - 24 * 60 * 60 * 1000
    );

    return {
      current,
      change24h,
      alerts: recentAlerts,
    };
  }

  /**
   * Export metrics for external systems (Prometheus format)
   */
  exportPrometheus(): string {
    const metrics = this.getCurrentMetrics();
    if (!metrics) {
      return '# No metrics available\n';
    }

    const lines = [
      '# HELP btcusd_tvl_usd Total Value Locked in USD',
      '# TYPE btcusd_tvl_usd gauge',
      `btcusd_tvl_usd ${metrics.totalCollateralUSD}`,
      '',
      '# HELP btcusd_total_debt Total debt in BTCUSD',
      '# TYPE btcusd_total_debt gauge',
      `btcusd_total_debt ${Number(metrics.totalDebt) / 1e18}`,
      '',
      '# HELP btcusd_collateral_ratio Global collateral ratio',
      '# TYPE btcusd_collateral_ratio gauge',
      `btcusd_collateral_ratio ${metrics.globalCollateralRatio / 100}`,
      '',
      '# HELP btcusd_btc_price BTC price in USD',
      '# TYPE btcusd_btc_price gauge',
      `btcusd_btc_price ${metrics.btcPriceUSD}`,
      '',
      '# HELP btcusd_yield_apy Current yield APY',
      '# TYPE btcusd_yield_apy gauge',
      `btcusd_yield_apy ${metrics.currentAPY}`,
      '',
      '# HELP btcusd_positions_at_risk Number of positions at liquidation risk',
      '# TYPE btcusd_positions_at_risk gauge',
      `btcusd_positions_at_risk ${metrics.positionsAtRisk}`,
      '',
      '# HELP btcusd_price_stale Whether price feed is stale',
      '# TYPE btcusd_price_stale gauge',
      `btcusd_price_stale ${metrics.isPriceStale ? 1 : 0}`,
      '',
    ];

    return lines.join('\n');
  }
}

// Singleton instance
let monitoringInstance: MonitoringService | null = null;

/**
 * Get or create monitoring service instance
 */
export function getMonitoringService(): MonitoringService {
  if (!monitoringInstance) {
    monitoringInstance = new MonitoringService();
  }
  return monitoringInstance;
}
