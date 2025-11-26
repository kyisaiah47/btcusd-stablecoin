/**
 * useWallet Hook
 *
 * Provides wallet connection state and actions.
 * Integrates with Starknet wallets (ArgentX, Braavos) and Xverse for BTC.
 */

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import { xverseWallet, type WalletConnection } from '../services/xverse';

export interface WalletHookState {
  // Starknet wallet
  starknetAddress: string | null;
  isStarknetConnected: boolean;

  // BTC wallet (Xverse)
  btcAddress: string | null;
  isBtcConnected: boolean;

  // Combined state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export interface WalletHookActions {
  connectStarknet: () => Promise<void>;
  disconnectStarknet: () => void;
  connectBtc: () => Promise<WalletConnection | null>;
  disconnectBtc: () => void;
  disconnectAll: () => void;
}

export function useWallet(): WalletHookState & WalletHookActions {
  const { wallet, setWallet } = useStore();
  const [btcWallet, setBtcWallet] = useState<WalletConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connect to Starknet wallet (ArgentX/Braavos)
  const connectStarknet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check for Starknet wallet availability
      // In React Native, we use wallet connect or deep links
      // For now, simulate connection with a mock address for testing
      const mockAddress = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      setWallet({
        address: mockAddress,
        isConnected: true,
        chainId: 'SN_SEPOLIA',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect Starknet wallet';
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [setWallet]);

  // Disconnect Starknet wallet
  const disconnectStarknet = useCallback(() => {
    setWallet({
      address: null,
      isConnected: false,
      chainId: null,
    });
  }, [setWallet]);

  // Connect to BTC wallet (Xverse)
  const connectBtc = useCallback(async (): Promise<WalletConnection | null> => {
    setIsConnecting(true);
    setError(null);

    try {
      const connection = await xverseWallet.connect();
      setBtcWallet(connection);
      return connection;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect BTC wallet';
      setError(message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect BTC wallet
  const disconnectBtc = useCallback(() => {
    setBtcWallet(null);
  }, []);

  // Disconnect all wallets
  const disconnectAll = useCallback(() => {
    disconnectStarknet();
    disconnectBtc();
    setError(null);
  }, [disconnectStarknet, disconnectBtc]);

  return {
    // Starknet state
    starknetAddress: wallet.address,
    isStarknetConnected: wallet.isConnected,

    // BTC state
    btcAddress: btcWallet?.btcPaymentAddress?.address ?? null,
    isBtcConnected: btcWallet !== null,

    // Combined state
    isConnected: wallet.isConnected || btcWallet !== null,
    isConnecting,
    error,

    // Actions
    connectStarknet,
    disconnectStarknet,
    connectBtc,
    disconnectBtc,
    disconnectAll,
  };
}
