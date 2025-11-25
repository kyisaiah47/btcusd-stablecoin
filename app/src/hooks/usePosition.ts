/**
 * Hook for managing user position data
 */

import { useCallback, useEffect } from 'react';
import { useStore, usePosition, useWallet, useLoading, useError } from '@/store';
import { createContracts, getProvider } from '@/services/starknet';
import { POSITION_POLL_INTERVAL, MIN_COLLATERAL_RATIO, LIQUIDATION_THRESHOLD } from '@/constants/protocol';
import {
  formatWBTC,
  formatBTCUSD,
  formatCollateralRatio,
  formatHealthFactor,
  formatUSD,
  calculateUSDValue,
} from '@/utils/format';
import type { Position, FormattedPosition } from '@/types';

export function usePositionData() {
  const wallet = useWallet();
  const position = usePosition();
  const loading = useLoading();
  const error = useError();
  const { setPosition, setLoading, setError } = useStore();

  const fetchPosition = useCallback(async () => {
    if (!wallet.connected || !wallet.address) {
      setPosition(null);
      return;
    }

    setLoading('position', true);
    setError('position', null);

    try {
      const { vault, oracle } = createContracts();

      // Fetch position data
      const positionResult = await vault.get_position(wallet.address);

      const pos: Position = {
        collateral: BigInt(positionResult.collateral.toString()),
        debt: BigInt(positionResult.debt.toString()),
        lastUpdate: Number(positionResult.last_update),
      };

      setPosition(pos);
    } catch (err) {
      console.error('Failed to fetch position:', err);
      setError('position', 'Failed to load position data');
    } finally {
      setLoading('position', false);
    }
  }, [wallet.connected, wallet.address, setPosition, setLoading, setError]);

  // Initial fetch
  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  // Polling
  useEffect(() => {
    if (!wallet.connected) return;

    const interval = setInterval(fetchPosition, POSITION_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [wallet.connected, fetchPosition]);

  return {
    position,
    loading: loading.position,
    error: error.position,
    refresh: fetchPosition,
  };
}

/**
 * Hook for formatted position data ready for UI display
 */
export function useFormattedPosition() {
  const position = usePosition();
  const { price } = useStore();

  if (!position) {
    return null;
  }

  const btcPrice = price?.btcPrice ?? 0n;

  // Calculate values
  const collateralUSD = calculateUSDValue(position.collateral, btcPrice);
  const debtValue = Number(position.debt) / 1e18;

  // Calculate collateral ratio
  let collateralRatio = 0n;
  if (position.debt > 0n && btcPrice > 0n) {
    // ratio = (collateral_value * 10000) / debt_value
    const collateralValue = (position.collateral * btcPrice) / BigInt(1e8);
    collateralRatio = (collateralValue * 10000n) / position.debt;
  }

  // Calculate liquidation price
  // liquidation_price = (debt * LIQUIDATION_THRESHOLD * price_decimals) / (collateral * 10000)
  let liquidationPrice = '0';
  if (position.collateral > 0n && position.debt > 0n) {
    const liqPriceBN = (position.debt * LIQUIDATION_THRESHOLD * BigInt(1e8)) /
      (position.collateral * 10000n);
    liquidationPrice = formatUSD(Number(liqPriceBN) / 1e8);
  }

  // Calculate max withdrawable
  // This would need vault.get_max_withdrawable() call
  // For now, estimate based on current ratio

  // Calculate max mintable
  // This would need vault.get_max_mintable() call

  const formatted: FormattedPosition = {
    collateral: formatWBTC(position.collateral),
    collateralUSD: formatUSD(collateralUSD),
    debt: formatBTCUSD(position.debt),
    collateralRatio: formatCollateralRatio(collateralRatio),
    healthFactor: formatHealthFactor(collateralRatio),
    liquidationPrice,
    maxWithdrawable: '0', // TODO: Fetch from contract
    maxMintable: '0', // TODO: Fetch from contract
  };

  return formatted;
}

/**
 * Hook to check if position is at risk
 */
export function usePositionHealth() {
  const position = usePosition();
  const { price } = useStore();

  if (!position || position.debt === 0n) {
    return { isHealthy: true, isLiquidatable: false, warningLevel: 'none' as const };
  }

  const btcPrice = price?.btcPrice ?? 0n;
  if (btcPrice === 0n) {
    return { isHealthy: true, isLiquidatable: false, warningLevel: 'none' as const };
  }

  // Calculate collateral ratio
  const collateralValue = (position.collateral * btcPrice) / BigInt(1e8);
  const ratio = (collateralValue * 10000n) / position.debt;

  const isLiquidatable = ratio < LIQUIDATION_THRESHOLD;
  const isAtRisk = ratio < MIN_COLLATERAL_RATIO;
  const isHealthy = !isAtRisk && !isLiquidatable;

  let warningLevel: 'none' | 'warning' | 'danger' = 'none';
  if (isLiquidatable) {
    warningLevel = 'danger';
  } else if (isAtRisk) {
    warningLevel = 'warning';
  }

  return {
    isHealthy,
    isLiquidatable,
    warningLevel,
    ratio: Number(ratio),
  };
}
