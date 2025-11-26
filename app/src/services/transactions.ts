/**
 * Transaction Service
 *
 * Handles all contract interactions with proper transaction signing.
 * Uses starknet.js Account for transaction execution.
 */

import { Account, Contract, uint256, CallData } from 'starknet';
import { CONTRACTS, PROTOCOL } from '../constants';
import { VAULT_ABI, WBTC_ABI, TOKEN_ABI, YIELD_MANAGER_ABI } from '../constants/abis';

// Transaction types
export type TransactionType = 'deposit' | 'withdraw' | 'mint' | 'burn' | 'harvest' | 'approve' | 'faucet';

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  type: TransactionType;
}

export interface TransactionParams {
  type: TransactionType;
  amount: bigint;
  account: Account;
}

/**
 * Helper to create contract with account
 */
function createContract(abi: any, address: string, account: Account): Contract {
  return new Contract({
    abi,
    address,
    providerOrAccount: account,
  });
}

/**
 * Approve wBTC spending by vault
 */
export async function approveWBTC(
  account: Account,
  amount: bigint
): Promise<TransactionResult> {
  try {
    const wbtcContract = createContract(WBTC_ABI as any, CONTRACTS.WBTC, account);

    // Convert amount to uint256
    const amountU256 = uint256.bnToUint256(amount);

    const tx = await wbtcContract.invoke('approve', [CONTRACTS.VAULT, amountU256]);

    return {
      hash: tx.transaction_hash,
      status: 'pending',
      type: 'approve',
    };
  } catch (error) {
    console.error('Approve error:', error);
    throw error;
  }
}

/**
 * Deposit wBTC collateral to vault
 */
export async function depositCollateral(
  account: Account,
  amount: bigint
): Promise<TransactionResult> {
  try {
    // First approve the vault to spend wBTC
    const approveResult = await approveWBTC(account, amount);
    console.log('Approval tx:', approveResult.hash);

    // Wait a bit for approval to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Now deposit
    const vaultContract = createContract(VAULT_ABI as any, CONTRACTS.VAULT, account);
    const amountU256 = uint256.bnToUint256(amount);

    const tx = await vaultContract.invoke('deposit_collateral', [amountU256]);

    return {
      hash: tx.transaction_hash,
      status: 'pending',
      type: 'deposit',
    };
  } catch (error) {
    console.error('Deposit error:', error);
    throw error;
  }
}

/**
 * Withdraw wBTC collateral from vault
 */
export async function withdrawCollateral(
  account: Account,
  amount: bigint
): Promise<TransactionResult> {
  try {
    const vaultContract = createContract(VAULT_ABI as any, CONTRACTS.VAULT, account);
    const amountU256 = uint256.bnToUint256(amount);

    const tx = await vaultContract.invoke('withdraw_collateral', [amountU256]);

    return {
      hash: tx.transaction_hash,
      status: 'pending',
      type: 'withdraw',
    };
  } catch (error) {
    console.error('Withdraw error:', error);
    throw error;
  }
}

/**
 * Mint BTCUSD stablecoin
 */
export async function mintBTCUSD(
  account: Account,
  amount: bigint
): Promise<TransactionResult> {
  try {
    const vaultContract = createContract(VAULT_ABI as any, CONTRACTS.VAULT, account);
    const amountU256 = uint256.bnToUint256(amount);

    const tx = await vaultContract.invoke('mint', [amountU256]);

    return {
      hash: tx.transaction_hash,
      status: 'pending',
      type: 'mint',
    };
  } catch (error) {
    console.error('Mint error:', error);
    throw error;
  }
}

/**
 * Burn BTCUSD to repay debt
 */
export async function burnBTCUSD(
  account: Account,
  amount: bigint
): Promise<TransactionResult> {
  try {
    const vaultContract = createContract(VAULT_ABI as any, CONTRACTS.VAULT, account);
    const amountU256 = uint256.bnToUint256(amount);

    const tx = await vaultContract.invoke('burn', [amountU256]);

    return {
      hash: tx.transaction_hash,
      status: 'pending',
      type: 'burn',
    };
  } catch (error) {
    console.error('Burn error:', error);
    throw error;
  }
}

/**
 * Harvest pending yield
 */
export async function harvestYield(
  account: Account,
  userAddress: string
): Promise<TransactionResult> {
  try {
    const yieldContract = createContract(
      YIELD_MANAGER_ABI as any,
      CONTRACTS.YIELD_MANAGER,
      account
    );

    const tx = await yieldContract.invoke('harvest_user_yield', [userAddress]);

    return {
      hash: tx.transaction_hash,
      status: 'pending',
      type: 'harvest',
    };
  } catch (error) {
    console.error('Harvest error:', error);
    throw error;
  }
}

/**
 * Deposit and mint in one flow (convenience function)
 */
export async function depositAndMint(
  account: Account,
  depositAmount: bigint,
  mintAmount: bigint
): Promise<{ depositTx: TransactionResult; mintTx: TransactionResult }> {
  // First deposit
  const depositTx = await depositCollateral(account, depositAmount);

  // Wait for deposit to be processed
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Then mint
  const mintTx = await mintBTCUSD(account, mintAmount);

  return { depositTx, mintTx };
}

/**
 * Burn and withdraw in one flow (convenience function)
 */
export async function burnAndWithdraw(
  account: Account,
  burnAmount: bigint,
  withdrawAmount: bigint
): Promise<{ burnTx: TransactionResult; withdrawTx: TransactionResult }> {
  // First burn debt
  const burnTx = await burnBTCUSD(account, burnAmount);

  // Wait for burn to be processed
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Then withdraw
  const withdrawTx = await withdrawCollateral(account, withdrawAmount);

  return { burnTx, withdrawTx };
}

/**
 * Faucet - Mint test wBTC (testnet only!)
 */
export async function mintTestWBTC(
  account: Account,
  toAddress: string,
  amount: bigint = 100000000n // 1 wBTC default
): Promise<TransactionResult> {
  try {
    const wbtcContract = createContract(WBTC_ABI as any, CONTRACTS.WBTC, account);
    const amountU256 = uint256.bnToUint256(amount);

    const tx = await wbtcContract.invoke('mint', [toAddress, amountU256]);

    return {
      hash: tx.transaction_hash,
      status: 'pending',
      type: 'faucet',
    };
  } catch (error) {
    console.error('Faucet error:', error);
    throw error;
  }
}

/**
 * Get transaction explorer URL
 */
export function getTransactionUrl(txHash: string): string {
  return `https://sepolia.starkscan.co/tx/${txHash}`;
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  account: Account,
  txHash: string,
  maxAttempts = 30
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await account.getTransactionReceipt(txHash) as any;
      if (receipt.execution_status === 'SUCCEEDED' || receipt.finality_status === 'ACCEPTED_ON_L2') {
        return true;
      }
      if (receipt.execution_status === 'REVERTED' || receipt.finality_status === 'REJECTED') {
        return false;
      }
    } catch {
      // Transaction not yet processed
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}
