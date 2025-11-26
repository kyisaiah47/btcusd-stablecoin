/**
 * BTCUSD App Store (Zustand)
 */

import { create } from 'zustand';
import type { Position, YieldInfo, PriceData, WalletState, Transaction, ProtocolStats } from '../types';
import {
  getBTCPrice,
  getUserPosition,
  getUserYieldInfo,
  getWBTCBalance,
  getBTCUSDBalance,
  calculateCollateralRatio,
  calculateLiquidationPrice,
} from '../services/starknet';

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

  // Balances
  wbtcBalance: bigint;
  btcusdBalance: bigint;
  setBalances: (wbtc: bigint, btcusd: bigint) => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (hash: string, status: Transaction['status']) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Refresh
  refreshAll: () => Promise<void>;
  refreshPrice: () => Promise<void>;
  refreshPosition: () => Promise<void>;
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

  // Balances
  wbtcBalance: 0n,
  btcusdBalance: 0n,
  setBalances: (wbtc, btcusd) => set({ wbtcBalance: wbtc, btcusdBalance: btcusd }),

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

  // Refresh price from oracle
  refreshPrice: async () => {
    try {
      const priceData = await getBTCPrice();
      set({
        price: {
          btcPrice: priceData.price,
          timestamp: priceData.timestamp,
          isStale: priceData.isStale,
          source: 'oracle',
        },
      });
    } catch (error) {
      console.error('Error refreshing price:', error);
    }
  },

  // Refresh position for connected wallet
  refreshPosition: async () => {
    const { wallet, price } = get();
    if (!wallet.address || !wallet.isConnected) return;

    try {
      const [positionData, yieldData, wbtcBal, btcusdBal] = await Promise.all([
        getUserPosition(wallet.address),
        getUserYieldInfo(wallet.address),
        getWBTCBalance(wallet.address),
        getBTCUSDBalance(wallet.address),
      ]);

      const btcPrice = price?.btcPrice ?? 0n;

      set({
        position: {
          collateral: positionData.collateral,
          debt: positionData.debt,
          collateralRatio: calculateCollateralRatio(positionData.collateral, positionData.debt, btcPrice),
          healthFactor: positionData.healthFactor,
          liquidationPrice: calculateLiquidationPrice(positionData.collateral, positionData.debt),
        },
        yieldInfo: {
          pendingYield: yieldData.pendingYield,
          cumulativeYield: yieldData.cumulativeYield,
          lastHarvest: yieldData.lastUpdate,
          apy: 500, // 5% APY (mock for now)
        },
        wbtcBalance: wbtcBal,
        btcusdBalance: btcusdBal,
      });
    } catch (error) {
      console.error('Error refreshing position:', error);
    }
  },

  // Refresh all data
  refreshAll: async () => {
    set({ isLoading: true });
    try {
      const { refreshPrice, refreshPosition } = get();
      await refreshPrice();
      await refreshPosition();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
