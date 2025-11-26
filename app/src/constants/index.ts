/**
 * BTCUSD Protocol Constants
 */

// Contract addresses (Sepolia testnet - deployed)
export const CONTRACTS = {
  VAULT: '0x05d8736f22d6eb6b347ec1ee9b8f7cf093057610ed394dd54593c7c93757a6c1',
  TOKEN: '0x01cacb0278219b58914ea2a02695a7288f3b4f4a4fdf7911f56f21a1c3095345',
  ORACLE: '0x0198de7b85d16fa058a9d9736d2243a6e50478105008f5482ad8e8c4fa0aa13e',
  YIELD_MANAGER: '0x07fe41efd9c731c25610f7d9d28d0de8ec4e46695155354845da1c9b7fef94b8', // MockYieldManager (Stage 1)
  VESU_YIELD_MANAGER: '0x050079ad8253da45dc0ab0c724c85cd07198b230e0cd7d123b8bd6520ce879f0', // VesuYieldManager (Stage 3)
  WBTC: '0x034127ccbb52ed9ab742db89fdb6d261833e118dd5aa1c69f54258553388f6fb',
  LIQUIDATOR: '0x047920e18d296dd5f5da36613a83e3b9badc019cb4e0d59f5fae8af2bae9141c',
  // Vesu Protocol on Sepolia
  VESU_SINGLETON: '0x2110b3cde727cd34407e257e1070857a06010cf02a14b1ee181612fb1b61c30',
} as const;

// Vesu pool ID for wBTC yield generation
export const VESU_POOL_ID = '566154675190438152544449762131613456939576463701265245209877893089848934391';

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

// UI constants - Purple/Pink DeFi theme
export const COLORS = {
  // Primary palette - Pink
  primary: '#FF82FC',
  primaryLight: '#FFA8FE',
  primaryDark: '#E060E0',

  // Accent colors - Purple
  secondary: '#D46BFF',
  accent: '#B44EE0',

  // Status colors
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#FF4757',

  // Background - deep dark
  background: '#161316',
  backgroundGradientStart: '#1E1A1E',
  backgroundGradientEnd: '#161316',

  // Surface/Card colors - glassmorphism
  surface: 'rgba(255, 255, 255, 0.06)',
  surfaceLight: 'rgba(255, 255, 255, 0.10)',
  surfaceBorder: 'rgba(255, 255, 255, 0.12)',

  // Glass effect
  glass: 'rgba(255, 255, 255, 0.04)',
  glassBorder: 'rgba(255, 255, 255, 0.10)',

  // Text
  text: '#FFFFFF',
  textSecondary: '#A3A3A3',
  textMuted: 'rgba(255, 255, 255, 0.4)',

  // Border
  border: 'rgba(255, 255, 255, 0.12)',
} as const;
