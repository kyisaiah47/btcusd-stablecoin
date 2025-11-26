/**
 * Starknet Contract Service
 * Connects to deployed contracts on Sepolia
 */

import { RpcProvider, Contract, Account, num, uint256 } from 'starknet';
import { CONTRACTS, NETWORK, PROTOCOL } from '../constants';

// Initialize provider
export const provider = new RpcProvider({
  nodeUrl: 'https://rpc.starknet-testnet.lava.build',
});

// ABIs (simplified for core operations)
const VAULT_ABI = [
  {
    name: 'get_position',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [
      { name: 'collateral', type: 'core::integer::u256' },
      { name: 'debt', type: 'core::integer::u256' },
    ],
    state_mutability: 'view',
  },
  {
    name: 'get_health_factor',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'health', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'deposit_collateral',
    type: 'function',
    inputs: [{ name: 'amount', type: 'core::integer::u256' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'mint',
    type: 'function',
    inputs: [{ name: 'amount', type: 'core::integer::u256' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'burn',
    type: 'function',
    inputs: [{ name: 'amount', type: 'core::integer::u256' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'withdraw_collateral',
    type: 'function',
    inputs: [{ name: 'amount', type: 'core::integer::u256' }],
    outputs: [],
    state_mutability: 'external',
  },
];

const ORACLE_ABI = [
  {
    name: 'get_btc_price',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'price', type: 'core::integer::u256' },
      { name: 'timestamp', type: 'core::integer::u64' },
    ],
    state_mutability: 'view',
  },
  {
    name: 'is_price_stale',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'is_stale', type: 'core::bool' }],
    state_mutability: 'view',
  },
];

const YIELD_MANAGER_ABI = [
  {
    name: 'get_user_yield_info',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [
      { name: 'deposited', type: 'core::integer::u256' },
      { name: 'pending_yield', type: 'core::integer::u256' },
      { name: 'cumulative_yield', type: 'core::integer::u256' },
      { name: 'last_update', type: 'core::integer::u64' },
    ],
    state_mutability: 'view',
  },
  {
    name: 'harvest_user_yield',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'amount', type: 'core::integer::u256' }],
    state_mutability: 'external',
  },
];

const TOKEN_ABI = [
  {
    name: 'balance_of',
    type: 'function',
    inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'balance', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ name: 'success', type: 'core::bool' }],
    state_mutability: 'external',
  },
];

// We use provider.callContract directly instead of Contract instances
// This avoids type issues and works better with the Starknet.js API

// Helper functions
export function formatWBTC(amount: bigint): string {
  return (Number(amount) / 1e8).toFixed(8);
}

export function formatBTCUSD(amount: bigint): string {
  return (Number(amount) / 1e18).toFixed(2);
}

export function formatPrice(price: bigint): string {
  return (Number(price) / 1e8).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function parseWBTC(amount: string): bigint {
  return BigInt(Math.floor(parseFloat(amount) * 1e8));
}

export function parseBTCUSD(amount: string): bigint {
  return BigInt(Math.floor(parseFloat(amount) * 1e18));
}

// Read functions
export async function getBTCPrice(): Promise<{ price: bigint; timestamp: number; isStale: boolean }> {
  try {
    const result = await provider.callContract({
      contractAddress: CONTRACTS.ORACLE,
      entrypoint: 'get_btc_price',
      calldata: [],
    });
    const staleResult = await provider.callContract({
      contractAddress: CONTRACTS.ORACLE,
      entrypoint: 'is_price_stale',
      calldata: [],
    });
    return {
      price: BigInt(result[0] ?? '0'),
      timestamp: Number(result[1] ?? 0),
      isStale: staleResult[0] === '0x1',
    };
  } catch (error) {
    console.error('Error getting BTC price:', error);
    throw error;
  }
}

export async function getUserPosition(userAddress: string): Promise<{
  collateral: bigint;
  debt: bigint;
  healthFactor: bigint;
}> {
  try {
    const position = await provider.callContract({
      contractAddress: CONTRACTS.VAULT,
      entrypoint: 'get_position',
      calldata: [userAddress],
    });
    const health = await provider.callContract({
      contractAddress: CONTRACTS.VAULT,
      entrypoint: 'get_health_factor',
      calldata: [userAddress],
    });
    return {
      collateral: BigInt(position[0] ?? '0'),
      debt: BigInt(position[2] ?? '0'), // u256 is 2 felts
      healthFactor: BigInt(health[0] ?? '0'),
    };
  } catch (error) {
    console.error('Error getting user position:', error);
    throw error;
  }
}

export async function getUserYieldInfo(userAddress: string): Promise<{
  deposited: bigint;
  pendingYield: bigint;
  cumulativeYield: bigint;
  lastUpdate: number;
}> {
  try {
    const result = await provider.callContract({
      contractAddress: CONTRACTS.YIELD_MANAGER,
      entrypoint: 'get_user_yield_info',
      calldata: [userAddress],
    });
    return {
      deposited: BigInt(result[0] ?? '0'),
      pendingYield: BigInt(result[2] ?? '0'), // u256 is 2 felts
      cumulativeYield: BigInt(result[4] ?? '0'),
      lastUpdate: Number(result[6] ?? 0),
    };
  } catch (error) {
    console.error('Error getting user yield info:', error);
    throw error;
  }
}

export async function getWBTCBalance(userAddress: string): Promise<bigint> {
  try {
    const result = await provider.callContract({
      contractAddress: CONTRACTS.WBTC,
      entrypoint: 'balance_of',
      calldata: [userAddress],
    });
    return BigInt(result[0] ?? '0');
  } catch (error) {
    console.error('Error getting wBTC balance:', error);
    throw error;
  }
}

export async function getBTCUSDBalance(userAddress: string): Promise<bigint> {
  try {
    const result = await provider.callContract({
      contractAddress: CONTRACTS.TOKEN,
      entrypoint: 'balance_of',
      calldata: [userAddress],
    });
    return BigInt(result[0] ?? '0');
  } catch (error) {
    console.error('Error getting BTCUSD balance:', error);
    throw error;
  }
}

// Calculate collateral ratio
export function calculateCollateralRatio(
  collateral: bigint,
  debt: bigint,
  btcPrice: bigint
): number {
  if (debt === 0n) return Infinity;

  // collateral is in wBTC (8 decimals), debt in BTCUSD (18 decimals), price in 8 decimals
  const collateralValue = (collateral * btcPrice) / BigInt(1e8);
  // Scale to match debt decimals
  const collateralValue18 = collateralValue * BigInt(1e10);

  const ratio = Number(collateralValue18 * 10000n / debt);
  return ratio; // Returns basis points (15000 = 150%)
}

// Calculate liquidation price
export function calculateLiquidationPrice(
  collateral: bigint,
  debt: bigint
): bigint {
  if (collateral === 0n) return 0n;

  // Liquidation occurs when collateral_value / debt < 120%
  // collateral * price / 1e8 * 1e10 / debt = 12000 / 10000
  // price = debt * 1e8 * 1.2 / collateral / 1e10
  const threshold = BigInt(PROTOCOL.LIQUIDATION_THRESHOLD);
  const liquidationPrice = (debt * BigInt(1e8) * threshold) / (collateral * BigInt(1e10) * 10000n);
  return liquidationPrice;
}
