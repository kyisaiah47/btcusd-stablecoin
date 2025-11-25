/**
 * Formatting utilities for displaying protocol data
 */

import BigNumber from 'bignumber.js';
import {
  WBTC_DECIMALS,
  BTCUSD_DECIMALS,
  PRICE_DECIMALS,
  ETH_DECIMALS,
  PRECISION,
} from '@/constants/protocol';

// Configure BigNumber
BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: BigNumber.ROUND_DOWN });

/**
 * Format a bigint amount with decimals to a human-readable string
 */
export function formatAmount(
  amount: bigint,
  decimals: number,
  displayDecimals: number = 4
): string {
  const bn = new BigNumber(amount.toString());
  const divisor = new BigNumber(10).pow(decimals);
  return bn.dividedBy(divisor).toFixed(displayDecimals);
}

/**
 * Format wBTC amount (8 decimals)
 */
export function formatWBTC(amount: bigint, displayDecimals: number = 4): string {
  return formatAmount(amount, WBTC_DECIMALS, displayDecimals);
}

/**
 * Format BTCUSD amount (18 decimals)
 */
export function formatBTCUSD(amount: bigint, displayDecimals: number = 2): string {
  return formatAmount(amount, BTCUSD_DECIMALS, displayDecimals);
}

/**
 * Format ETH amount (18 decimals)
 */
export function formatETH(amount: bigint, displayDecimals: number = 4): string {
  return formatAmount(amount, ETH_DECIMALS, displayDecimals);
}

/**
 * Format price from oracle (8 decimals)
 */
export function formatPrice(price: bigint): string {
  const bn = new BigNumber(price.toString());
  const divisor = new BigNumber(10).pow(PRICE_DECIMALS);
  return bn.dividedBy(divisor).toFixed(2);
}

/**
 * Format as USD currency
 */
export function formatUSD(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format large numbers with K/M/B suffix
 */
export function formatCompact(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  }
  return formatUSD(num);
}

/**
 * Format percentage from basis points
 */
export function formatPercentage(basisPoints: bigint): string {
  const percentage = Number(basisPoints) / 100;
  return `${percentage.toFixed(2)}%`;
}

/**
 * Format collateral ratio (15000 -> "150.00%")
 */
export function formatCollateralRatio(ratio: bigint): string {
  const percentage = Number(ratio) / 100;
  return `${percentage.toFixed(2)}%`;
}

/**
 * Format health factor (15000 -> 1.50)
 */
export function formatHealthFactor(ratio: bigint): number {
  return Number(ratio) / Number(PRECISION);
}

/**
 * Format APY (800 -> "8.00%")
 */
export function formatAPY(basisPoints: bigint): string {
  const percentage = Number(basisPoints) / 100;
  return `${percentage.toFixed(2)}%`;
}

/**
 * Format relative time
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Parse user input to bigint with decimals
 */
export function parseAmount(input: string, decimals: number): bigint {
  try {
    const bn = new BigNumber(input);
    if (bn.isNaN() || bn.isNegative()) return 0n;
    const multiplier = new BigNumber(10).pow(decimals);
    return BigInt(bn.multipliedBy(multiplier).integerValue().toString());
  } catch {
    return 0n;
  }
}

/**
 * Parse wBTC input
 */
export function parseWBTC(input: string): bigint {
  return parseAmount(input, WBTC_DECIMALS);
}

/**
 * Parse BTCUSD input
 */
export function parseBTCUSD(input: string): bigint {
  return parseAmount(input, BTCUSD_DECIMALS);
}

/**
 * Calculate USD value from wBTC amount and BTC price
 */
export function calculateUSDValue(wbtcAmount: bigint, btcPrice: bigint): string {
  const bn = new BigNumber(wbtcAmount.toString())
    .multipliedBy(btcPrice.toString())
    .dividedBy(new BigNumber(10).pow(WBTC_DECIMALS + PRICE_DECIMALS));
  return bn.toFixed(2);
}
