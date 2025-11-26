/**
 * Starknet Service for Backend
 */

import { RpcProvider, Account, Contract, Call } from 'starknet';
import { NETWORK, CONTRACTS, KEEPER_ACCOUNT } from '../config/index.js';
import pino from 'pino';

// @ts-ignore - pino ESM typing issue
const createLogger = pino.default || pino;
const logger = createLogger({ name: 'starknet' });

// Singleton provider
let provider: RpcProvider | null = null;
let keeperAccount: Account | null = null;

/**
 * Get Starknet provider
 */
export function getProvider(): RpcProvider {
  if (!provider) {
    provider = new RpcProvider({ nodeUrl: NETWORK.rpcUrl });
    logger.info(`Connected to ${NETWORK.name} at ${NETWORK.rpcUrl}`);
  }
  return provider;
}

/**
 * Get keeper account for signing transactions
 */
export function getKeeperAccount(): Account {
  if (!keeperAccount) {
    if (!KEEPER_ACCOUNT.address || !KEEPER_ACCOUNT.privateKey) {
      throw new Error('Keeper account not configured');
    }
    keeperAccount = new Account(
      getProvider(),
      KEEPER_ACCOUNT.address,
      KEEPER_ACCOUNT.privateKey
    );
    logger.info(`Keeper account: ${KEEPER_ACCOUNT.address}`);
  }
  return keeperAccount;
}

/**
 * Minimal ABIs for backend operations
 */
const VAULT_ABI = [
  {
    name: 'get_position',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [
      {
        type: 'struct',
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
    name: 'is_liquidatable',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'bool' }],
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

const ORACLE_ABI = [
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
] as const;

const YIELD_MANAGER_ABI = [
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
    name: 'harvest_yield',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'u256' }],
    state_mutability: 'external',
  },
  {
    name: 'harvest_all',
    type: 'function',
    inputs: [],
    outputs: [],
    state_mutability: 'external',
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
] as const;

const LIQUIDATOR_ABI = [
  {
    name: 'liquidate',
    type: 'function',
    inputs: [
      { name: 'user', type: 'ContractAddress' },
      { name: 'btcusd_amount', type: 'u256' },
    ],
    outputs: [{ type: 'u256' }, { type: 'u256' }],
    state_mutability: 'external',
  },
  {
    name: 'calculate_liquidation',
    type: 'function',
    inputs: [
      { name: 'user', type: 'ContractAddress' },
      { name: 'btcusd_amount', type: 'u256' },
    ],
    outputs: [{ type: 'u256' }, { type: 'u256' }, { type: 'u256' }],
    state_mutability: 'view',
  },
] as const;

/**
 * Get contract instances
 */
export function getContracts(account?: Account) {
  const p = getProvider();
  const acc = account || p;

  return {
    vault: new Contract(VAULT_ABI as any, CONTRACTS.vault, acc),
    oracle: new Contract(ORACLE_ABI as any, CONTRACTS.oracle, acc),
    yieldManager: new Contract(YIELD_MANAGER_ABI as any, CONTRACTS.yieldManager, acc),
    liquidator: new Contract(LIQUIDATOR_ABI as any, CONTRACTS.liquidator, acc),
  };
}

/**
 * Execute transaction with keeper account
 */
export async function executeTransaction(calls: Call[]): Promise<string> {
  const account = getKeeperAccount();
  const response = await account.execute(calls);
  logger.info(`Transaction submitted: ${response.transaction_hash}`);

  // Wait for transaction
  await getProvider().waitForTransaction(response.transaction_hash);
  logger.info(`Transaction confirmed: ${response.transaction_hash}`);

  return response.transaction_hash;
}

/**
 * Check keeper account balance
 */
export async function checkKeeperBalance(): Promise<bigint> {
  const account = getKeeperAccount();
  // @ts-ignore - RpcProvider method exists at runtime
  const balance = await (getProvider() as any).getBalance(account.address);
  return BigInt(balance);
}
