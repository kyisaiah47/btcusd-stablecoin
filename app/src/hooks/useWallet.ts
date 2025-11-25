/**
 * Hook for wallet connection and management
 */

import { useCallback } from 'react';
import { useStore, useWallet, useBalance, useLoading } from '@/store';
import { createContracts, getContractAddresses } from '@/services/starknet';
import type { WalletType, WalletBalance } from '@/types';

// Braavos wallet detection
declare global {
  interface Window {
    starknet_braavos?: any;
    starknet_argentX?: any;
  }
}

export function useWalletConnection() {
  const wallet = useWallet();
  const balance = useBalance();
  const loading = useLoading();
  const {
    setWallet,
    setBalance,
    disconnectWallet,
    setLoading,
    setError,
    setPosition,
    setYield,
  } = useStore();

  /**
   * Check if wallet is available
   */
  const isWalletAvailable = useCallback((type: WalletType): boolean => {
    if (typeof window === 'undefined') return false;

    switch (type) {
      case 'braavos':
        return !!window.starknet_braavos;
      case 'argent':
        return !!window.starknet_argentX;
      default:
        return false;
    }
  }, []);

  /**
   * Connect to wallet
   */
  const connect = useCallback(async (type: WalletType) => {
    if (!type) {
      setError('wallet', 'No wallet type specified');
      return;
    }

    setLoading('wallet', true);
    setError('wallet', null);

    try {
      let starknetWallet: any;

      switch (type) {
        case 'braavos':
          starknetWallet = window.starknet_braavos;
          break;
        case 'argent':
          starknetWallet = window.starknet_argentX;
          break;
        default:
          throw new Error('Unsupported wallet type');
      }

      if (!starknetWallet) {
        throw new Error(`${type} wallet not found. Please install it.`);
      }

      // Request connection
      await starknetWallet.enable();

      // Get account info
      const address = starknetWallet.selectedAddress;
      const chainId = await starknetWallet.provider.getChainId();

      setWallet({
        connected: true,
        address,
        walletType: type,
        chainId,
      });

      // Fetch balances
      await fetchBalances(address);
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
      setError('wallet', err.message || 'Failed to connect wallet');
    } finally {
      setLoading('wallet', false);
    }
  }, [setWallet, setLoading, setError]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    disconnectWallet();
  }, [disconnectWallet]);

  /**
   * Fetch token balances
   */
  const fetchBalances = useCallback(async (address?: string) => {
    const addr = address || wallet.address;
    if (!addr) return;

    try {
      const { wbtc, btcusdToken } = createContracts();
      const addresses = getContractAddresses();

      const [wbtcBalance, btcusdBalance] = await Promise.all([
        wbtc.balance_of(addr),
        btcusdToken.balance_of(addr),
      ]);

      const balances: WalletBalance = {
        wbtc: BigInt(wbtcBalance.toString()),
        btcusd: BigInt(btcusdBalance.toString()),
        eth: 0n, // TODO: Fetch ETH balance
      };

      setBalance(balances);
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    }
  }, [wallet.address, setBalance]);

  /**
   * Refresh all wallet data
   */
  const refresh = useCallback(async () => {
    if (!wallet.connected || !wallet.address) return;
    await fetchBalances();
  }, [wallet.connected, wallet.address, fetchBalances]);

  return {
    wallet,
    balance,
    loading: loading.wallet,
    isWalletAvailable,
    connect,
    disconnect,
    fetchBalances,
    refresh,
  };
}

/**
 * Hook for getting wallet account for transactions
 */
export function useWalletAccount() {
  const wallet = useWallet();

  const getAccount = useCallback(() => {
    if (!wallet.connected || !wallet.address || !wallet.walletType) {
      return null;
    }

    let starknetWallet: any;

    switch (wallet.walletType) {
      case 'braavos':
        starknetWallet = window.starknet_braavos;
        break;
      case 'argent':
        starknetWallet = window.starknet_argentX;
        break;
      default:
        return null;
    }

    return starknetWallet?.account || null;
  }, [wallet]);

  return { getAccount, isConnected: wallet.connected };
}
