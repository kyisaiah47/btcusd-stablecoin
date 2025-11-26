/**
 * usePosition Hook
 *
 * Provides position data and actions for deposit/mint/burn/withdraw operations.
 */

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import {
  getUserPosition,
  calculateCollateralRatio,
  calculateLiquidationPrice,
  formatWBTC,
  formatBTCUSD,
  parseWBTC,
  parseBTCUSD,
} from '../services/starknet';
import { PROTOCOL } from '../constants';

export interface PositionState {
  // Raw values (bigint)
  collateral: bigint;
  debt: bigint;
  healthFactor: bigint;

  // Formatted values (string)
  collateralFormatted: string;
  debtFormatted: string;

  // Computed values
  collateralRatio: number; // basis points (15000 = 150%)
  collateralRatioPercent: string;
  liquidationPrice: bigint;
  liquidationPriceFormatted: string;

  // Status
  isHealthy: boolean;
  isAtRisk: boolean;
  isLiquidatable: boolean;
  hasPosition: boolean;

  // Loading
  isLoading: boolean;
  error: string | null;
}

export interface PositionActions {
  refresh: () => Promise<void>;
  calculateMaxMint: (additionalCollateral?: bigint) => bigint;
  calculateMaxWithdraw: () => bigint;
  calculateNewHealthFactor: (
    collateralChange: bigint,
    debtChange: bigint,
    isAdd: boolean
  ) => number;
}

export function usePosition(): PositionState & PositionActions {
  const { wallet, position, price, refreshPosition, setPosition } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default values
  const collateral = position?.collateral ?? 0n;
  const debt = position?.debt ?? 0n;
  const healthFactor = position?.healthFactor ?? 0n;
  const btcPrice = price?.btcPrice ?? 0n;

  // Calculate collateral ratio
  const collateralRatio = position?.collateralRatio ?? 0;

  // Calculate liquidation price
  const liquidationPrice = position?.liquidationPrice ?? 0n;

  // Determine position health status
  const isHealthy = collateralRatio >= PROTOCOL.MIN_COLLATERAL_RATIO;
  const isAtRisk =
    collateralRatio < PROTOCOL.MIN_COLLATERAL_RATIO &&
    collateralRatio >= PROTOCOL.LIQUIDATION_THRESHOLD;
  const isLiquidatable = collateralRatio < PROTOCOL.LIQUIDATION_THRESHOLD && debt > 0n;
  const hasPosition = collateral > 0n || debt > 0n;

  // Refresh position data
  const refresh = useCallback(async () => {
    if (!wallet.address || !wallet.isConnected) return;

    setIsLoading(true);
    setError(null);

    try {
      await refreshPosition();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh position';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [wallet.address, wallet.isConnected, refreshPosition]);

  // Calculate maximum mintable BTCUSD given current/additional collateral
  const calculateMaxMint = useCallback(
    (additionalCollateral: bigint = 0n): bigint => {
      if (btcPrice === 0n) return 0n;

      const totalCollateral = collateral + additionalCollateral;

      // Max debt = collateral_value * MAX_LTV / 10000
      // collateral_value = collateral * btcPrice / 1e8 * 1e18 / 1e8 = collateral * btcPrice * 1e2
      const collateralValue = (totalCollateral * btcPrice * BigInt(1e10)) / BigInt(1e8);
      const maxDebt = (collateralValue * BigInt(PROTOCOL.MAX_LTV)) / 10000n;

      // Subtract existing debt
      if (maxDebt <= debt) return 0n;
      return maxDebt - debt;
    },
    [collateral, debt, btcPrice]
  );

  // Calculate maximum withdrawable collateral
  const calculateMaxWithdraw = useCallback((): bigint => {
    if (debt === 0n) return collateral; // No debt = can withdraw all

    if (btcPrice === 0n) return 0n;

    // Required collateral = debt * MIN_COLLATERAL_RATIO / (btcPrice * 1e10 / 1e8)
    // Simplified: required = debt * MIN_COLLATERAL_RATIO * 1e8 / (btcPrice * 1e10 * 10000)
    const requiredCollateral =
      (debt * BigInt(PROTOCOL.MIN_COLLATERAL_RATIO) * BigInt(1e8)) /
      (btcPrice * BigInt(1e10) * 10000n);

    if (requiredCollateral >= collateral) return 0n;
    return collateral - requiredCollateral;
  }, [collateral, debt, btcPrice]);

  // Calculate new health factor after a position change
  const calculateNewHealthFactor = useCallback(
    (collateralChange: bigint, debtChange: bigint, isAdd: boolean): number => {
      const newCollateral = isAdd ? collateral + collateralChange : collateral - collateralChange;
      const newDebt = isAdd ? debt + debtChange : debt - debtChange;

      if (newDebt <= 0n) return Infinity;
      if (newCollateral <= 0n) return 0;

      return calculateCollateralRatio(newCollateral, newDebt, btcPrice);
    },
    [collateral, debt, btcPrice]
  );

  // Auto-refresh when wallet connects
  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      refresh();
    }
  }, [wallet.isConnected, wallet.address]);

  return {
    // Raw values
    collateral,
    debt,
    healthFactor,

    // Formatted values
    collateralFormatted: formatWBTC(collateral),
    debtFormatted: formatBTCUSD(debt),

    // Computed values
    collateralRatio,
    collateralRatioPercent: `${(collateralRatio / 100).toFixed(1)}%`,
    liquidationPrice,
    liquidationPriceFormatted: `$${(Number(liquidationPrice) / 1e8).toLocaleString()}`,

    // Status
    isHealthy,
    isAtRisk,
    isLiquidatable,
    hasPosition,

    // Loading
    isLoading,
    error,

    // Actions
    refresh,
    calculateMaxMint,
    calculateMaxWithdraw,
    calculateNewHealthFactor,
  };
}
