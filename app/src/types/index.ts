/**
 * BTCUSD Protocol Types
 */

export interface Position {
  collateral: bigint;
  debt: bigint;
  lastUpdate: number;
  healthFactor: number;
  collateralRatio: number;
  maxBorrowable: bigint;
}

export interface YieldInfo {
  deposited: bigint;
  earnedYield: bigint;
  pendingYield: bigint;
  apy: number;
  lastHarvest: number;
}

export interface PriceData {
  btcPrice: bigint;
  timestamp: number;
  isStale: boolean;
  source: string;
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId: string | null;
}

export interface Transaction {
  hash: string;
  type: 'deposit' | 'withdraw' | 'mint' | 'burn' | 'harvest';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  amount?: bigint;
}

export interface ProtocolStats {
  totalCollateral: bigint;
  totalDebt: bigint;
  btcPrice: bigint;
  utilizationRate: number;
}
