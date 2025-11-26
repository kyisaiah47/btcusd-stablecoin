/**
 * useYield Hook
 *
 * Provides yield tracking data and harvest actions.
 */

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import { getUserYieldInfo, formatWBTC } from '../services/starknet';

export interface YieldState {
  // Raw values (bigint)
  pendingYield: bigint;
  cumulativeYield: bigint;

  // Formatted values (string)
  pendingYieldFormatted: string;
  cumulativeYieldFormatted: string;

  // APY
  apy: number; // basis points (500 = 5%)
  apyPercent: string;

  // Timing
  lastHarvest: number; // timestamp
  lastHarvestFormatted: string;
  timeSinceHarvest: string;

  // Status
  hasYield: boolean;
  canHarvest: boolean;

  // Loading
  isLoading: boolean;
  isHarvesting: boolean;
  error: string | null;
}

export interface YieldActions {
  refresh: () => Promise<void>;
  harvest: () => Promise<boolean>;
  estimateYield: (principal: bigint, durationDays: number) => bigint;
}

function formatTimestamp(timestamp: number): string {
  if (timestamp === 0) return 'Never';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function useYield(): YieldState & YieldActions {
  const { wallet, yieldInfo, refreshPosition, setYieldInfo } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default values
  const pendingYield = yieldInfo?.pendingYield ?? 0n;
  const cumulativeYield = yieldInfo?.cumulativeYield ?? 0n;
  const apy = yieldInfo?.apy ?? 0;
  const lastHarvest = yieldInfo?.lastHarvest ?? 0;

  // Minimum harvest amount (0.00001 wBTC = 1000 sats)
  const MIN_HARVEST = 1000n;

  // Calculate time since last harvest
  const now = Math.floor(Date.now() / 1000);
  const timeSinceHarvestSeconds = lastHarvest > 0 ? now - lastHarvest : 0;

  // Refresh yield data
  const refresh = useCallback(async () => {
    if (!wallet.address || !wallet.isConnected) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getUserYieldInfo(wallet.address);
      setYieldInfo({
        pendingYield: data.pendingYield,
        cumulativeYield: data.cumulativeYield,
        lastHarvest: data.lastUpdate,
        apy: 500, // 5% APY (mock)
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh yield';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [wallet.address, wallet.isConnected, setYieldInfo]);

  // Harvest pending yield
  const harvest = useCallback(async (): Promise<boolean> => {
    if (!wallet.address || !wallet.isConnected) return false;
    if (pendingYield < MIN_HARVEST) return false;

    setIsHarvesting(true);
    setError(null);

    try {
      // TODO: Call harvest_user_yield on YieldManager contract
      // This requires transaction signing which needs wallet integration
      console.log('Harvesting yield:', formatWBTC(pendingYield));

      // For now, simulate success and refresh
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await refreshPosition();

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to harvest yield';
      setError(message);
      return false;
    } finally {
      setIsHarvesting(false);
    }
  }, [wallet.address, wallet.isConnected, pendingYield, refreshPosition]);

  // Estimate yield for a given principal and duration
  const estimateYield = useCallback(
    (principal: bigint, durationDays: number): bigint => {
      // Simple calculation: principal * apy / 10000 * days / 365
      const yearlyYield = (principal * BigInt(apy)) / 10000n;
      const dailyYield = yearlyYield / 365n;
      return dailyYield * BigInt(durationDays);
    },
    [apy]
  );

  // Auto-refresh when wallet connects
  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      refresh();
    }
  }, [wallet.isConnected, wallet.address]);

  return {
    // Raw values
    pendingYield,
    cumulativeYield,

    // Formatted values
    pendingYieldFormatted: formatWBTC(pendingYield),
    cumulativeYieldFormatted: formatWBTC(cumulativeYield),

    // APY
    apy,
    apyPercent: `${(apy / 100).toFixed(2)}%`,

    // Timing
    lastHarvest,
    lastHarvestFormatted: formatTimestamp(lastHarvest),
    timeSinceHarvest: formatDuration(timeSinceHarvestSeconds),

    // Status
    hasYield: pendingYield > 0n,
    canHarvest: pendingYield >= MIN_HARVEST,

    // Loading
    isLoading,
    isHarvesting,
    error,

    // Actions
    refresh,
    harvest,
    estimateYield,
  };
}
