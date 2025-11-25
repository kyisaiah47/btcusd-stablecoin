/**
 * Backend TypeScript Types
 */

// ============ Position Types ============

export interface Position {
  user: string;
  collateral: bigint;
  debt: bigint;
  lastUpdate: number;
}

export interface PositionWithHealth extends Position {
  collateralRatio: bigint;
  healthFactor: number;
  isLiquidatable: boolean;
  collateralValueUSD: number;
  debtValueUSD: number;
}

// ============ Liquidation Types ============

export interface LiquidationCandidate {
  user: string;
  position: PositionWithHealth;
  maxLiquidation: bigint;  // Max BTCUSD that can be liquidated
  estimatedProfit: number; // In USD
  estimatedGas: number;
}

export interface LiquidationResult {
  txHash: string;
  user: string;
  collateralSeized: bigint;
  debtRepaid: bigint;
  profit: number;
  timestamp: number;
}

// ============ Yield Types ============

export interface UserYield {
  user: string;
  deposited: bigint;
  earnedYield: bigint;
  userShare: bigint;
  lastHarvest: number;
}

export interface HarvestResult {
  txHash: string;
  user: string;
  amount: bigint;
  timestamp: number;
}

// ============ Price Types ============

export interface PriceData {
  btcPrice: bigint;
  timestamp: number;
  isStale: boolean;
  source: string;
}

export interface PriceAlert {
  type: 'price_drop' | 'price_spike' | 'stale_price';
  message: string;
  price: number;
  changePercent?: number;
  timestamp: number;
}

// ============ Protocol Stats ============

export interface ProtocolStats {
  totalCollateral: bigint;
  totalDebt: bigint;
  totalYieldGenerated: bigint;
  activePositions: number;
  collateralRatio: number;
  tvlUSD: number;
}

// ============ Keeper Config ============

export interface KeeperConfig {
  enabled: boolean;
  pollIntervalMs: number;
  minProfitUSD: number;
  maxGasPrice: bigint;
  alertWebhook?: string;
}

export interface LiquidationKeeperConfig extends KeeperConfig {
  healthThreshold: number;  // e.g., 12000 for 120%
  batchSize: number;        // Max liquidations per tx
}

export interface YieldKeeperConfig extends KeeperConfig {
  minHarvestAmount: bigint; // Min yield to harvest
  harvestCron: string;      // Cron schedule
}

export interface PriceKeeperConfig extends KeeperConfig {
  priceDropAlertPercent: number;   // e.g., 5 for 5% drop
  stalePriceAlertSeconds: number;  // e.g., 3600 for 1 hour
}
