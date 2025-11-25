/**
 * BTCUSD Protocol TypeScript Types
 */

// ============ Protocol Types ============

/**
 * User position in the vault
 */
export interface Position {
  collateral: bigint;      // wBTC amount (8 decimals)
  debt: bigint;            // BTCUSD amount (18 decimals)
  lastUpdate: number;      // Unix timestamp
}

/**
 * Formatted position for UI display
 */
export interface FormattedPosition {
  collateral: string;          // e.g., "0.5000"
  collateralUSD: string;       // e.g., "$32,500.00"
  debt: string;                // e.g., "20,000.00"
  collateralRatio: string;     // e.g., "162.5%"
  healthFactor: number;        // e.g., 1.625
  liquidationPrice: string;    // e.g., "$45,000"
  maxWithdrawable: string;     // e.g., "0.1234"
  maxMintable: string;         // e.g., "5,000.00"
}

/**
 * Yield information
 */
export interface YieldInfo {
  deposited: bigint;       // Original deposit amount
  currentValue: bigint;    // Current value including yield
  earnedYield: bigint;     // Total yield earned
  apy: number;             // Current APY (e.g., 0.08 = 8%)
  userShare: bigint;       // User's claimable share
  protocolShare: bigint;   // Protocol's share
}

/**
 * Formatted yield info for UI
 */
export interface FormattedYieldInfo {
  deposited: string;
  currentValue: string;
  earnedYield: string;
  earnedYieldUSD: string;
  apy: string;             // e.g., "8.00%"
  userClaimable: string;
  protocolFee: string;
}

// ============ Wallet Types ============

export type WalletType = 'braavos' | 'argent' | 'xverse' | null;

export interface WalletState {
  connected: boolean;
  address: string | null;
  walletType: WalletType;
  chainId: string | null;
}

export interface WalletBalance {
  wbtc: bigint;
  btcusd: bigint;
  eth: bigint;
}

export interface FormattedWalletBalance {
  wbtc: string;
  wbtcUSD: string;
  btcusd: string;
  eth: string;
  ethUSD: string;
}

// ============ Price Types ============

export interface PriceData {
  btcPrice: bigint;        // USD price with 8 decimals
  timestamp: number;       // Unix timestamp
  isStale: boolean;        // Whether price is too old
}

export interface FormattedPriceData {
  btcPrice: string;        // e.g., "$65,000.00"
  change24h: string;       // e.g., "+2.5%"
  timestamp: string;       // e.g., "2 min ago"
}

// ============ Transaction Types ============

export type TransactionStatus = 'pending' | 'submitted' | 'confirmed' | 'failed';

export interface Transaction {
  hash: string;
  type: 'deposit' | 'withdraw' | 'mint' | 'burn' | 'harvest';
  status: TransactionStatus;
  timestamp: number;
  details: {
    amount?: string;
    token?: string;
  };
}

// ============ Protocol Stats Types ============

export interface ProtocolStats {
  totalCollateral: bigint;
  totalDebt: bigint;
  totalYieldGenerated: bigint;
  activePositions: number;
}

export interface FormattedProtocolStats {
  tvl: string;             // e.g., "$10.5M"
  totalDebt: string;       // e.g., "$7.2M"
  collateralRatio: string; // e.g., "146%"
  totalYield: string;      // e.g., "$125K"
  activePositions: string; // e.g., "1,234"
}

// ============ UI State Types ============

export interface LoadingState {
  wallet: boolean;
  position: boolean;
  yield: boolean;
  transaction: boolean;
  price: boolean;
}

export interface ErrorState {
  wallet: string | null;
  position: string | null;
  yield: string | null;
  transaction: string | null;
  price: string | null;
}

// ============ Contract Constants ============

export interface ContractAddresses {
  vault: string;
  btcusdToken: string;
  wbtc: string;
  oracle: string;
  yieldManager: string;
}

// ============ Navigation Types ============

export type RootStackParamList = {
  Home: undefined;
  Connect: undefined;
  Dashboard: undefined;
  Deposit: undefined;
  Withdraw: undefined;
  Mint: undefined;
  Burn: undefined;
  Yield: undefined;
  Settings: undefined;
};
