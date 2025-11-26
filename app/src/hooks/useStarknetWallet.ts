/**
 * useStarknetWallet Hook
 *
 * Integrates with starknet-react for wallet connection and transaction signing.
 * This is the primary hook for all wallet interactions.
 */

import { useCallback, useEffect, useMemo } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useProvider,
} from '@starknet-react/core';
import { Account } from 'starknet';
import { useStore } from '../store';
import {
  depositCollateral,
  withdrawCollateral,
  mintBTCUSD,
  burnBTCUSD,
  harvestYield,
  depositAndMint,
  burnAndWithdraw,
  waitForTransaction,
  getTransactionUrl,
  TransactionResult,
} from '../services/transactions';

export interface StarknetWalletState {
  // Connection state
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: string | null;

  // Connector info
  connectorName: string | null;
  availableConnectors: string[];
}

export interface StarknetWalletActions {
  // Connection
  connect: (connectorId?: string) => Promise<void>;
  disconnect: () => void;

  // Transactions
  deposit: (amount: bigint) => Promise<TransactionResult>;
  withdraw: (amount: bigint) => Promise<TransactionResult>;
  mint: (amount: bigint) => Promise<TransactionResult>;
  burn: (amount: bigint) => Promise<TransactionResult>;
  harvest: () => Promise<TransactionResult>;

  // Combined operations
  depositAndMint: (depositAmt: bigint, mintAmt: bigint) => Promise<void>;
  burnAndWithdraw: (burnAmt: bigint, withdrawAmt: bigint) => Promise<void>;

  // Utilities
  waitForTx: (txHash: string) => Promise<boolean>;
  getTxUrl: (txHash: string) => string;
}

