/**
 * Contract ABIs for BTCUSD Protocol
 *
 * These ABIs are used by starknet.js to interact with deployed contracts.
 * They define the interface for each contract's functions.
 */

/**
 * BTCUSDVault ABI
 * Core vault contract for collateral management and minting
 */
export const VAULT_ABI = [
  // View functions
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
    name: 'get_collateral_ratio',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'ratio', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_protocol_stats',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'total_collateral', type: 'core::integer::u256' },
      { name: 'total_debt', type: 'core::integer::u256' },
    ],
    state_mutability: 'view',
  },
  {
    name: 'get_max_mintable',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'amount', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'is_liquidatable',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'liquidatable', type: 'core::bool' }],
    state_mutability: 'view',
  },
  // External functions
  {
    name: 'deposit_collateral',
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
] as const;

/**
 * BTCUSDToken ABI
 * ERC20 stablecoin token with vault-only minting
 */
export const TOKEN_ABI = [
  {
    name: 'name',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'name', type: 'core::felt252' }],
    state_mutability: 'view',
  },
  {
    name: 'symbol',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'symbol', type: 'core::felt252' }],
    state_mutability: 'view',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'decimals', type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    name: 'total_supply',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'supply', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'balance_of',
    type: 'function',
    inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'balance', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
    ],
    outputs: [{ name: 'remaining', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ name: 'success', type: 'core::bool' }],
    state_mutability: 'external',
  },
  {
    name: 'transfer_from',
    type: 'function',
    inputs: [
      { name: 'sender', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ name: 'success', type: 'core::bool' }],
    state_mutability: 'external',
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
] as const;

/**
 * MockWBTC ABI (ERC20)
 * Test wBTC token with faucet functionality
 */
export const WBTC_ABI = [
  {
    name: 'balance_of',
    type: 'function',
    inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'balance', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
    ],
    outputs: [{ name: 'remaining', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ name: 'success', type: 'core::bool' }],
    state_mutability: 'external',
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
  {
    name: 'mint',
    type: 'function',
    inputs: [
      { name: 'to', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
] as const;

/**
 * MockOracle ABI
 * Price oracle for BTC/USD
 */
export const ORACLE_ABI = [
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
  {
    name: 'set_price',
    type: 'function',
    inputs: [{ name: 'price', type: 'core::integer::u256' }],
    outputs: [],
    state_mutability: 'external',
  },
] as const;

/**
 * YieldManager ABI
 * Yield tracking and distribution
 */
export const YIELD_MANAGER_ABI = [
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
    name: 'get_total_deposits',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'total', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_total_yield',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'total', type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'harvest_user_yield',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'amount', type: 'core::integer::u256' }],
    state_mutability: 'external',
  },
] as const;

/**
 * Liquidator ABI
 * Liquidation contract for unhealthy positions
 */
export const LIQUIDATOR_ABI = [
  {
    name: 'is_liquidatable',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'liquidatable', type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    name: 'get_liquidation_info',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [
      { name: 'debt_to_cover', type: 'core::integer::u256' },
      { name: 'collateral_to_receive', type: 'core::integer::u256' },
      { name: 'liquidation_bonus', type: 'core::integer::u256' },
    ],
    state_mutability: 'view',
  },
  {
    name: 'liquidate',
    type: 'function',
    inputs: [
      { name: 'user', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'debt_amount', type: 'core::integer::u256' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
] as const;

// Export all ABIs as a single object
export const ABIS = {
  VAULT: VAULT_ABI,
  TOKEN: TOKEN_ABI,
  WBTC: WBTC_ABI,
  ORACLE: ORACLE_ABI,
  YIELD_MANAGER: YIELD_MANAGER_ABI,
  LIQUIDATOR: LIQUIDATOR_ABI,
} as const;
