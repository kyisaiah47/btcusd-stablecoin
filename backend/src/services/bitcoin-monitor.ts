/**
 * Bitcoin Monitor Service
 *
 * Monitors Bitcoin blockchain for incoming deposits using Mempool.space API.
 * This is a production-ready implementation for tracking BTC transactions.
 */

import pino from 'pino';
import { BRIDGE_CONFIG } from '../config/index.js';

// @ts-ignore - pino ESM typing issue
const createLogger = pino.default || pino;
const logger = createLogger({ name: 'bitcoin-monitor' });

// ============ Types ============

export interface BitcoinTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey: string;
      scriptpubkey_asm: string;
      scriptpubkey_type: string;
      scriptpubkey_address: string;
      value: number;
    };
    scriptsig: string;
    scriptsig_asm: string;
    witness?: string[];
    is_coinbase: boolean;
    sequence: number;
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address?: string;
    value: number;
  }>;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

export interface AddressInfo {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

export interface UTXO {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  value: number;
}

export interface DepositInfo {
  txid: string;
  amountSats: number;
  confirmations: number;
  blockHeight?: number;
  blockTime?: number;
  isConfirmed: boolean;
}

// ============ Bitcoin Monitor Service ============

export class BitcoinMonitorService {
  private apiUrl: string;
  private currentBlockHeight: number = 0;

  constructor() {
    this.apiUrl = BRIDGE_CONFIG.mempoolApiUrl;
  }

  /**
   * Initialize the service by fetching current block height
   */
  async initialize(): Promise<void> {
    try {
      this.currentBlockHeight = await this.getBlockHeight();
      logger.info({ blockHeight: this.currentBlockHeight }, 'Bitcoin monitor initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Bitcoin monitor');
      throw error;
    }
  }

