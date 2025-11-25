/**
 * Zustand store for BTCUSD Protocol app state
 */

import { create } from 'zustand';
import type {
  WalletState,
  Position,
  YieldInfo,
  PriceData,
  Transaction,
  LoadingState,
  ErrorState,
  WalletBalance,
} from '@/types';

interface AppState {
  // Wallet
  wallet: WalletState;
  balance: WalletBalance | null;

  // Position
  position: Position | null;

  // Yield
  yield: YieldInfo | null;

  // Price
  price: PriceData | null;

  // Transactions
  transactions: Transaction[];
  pendingTx: string | null;

  // UI State
  loading: LoadingState;
  error: ErrorState;

  // Actions - Wallet
  setWallet: (wallet: Partial<WalletState>) => void;
  setBalance: (balance: WalletBalance | null) => void;
  disconnectWallet: () => void;

  // Actions - Position
  setPosition: (position: Position | null) => void;

  // Actions - Yield
  setYield: (yieldInfo: YieldInfo | null) => void;

  // Actions - Price
  setPrice: (price: PriceData | null) => void;

  // Actions - Transactions
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (hash: string, updates: Partial<Transaction>) => void;
  setPendingTx: (hash: string | null) => void;

  // Actions - UI State
  setLoading: (key: keyof LoadingState, value: boolean) => void;
  setError: (key: keyof ErrorState, value: string | null) => void;
  clearErrors: () => void;
}

const initialWalletState: WalletState = {
  connected: false,
  address: null,
  walletType: null,
  chainId: null,
};

const initialLoadingState: LoadingState = {
  wallet: false,
  position: false,
  yield: false,
  transaction: false,
  price: false,
};

const initialErrorState: ErrorState = {
  wallet: null,
  position: null,
  yield: null,
  transaction: null,
  price: null,
};

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  wallet: initialWalletState,
  balance: null,
  position: null,
  yield: null,
  price: null,
  transactions: [],
  pendingTx: null,
  loading: initialLoadingState,
  error: initialErrorState,

  // Wallet actions
  setWallet: (wallet) =>
    set((state) => ({
      wallet: { ...state.wallet, ...wallet },
    })),

  setBalance: (balance) => set({ balance }),

  disconnectWallet: () =>
    set({
      wallet: initialWalletState,
      balance: null,
      position: null,
      yield: null,
    }),

  // Position actions
  setPosition: (position) => set({ position }),

  // Yield actions
  setYield: (yieldInfo) => set({ yield: yieldInfo }),

  // Price actions
  setPrice: (price) => set({ price }),

  // Transaction actions
  addTransaction: (tx) =>
    set((state) => ({
      transactions: [tx, ...state.transactions].slice(0, 50), // Keep last 50
    })),

  updateTransaction: (hash, updates) =>
    set((state) => ({
      transactions: state.transactions.map((tx) =>
        tx.hash === hash ? { ...tx, ...updates } : tx
      ),
    })),

  setPendingTx: (hash) => set({ pendingTx: hash }),

  // Loading actions
  setLoading: (key, value) =>
    set((state) => ({
      loading: { ...state.loading, [key]: value },
    })),

  // Error actions
  setError: (key, value) =>
    set((state) => ({
      error: { ...state.error, [key]: value },
    })),

  clearErrors: () => set({ error: initialErrorState }),
}));

// Selector hooks for better performance
export const useWallet = () => useStore((state) => state.wallet);
export const useBalance = () => useStore((state) => state.balance);
export const usePosition = () => useStore((state) => state.position);
export const useYieldInfo = () => useStore((state) => state.yield);
export const usePrice = () => useStore((state) => state.price);
export const useTransactions = () => useStore((state) => state.transactions);
export const useLoading = () => useStore((state) => state.loading);
export const useError = () => useStore((state) => state.error);
