/**
 * BTCUSD Protocol Types
 */

export interface Position {
  collateral: bigint;
  debt: bigint;
  lastUpdate?: number;
  healthFactor: bigint;
  collateralRatio: number;
  liquidationPrice: bigint;
  maxBorrowable?: bigint;
}

export interface YieldInfo {
  deposited?: bigint;
  earnedYield?: bigint;
  pendingYield: bigint;
  cumulativeYield: bigint;
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
  type: 'deposit' | 'withdraw' | 'mint' | 'burn' | 'harvest' | 'approve' | 'unknown';
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

// ============ Bridge Types ============

export enum BridgeDepositStatus {
  Pending = 0,
  Confirmed = 1,
  Claimed = 2,
  Expired = 3,
}

export enum BridgeWithdrawalStatus {
  Pending = 0,
  Processing = 1,
  Completed = 2,
  Refunded = 3,
}

export interface BridgeDepositRequest {
  starknetAddress: string;
  amountSats: number;
}

export interface BridgeDepositResponse {
  depositId: string;
  btcAddress: string;
  btcAddressHash: string;
  amountSats: number;
  expiresAt: number;
}

export interface BridgeDeposit {
  depositId: string;
  user: string;
  amountSats: number;
  btcAddress: string;
  btcAddressHash: string;
  status: BridgeDepositStatus;
  btcTxHash?: string;
  confirmations: number;
  requiredConfirmations: number;
  createdAt: number;
  expiresAt: number;
  claimedAt?: number;
  wbtcAmount?: bigint;
}

export interface BridgeWithdrawalRequest {
  starknetAddress: string;
  amountSats: number;
  btcAddress: string;
}

export interface BridgeWithdrawalResponse {
  withdrawalId: string;
  amountSats: number;
  btcAddress: string;
  estimatedTime: number;
}

export interface BridgeWithdrawal {
  withdrawalId: string;
  user: string;
  amountSats: number;
  btcAddress: string;
  status: BridgeWithdrawalStatus;
  btcTxHash?: string;
  createdAt: number;
  completedAt?: number;
}

export interface BridgeStats {
  pendingDeposits: number;
  confirmedDeposits: number;
  totalValuePendingSats: number;
  pendingWithdrawals: number;
  processingWithdrawals: number;
}
