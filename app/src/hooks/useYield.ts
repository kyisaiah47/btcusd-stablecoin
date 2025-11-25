/**
 * Hook for managing yield data and harvesting
 */

import { useCallback, useEffect } from 'react';
import { useStore, useYieldInfo, useWallet, useLoading } from '@/store';
import { createContracts } from '@/services/starknet';
import { YIELD_POLL_INTERVAL, USER_YIELD_SHARE, PRECISION } from '@/constants/protocol';
import { formatWBTC, formatAPY, formatUSD, calculateUSDValue } from '@/utils/format';
import { useWalletAccount } from './useWallet';
import type { YieldInfo, FormattedYieldInfo } from '@/types';

export function useYieldData() {
  const wallet = useWallet();
  const yieldInfo = useYieldInfo();
  const loading = useLoading();
  const { setYield, setLoading, setError } = useStore();

  const fetchYield = useCallback(async () => {
    if (!wallet.connected || !wallet.address) {
      setYield(null);
      return;
    }

    setLoading('yield', true);
    setError('yield', null);

    try {
      const { yieldManager } = createContracts();

      // Fetch yield data
      const [deposit, earnedYield, yieldRate, feeConfig] = await Promise.all([
        yieldManager.get_user_deposit(wallet.address),
        yieldManager.get_user_yield(wallet.address),
        yieldManager.get_yield_rate(),
        yieldManager.get_fee_config(),
      ]);

      const deposited = BigInt(deposit.toString());
      const earned = BigInt(earnedYield.toString());
      const rate = BigInt(yieldRate.toString());
      const [userShare, protocolShare] = feeConfig;

      // Calculate shares
      const userAmount = (earned * BigInt(userShare.toString())) / PRECISION;
      const protocolAmount = earned - userAmount;

      const info: YieldInfo = {
        deposited,
        currentValue: deposited + earned,
        earnedYield: earned,
        apy: Number(rate) / 100, // Convert basis points to decimal
        userShare: userAmount,
        protocolShare: protocolAmount,
      };

      setYield(info);
    } catch (err) {
      console.error('Failed to fetch yield:', err);
      setError('yield', 'Failed to load yield data');
    } finally {
      setLoading('yield', false);
    }
  }, [wallet.connected, wallet.address, setYield, setLoading, setError]);

  // Initial fetch
  useEffect(() => {
    fetchYield();
  }, [fetchYield]);

  // Polling
  useEffect(() => {
    if (!wallet.connected) return;

    const interval = setInterval(fetchYield, YIELD_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [wallet.connected, fetchYield]);

  return {
    yield: yieldInfo,
    loading: loading.yield,
    refresh: fetchYield,
  };
}

/**
 * Hook for formatted yield data ready for UI display
 */
export function useFormattedYield() {
  const yieldInfo = useYieldInfo();
  const { price } = useStore();

  if (!yieldInfo) {
    return null;
  }

  const btcPrice = price?.btcPrice ?? 0n;

  const formatted: FormattedYieldInfo = {
    deposited: formatWBTC(yieldInfo.deposited),
    currentValue: formatWBTC(yieldInfo.currentValue),
    earnedYield: formatWBTC(yieldInfo.earnedYield),
    earnedYieldUSD: formatUSD(calculateUSDValue(yieldInfo.earnedYield, btcPrice)),
    apy: formatAPY(BigInt(Math.round(yieldInfo.apy * 100))),
    userClaimable: formatWBTC(yieldInfo.userShare),
    protocolFee: formatWBTC(yieldInfo.protocolShare),
  };

  return formatted;
}

/**
 * Hook for harvesting yield
 */
export function useHarvestYield() {
  const wallet = useWallet();
  const loading = useLoading();
  const { setLoading, setError, addTransaction, setPendingTx } = useStore();
  const { getAccount } = useWalletAccount();

  const harvest = useCallback(async () => {
    if (!wallet.connected || !wallet.address) {
      setError('transaction', 'Wallet not connected');
      return null;
    }

    const account = getAccount();
    if (!account) {
      setError('transaction', 'Failed to get wallet account');
      return null;
    }

    setLoading('transaction', true);
    setError('transaction', null);

    try {
      const { yieldManager } = createContracts(account);

      // Call harvest_yield
      const response = await yieldManager.harvest_yield(wallet.address);

      const txHash = response.transaction_hash;
      setPendingTx(txHash);

      addTransaction({
        hash: txHash,
        type: 'harvest',
        status: 'submitted',
        timestamp: Date.now(),
        details: {},
      });

      // Wait for confirmation
      // In production, you'd want to poll for status
      // For now, just return the hash

      return txHash;
    } catch (err: any) {
      console.error('Harvest failed:', err);
      setError('transaction', err.message || 'Harvest failed');
      return null;
    } finally {
      setLoading('transaction', false);
      setPendingTx(null);
    }
  }, [wallet, getAccount, setLoading, setError, addTransaction, setPendingTx]);

  return {
    harvest,
    loading: loading.transaction,
  };
}
