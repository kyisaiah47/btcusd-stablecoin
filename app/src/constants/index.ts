/**
 * BTCUSD Protocol Constants
 */

// Contract addresses (Sepolia testnet - to be deployed)
export const CONTRACTS = {
  VAULT: '0x0',
  TOKEN: '0x0',
  ORACLE: '0x0',
  YIELD_MANAGER: '0x0',
  WBTC: '0x0',
} as const;

// Protocol parameters
export const PROTOCOL = {
  MIN_COLLATERAL_RATIO: 15000n, // 150%
  LIQUIDATION_THRESHOLD: 12000n, // 120%
  MAX_LTV: 6667n, // 66.67%
  PRECISION: 10000n,
  DECIMALS: {
    WBTC: 8,
    BTCUSD: 18,
    PRICE: 8,
  },
} as const;

// Network config
export const NETWORK = {
  CHAIN_ID: 'SN_SEPOLIA',
  RPC_URL: 'https://starknet-sepolia.public.blastapi.io',
  EXPLORER: 'https://sepolia.starkscan.co',
} as const;

// UI constants
export const COLORS = {
  primary: '#F7931A', // Bitcoin orange
  secondary: '#4A90A4',
  success: '#4CAF50',
  warning: '#FFC107',
  danger: '#F44336',
  background: '#0D1117',
  surface: '#161B22',
  surfaceLight: '#21262D',
  text: '#FFFFFF',
  textSecondary: '#8B949E',
  border: '#30363D',
} as const;
