/**
 * Contract ABIs for BTCUSD Protocol
 *
 * These are minimal ABIs containing only the functions we need.
 * Full ABIs will be generated from contract compilation.
 */

export const VAULT_ABI = [
  {
    name: 'deposit_collateral',
    type: 'function',
    inputs: [{ name: 'amount', type: 'u256' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'withdraw_collateral',
    type: 'function',
    inputs: [{ name: 'amount', type: 'u256' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'mint_btcusd',
    type: 'function',
    inputs: [{ name: 'amount', type: 'u256' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'burn_btcusd',
    type: 'function',
    inputs: [{ name: 'amount', type: 'u256' }],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'deposit_and_mint',
    type: 'function',
    inputs: [{ name: 'collateral_amount', type: 'u256' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'external',
  },
  {
    name: 'repay_and_withdraw',
    type: 'function',
    inputs: [{ name: 'btcusd_amount', type: 'u256' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'external',
  },
  {
    name: 'get_position',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [
      {
        type: 'struct',
        name: 'Position',
        members: [
          { name: 'collateral', type: 'u256' },
          { name: 'debt', type: 'u256' },
          { name: 'last_update', type: 'u64' },
        ],
      },
    ],
    state_mutability: 'view',
  },
  {
    name: 'get_collateral_ratio',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_health_factor',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'is_liquidatable',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'bool' }],
    state_mutability: 'view',
  },
  {
    name: 'get_max_mintable',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_max_withdrawable',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_protocol_stats',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'u256' }, { type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_btc_price',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
] as const;

export const TOKEN_ABI = [
  {
    name: 'name',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'felt252' }],
    state_mutability: 'view',
  },
  {
    name: 'symbol',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'felt252' }],
    state_mutability: 'view',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'u8' }],
    state_mutability: 'view',
  },
  {
    name: 'total_supply',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'balance_of',
    type: 'function',
    inputs: [{ name: 'account', type: 'ContractAddress' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'ContractAddress' },
      { name: 'spender', type: 'ContractAddress' },
    ],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'ContractAddress' },
      { name: 'amount', type: 'u256' },
    ],
    outputs: [{ type: 'bool' }],
    state_mutability: 'external',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'ContractAddress' },
      { name: 'amount', type: 'u256' },
    ],
    outputs: [{ type: 'bool' }],
    state_mutability: 'external',
  },
  {
    name: 'transfer_from',
    type: 'function',
    inputs: [
      { name: 'sender', type: 'ContractAddress' },
      { name: 'recipient', type: 'ContractAddress' },
      { name: 'amount', type: 'u256' },
    ],
    outputs: [{ type: 'bool' }],
    state_mutability: 'external',
  },
] as const;

export const ORACLE_ABI = [
  {
    name: 'get_btc_price',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'u256' }, { type: 'u64' }],
    state_mutability: 'view',
  },
  {
    name: 'is_price_stale',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'bool' }],
    state_mutability: 'view',
  },
  {
    name: 'get_max_price_age',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'u64' }],
    state_mutability: 'view',
  },
] as const;

export const YIELD_MANAGER_ABI = [
  {
    name: 'get_user_deposit',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_user_yield',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_total_deposits',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_total_yield',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_yield_rate',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'get_fee_config',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'u256' }, { type: 'u256' }],
    state_mutability: 'view',
  },
  {
    name: 'harvest_yield',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'external',
  },
] as const;