export function useStarknetWallet(): StarknetWalletState & StarknetWalletActions {
  const { setWallet, addTransaction, updateTransaction, refreshAll } = useStore();

  // Starknet React hooks
  const { address, status, account, chainId, connector } = useAccount();
  const { connect: connectWallet, connectors, isPending } = useConnect();
  const { disconnect: disconnectWallet } = useDisconnect();
  const { provider } = useProvider();

  // Sync wallet state to store
  useEffect(() => {
    setWallet({
      address: address ?? null,
      isConnected: status === 'connected',
      chainId: chainId ? String(chainId) : null,
    });

    // Refresh data when connected
    if (status === 'connected' && address) {
      refreshAll();
    }
  }, [address, status, chainId, setWallet, refreshAll]);

  // Create account instance for transactions
  const accountInstance = useMemo(() => {
    if (account) {
      return account as unknown as Account;
    }
    return null;
  }, [account]);

  // Connect to wallet
  const connect = useCallback(
    async (connectorId?: string) => {
      const targetConnector = connectorId
        ? connectors.find((c) => c.id === connectorId)
        : connectors[0];

      if (targetConnector) {
        connectWallet({ connector: targetConnector });
      }
    },
    [connectors, connectWallet]
  );

  // Disconnect wallet
  const disconnect = useCallback(() => {
    disconnectWallet();
    setWallet({
      address: null,
      isConnected: false,
      chainId: null,
    });
  }, [disconnectWallet, setWallet]);

  // Transaction wrapper with store updates
  const executeTransaction = useCallback(
    async (
      txFn: () => Promise<TransactionResult>,
      type: string
    ): Promise<TransactionResult> => {
      if (!accountInstance) {
        throw new Error('Wallet not connected');
      }

      const result = await txFn();

      // Add to store
      addTransaction({
        hash: result.hash,
        type: result.type,
        status: 'pending',
        timestamp: Date.now(),
      });

      // Wait for confirmation in background
      waitForTransaction(accountInstance, result.hash).then((success) => {
        updateTransaction(result.hash, success ? 'confirmed' : 'failed');
        // Refresh data after transaction
        refreshAll();
      });

      return result;
    },
    [accountInstance, addTransaction, updateTransaction, refreshAll]
  );

  // Deposit collateral
  const deposit = useCallback(
    async (amount: bigint): Promise<TransactionResult> => {
      if (!accountInstance) throw new Error('Wallet not connected');
      return executeTransaction(
        () => depositCollateral(accountInstance, amount),
        'deposit'
      );
    },
    [accountInstance, executeTransaction]
  );

  // Withdraw collateral
  const withdraw = useCallback(
    async (amount: bigint): Promise<TransactionResult> => {
      if (!accountInstance) throw new Error('Wallet not connected');
      return executeTransaction(
        () => withdrawCollateral(accountInstance, amount),
        'withdraw'
      );
    },
    [accountInstance, executeTransaction]
  );

  // Mint BTCUSD
  const mint = useCallback(
    async (amount: bigint): Promise<TransactionResult> => {
      if (!accountInstance) throw new Error('Wallet not connected');
      return executeTransaction(
        () => mintBTCUSD(accountInstance, amount),
        'mint'
      );
    },
    [accountInstance, executeTransaction]
  );

  // Burn BTCUSD
  const burn = useCallback(
    async (amount: bigint): Promise<TransactionResult> => {
      if (!accountInstance) throw new Error('Wallet not connected');
      return executeTransaction(
        () => burnBTCUSD(accountInstance, amount),
        'burn'
      );
    },
    [accountInstance, executeTransaction]
  );

  // Harvest yield
  const harvest = useCallback(async (): Promise<TransactionResult> => {
    if (!accountInstance || !address) throw new Error('Wallet not connected');
    return executeTransaction(
      () => harvestYield(accountInstance, address),
      'harvest'
    );
  }, [accountInstance, address, executeTransaction]);

  // Deposit and mint combined
  const depositAndMintFn = useCallback(
    async (depositAmt: bigint, mintAmt: bigint): Promise<void> => {
      if (!accountInstance) throw new Error('Wallet not connected');

      const { depositTx, mintTx } = await depositAndMint(
        accountInstance,
        depositAmt,
        mintAmt
      );

      addTransaction({
        hash: depositTx.hash,
        type: 'deposit',
        status: 'pending',
        timestamp: Date.now(),
      });

      addTransaction({
        hash: mintTx.hash,
        type: 'mint',
        status: 'pending',
        timestamp: Date.now(),
      });

      // Refresh after both complete
      refreshAll();
    },
    [accountInstance, addTransaction, refreshAll]
  );

  // Burn and withdraw combined
  const burnAndWithdrawFn = useCallback(
    async (burnAmt: bigint, withdrawAmt: bigint): Promise<void> => {
      if (!accountInstance) throw new Error('Wallet not connected');

      const { burnTx, withdrawTx } = await burnAndWithdraw(
        accountInstance,
        burnAmt,
        withdrawAmt
      );

      addTransaction({
        hash: burnTx.hash,
        type: 'burn',
        status: 'pending',
        timestamp: Date.now(),
      });

      addTransaction({
        hash: withdrawTx.hash,
        type: 'withdraw',
        status: 'pending',
        timestamp: Date.now(),
      });

      refreshAll();
    },
    [accountInstance, addTransaction, refreshAll]
  );

  // Wait for transaction
  const waitForTx = useCallback(
    async (txHash: string): Promise<boolean> => {
      if (!accountInstance) return false;
      return waitForTransaction(accountInstance, txHash);
    },
    [accountInstance]
  );

  return {
    // State
    address: address ?? null,
    isConnected: status === 'connected',
    isConnecting: isPending || status === 'connecting',
    chainId: chainId ? String(chainId) : null,
    connectorName: connector?.name ?? null,
    availableConnectors: connectors.map((c) => c.id),

    // Actions
    connect,
    disconnect,
    deposit,
    withdraw,
    mint,
    burn,
    harvest,
    depositAndMint: depositAndMintFn,
    burnAndWithdraw: burnAndWithdrawFn,
    waitForTx,
    getTxUrl: getTransactionUrl,
  };
}
