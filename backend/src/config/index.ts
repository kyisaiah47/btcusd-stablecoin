/**
 * Backend Configuration
 */

import dotenv from 'dotenv';
import type {
  LiquidationKeeperConfig,
  YieldKeeperConfig,
  PriceKeeperConfig,
} from '../types/index.js';

dotenv.config();

// ============ Network Config ============

export const NETWORK = {
  name: process.env.NETWORK || 'sepolia',
  rpcUrl: process.env.RPC_URL || 'https://starknet-sepolia.public.blastapi.io',
  chainId: process.env.CHAIN_ID || 'SN_SEPOLIA',
} as const;

// ============ Contract Addresses ============

export const CONTRACTS = {
  vault: process.env.VAULT_ADDRESS || '0x0',
  btcusdToken: process.env.TOKEN_ADDRESS || '0x0',
  wbtc: process.env.WBTC_ADDRESS || '0x0',
  oracle: process.env.ORACLE_ADDRESS || '0x0',
  yieldManager: process.env.YIELD_MANAGER_ADDRESS || '0x0',
  liquidator: process.env.LIQUIDATOR_ADDRESS || '0x0',
} as const;

// ============ Keeper Account ============

export const KEEPER_ACCOUNT = {
  address: process.env.KEEPER_ADDRESS || '',
  privateKey: process.env.KEEPER_PRIVATE_KEY || '',
} as const;

// ============ Protocol Constants ============

export const PROTOCOL = {
  PRECISION: 10000n,
  MIN_COLLATERAL_RATIO: 15000n,    // 150%
  LIQUIDATION_THRESHOLD: 12000n,   // 120%
  LIQUIDATION_PENALTY: 1000n,      // 10%
  LIQUIDATOR_REWARD: 500n,         // 5%
  WBTC_DECIMALS: 8,
  BTCUSD_DECIMALS: 18,
  PRICE_DECIMALS: 8,
} as const;

// ============ Keeper Configs ============

export const LIQUIDATION_CONFIG: LiquidationKeeperConfig = {
  enabled: process.env.LIQUIDATION_KEEPER_ENABLED === 'true',
  pollIntervalMs: parseInt(process.env.LIQUIDATION_POLL_INTERVAL || '30000'),
  minProfitUSD: parseFloat(process.env.LIQUIDATION_MIN_PROFIT || '10'),
  maxGasPrice: BigInt(process.env.LIQUIDATION_MAX_GAS || '1000000000'),
  healthThreshold: parseInt(process.env.LIQUIDATION_THRESHOLD || '12000'),
  batchSize: parseInt(process.env.LIQUIDATION_BATCH_SIZE || '5'),
  alertWebhook: process.env.ALERT_WEBHOOK,
};

export const YIELD_CONFIG: YieldKeeperConfig = {
  enabled: process.env.YIELD_KEEPER_ENABLED === 'true',
  pollIntervalMs: parseInt(process.env.YIELD_POLL_INTERVAL || '300000'),
  minProfitUSD: parseFloat(process.env.YIELD_MIN_PROFIT || '1'),
  maxGasPrice: BigInt(process.env.YIELD_MAX_GAS || '1000000000'),
  minHarvestAmount: BigInt(process.env.YIELD_MIN_HARVEST || '10000'), // 0.0001 wBTC
  harvestCron: process.env.YIELD_HARVEST_CRON || '0 */6 * * *', // Every 6 hours
  alertWebhook: process.env.ALERT_WEBHOOK,
};

export const PRICE_CONFIG: PriceKeeperConfig = {
  enabled: process.env.PRICE_KEEPER_ENABLED === 'true',
  pollIntervalMs: parseInt(process.env.PRICE_POLL_INTERVAL || '60000'),
  minProfitUSD: 0,
  maxGasPrice: 0n,
  priceDropAlertPercent: parseFloat(process.env.PRICE_DROP_ALERT || '5'),
  stalePriceAlertSeconds: parseInt(process.env.STALE_PRICE_ALERT || '3600'),
  alertWebhook: process.env.ALERT_WEBHOOK,
};

// ============ Logging ============

export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// ============ Bridge Config ============

export const BRIDGE_CONFIG = {
  enabled: process.env.BRIDGE_ENABLED === 'true',
  atomiqAdapterAddress: process.env.ATOMIQ_ADAPTER_ADDRESS || '0x0',

  // Bitcoin network
  bitcoinNetwork: (process.env.BITCOIN_NETWORK || 'testnet') as 'mainnet' | 'testnet',

  // Mempool.space API for Bitcoin monitoring
  mempoolApiUrl: process.env.MEMPOOL_API_URL ||
    (process.env.BITCOIN_NETWORK === 'mainnet'
      ? 'https://mempool.space/api'
      : 'https://mempool.space/testnet/api'),

  // Confirmation requirements
  requiredConfirmations: parseInt(process.env.BRIDGE_CONFIRMATIONS || '3'),

  // Polling interval (ms)
  pollIntervalMs: parseInt(process.env.BRIDGE_POLL_INTERVAL || '30000'),

  // Deposit settings
  depositExpirySeconds: parseInt(process.env.DEPOSIT_EXPIRY_SECONDS || '86400'), // 24 hours
  minDepositSats: parseInt(process.env.MIN_DEPOSIT_SATS || '10000'), // 0.0001 BTC
  maxDepositSats: parseInt(process.env.MAX_DEPOSIT_SATS || '100000000'), // 1 BTC

  // API server
  apiPort: parseInt(process.env.BRIDGE_API_PORT || '3001'),
  apiHost: process.env.BRIDGE_API_HOST || '0.0.0.0',

  // CORS origins
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8081', 'http://localhost:19006'],
} as const;
