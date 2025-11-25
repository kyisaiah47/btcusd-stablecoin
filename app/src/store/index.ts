/**
 * BTCUSD App Store (Zustand)
 */

import { create } from 'zustand';
import type { Position, YieldInfo, PriceData, WalletState, Transaction, ProtocolStats } from '../types';

interface AppState {
  // Wallet
  wallet: WalletState;
  setWallet: (wallet: Partial<WalletState>) => void;

  // Position
  position: Position | null;
  setPosition: (position: Position | null) => void;

  // Yield
  yieldInfo: YieldInfo | null;
  setYieldInfo: (yieldInfo: YieldInfo | null) => void;

  // Price
  price: PriceData | null;
  setPrice: (price: PriceData) => void;

  // Protocol stats
  stats: ProtocolStats | null;
  setStats: (stats: ProtocolStats) => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (hash: string, status: Transaction['status']) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Refresh
  refreshAll: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Wallet
  wallet: {
    address: null,
    isConnected: false,
    chainId: null,
  },
  setWallet: (wallet) => set((state) => ({
    wallet: { ...state.wallet, ...wallet }
  })),

  // Position
  position: null,
  setPosition: (position) => set({ position }),

  // Yield
  yieldInfo: null,
  setYieldInfo: (yieldInfo) => set({ yieldInfo }),

  // Price
  price: null,
  setPrice: (price) => set({ price }),

  // Stats
  stats: null,
  setStats: (stats) => set({ stats }),

  // Transactions
  transactions: [],
  addTransaction: (tx) => set((state) => ({
    transactions: [tx, ...state.transactions].slice(0, 50)
  })),
  updateTransaction: (hash, status) => set((state) => ({
    transactions: state.transactions.map((tx) =>
      tx.hash === hash ? { ...tx, status } : tx
    )
  })),

  // Loading
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  // Refresh all data
  refreshAll: async () => {
    set({ isLoading: true });
    // Refresh logic will be added when contracts are deployed
    set({ isLoading: false });
  },
}));