  /**
   * Get current Bitcoin block height
   */
  async getBlockHeight(): Promise<number> {
    try {
      const response = await fetch(`${this.apiUrl}/blocks/tip/height`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const height = await response.text();
      this.currentBlockHeight = parseInt(height, 10);
      return this.currentBlockHeight;
    } catch (error) {
      logger.error({ error }, 'Failed to get block height');
      throw error;
    }
  }

  /**
   * Get address information
   */
  async getAddressInfo(address: string): Promise<AddressInfo> {
    try {
      const response = await fetch(`${this.apiUrl}/address/${address}`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      return await response.json() as AddressInfo;
    } catch (error) {
      logger.error({ error, address }, 'Failed to get address info');
      throw error;
    }
  }

  /**
   * Get UTXOs for an address
   */
  async getAddressUtxos(address: string): Promise<UTXO[]> {
    try {
      const response = await fetch(`${this.apiUrl}/address/${address}/utxo`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      return await response.json() as UTXO[];
    } catch (error) {
      logger.error({ error, address }, 'Failed to get address UTXOs');
      throw error;
    }
  }

  /**
   * Get transactions for an address
   */
  async getAddressTransactions(address: string): Promise<BitcoinTransaction[]> {
    try {
      const response = await fetch(`${this.apiUrl}/address/${address}/txs`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      return await response.json() as BitcoinTransaction[];
    } catch (error) {
      logger.error({ error, address }, 'Failed to get address transactions');
      throw error;
    }
  }

  /**
   * Get a specific transaction
   */
  async getTransaction(txid: string): Promise<BitcoinTransaction> {
    try {
      const response = await fetch(`${this.apiUrl}/tx/${txid}`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      return await response.json() as BitcoinTransaction;
    } catch (error) {
      logger.error({ error, txid }, 'Failed to get transaction');
      throw error;
    }
  }

  /**
   * Check for deposits to a specific address
   * Returns deposit info if found, null otherwise
   */
  async checkForDeposit(
    address: string,
    expectedAmountSats?: number
  ): Promise<DepositInfo | null> {
    try {
      // Get current block height for confirmation calculation
      await this.getBlockHeight();

      // Get UTXOs for the address
      const utxos = await this.getAddressUtxos(address);

      if (utxos.length === 0) {
        return null;
      }

      // Find the most relevant UTXO
      // If expectedAmountSats is provided, try to find matching amount
      // Otherwise, use the largest UTXO
      let targetUtxo: UTXO | null = null;

      if (expectedAmountSats) {
        // Allow 1% tolerance for fees
        const tolerance = Math.floor(expectedAmountSats * 0.01);
        targetUtxo = utxos.find(
          (utxo) =>
            utxo.value >= expectedAmountSats - tolerance &&
            utxo.value <= expectedAmountSats + tolerance
        ) || null;
      }

      // If no matching amount, use the first (most recent) UTXO
      if (!targetUtxo && utxos.length > 0) {
        targetUtxo = utxos[0];
      }

      if (!targetUtxo) {
        return null;
      }

      // Calculate confirmations
      let confirmations = 0;
      if (targetUtxo.status.confirmed && targetUtxo.status.block_height) {
        confirmations = this.currentBlockHeight - targetUtxo.status.block_height + 1;
      }

      const depositInfo: DepositInfo = {
        txid: targetUtxo.txid,
        amountSats: targetUtxo.value,
        confirmations,
        blockHeight: targetUtxo.status.block_height,
        blockTime: targetUtxo.status.block_time,
        isConfirmed: confirmations >= BRIDGE_CONFIG.requiredConfirmations,
      };

      logger.debug({
        address,
        txid: depositInfo.txid,
        amount: depositInfo.amountSats,
        confirmations: depositInfo.confirmations,
        isConfirmed: depositInfo.isConfirmed,
      }, 'Deposit check result');

      return depositInfo;
    } catch (error) {
      logger.error({ error, address }, 'Failed to check for deposit');
      return null;
    }
  }

  /**
   * Monitor multiple addresses for deposits
   * Returns a map of address -> deposit info
   */
  async monitorAddresses(
    addresses: Map<string, { expectedAmountSats?: number }>
  ): Promise<Map<string, DepositInfo>> {
    const results = new Map<string, DepositInfo>();

    // Update block height once for all checks
    await this.getBlockHeight();

    // Check each address in parallel with rate limiting
    const addressEntries = Array.from(addresses.entries());
    const batchSize = 5; // Avoid rate limiting

    for (let i = 0; i < addressEntries.length; i += batchSize) {
      const batch = addressEntries.slice(i, i + batchSize);

      const promises = batch.map(async ([address, { expectedAmountSats }]) => {
        const deposit = await this.checkForDeposit(address, expectedAmountSats);
        if (deposit) {
          results.set(address, deposit);
        }
      });

      await Promise.all(promises);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < addressEntries.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  /**
   * Validate a Bitcoin address format
   */
  isValidAddress(address: string): boolean {
    // Basic validation for different address formats
    // Mainnet: 1..., 3..., bc1...
    // Testnet: m..., n..., 2..., tb1...
    const mainnetRegex = /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
    const testnetRegex = /^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$|^tb1[a-zA-HJ-NP-Z0-9]{39,59}$/;

    if (BRIDGE_CONFIG.bitcoinNetwork === 'mainnet') {
      return mainnetRegex.test(address);
    } else {
      return testnetRegex.test(address);
    }
  }

  /**
   * Get mempool.space URL for a transaction
   */
  getTransactionUrl(txid: string): string {
    const baseUrl = BRIDGE_CONFIG.bitcoinNetwork === 'mainnet'
      ? 'https://mempool.space'
      : 'https://mempool.space/testnet';
    return `${baseUrl}/tx/${txid}`;
  }

  /**
   * Get mempool.space URL for an address
   */
  getAddressUrl(address: string): string {
    const baseUrl = BRIDGE_CONFIG.bitcoinNetwork === 'mainnet'
      ? 'https://mempool.space'
      : 'https://mempool.space/testnet';
    return `${baseUrl}/address/${address}`;
  }
}

// Singleton instance
let bitcoinMonitorInstance: BitcoinMonitorService | null = null;

export function getBitcoinMonitor(): BitcoinMonitorService {
  if (!bitcoinMonitorInstance) {
    bitcoinMonitorInstance = new BitcoinMonitorService();
  }
  return bitcoinMonitorInstance;
}
