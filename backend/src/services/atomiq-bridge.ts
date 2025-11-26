/**
 * Atomiq Bridge Service
 *
 * Monitors and processes BTC ↔ wBTC bridge operations via Atomiq protocol.
 *
 * Responsibilities:
 * 1. Generate deposit addresses for users
 * 2. Monitor Bitcoin blockchain for incoming deposits
 * 3. Trigger wBTC minting when deposits are confirmed
 * 4. Process wBTC → BTC withdrawal requests
 */

import { Contract, Call } from 'starknet';
import { getProvider, getKeeperAccount, executeTransaction } from './starknet.js';
import { CONTRACTS } from '../config/index.js';
import pino from 'pino';

// @ts-ignore - pino ESM typing issue
const createLogger = pino.default || pino;
const logger = createLogger({ name: 'atomiq-bridge' });

// Bridge configuration
export interface AtomiqBridgeConfig {
  enabled: boolean;
  pollIntervalMs: number;
  requiredConfirmations: number;
  atomiqApiUrl: string;
  atomiqApiKey?: string;
  alertWebhook?: string;
}

// Deposit status enum matching contract
export enum DepositStatus {
  Pending = 0,
  Confirmed = 1,
  Claimed = 2,
  Expired = 3,
}

// Withdrawal status enum matching contract
export enum WithdrawalStatus {
  Pending = 0,
  Processing = 1,
  Completed = 2,
  Refunded = 3,
}

// Bridge deposit request from app
export interface BridgeDepositRequest {
  starknetAddress: string;
  amountSats: bigint;
}

// Bridge deposit response
export interface BridgeDepositResponse {
  depositId: string;
  btcAddress: string;
  btcAddressHash: string;
  amountSats: bigint;
  expiresAt: number;
}

// Bridge deposit status
export interface BridgeDepositStatus {
  depositId: string;
  user: string;
  amountSats: bigint;
  btcAddressHash: string;
  status: DepositStatus;
  btcTxHash?: string;
  confirmations?: number;
  createdAt: number;
  expiresAt: number;
}

// Bitcoin transaction info from monitoring
export interface BtcTransaction {
  txHash: string;
  outputIndex: number;
  address: string;
  amountSats: bigint;
  confirmations: number;
  blockHeight?: number;
}

// Atomiq adapter ABI (minimal)
const ATOMIQ_ADAPTER_ABI = [
  {
    name: 'request_deposit',
    type: 'function',
    inputs: [{ name: 'amount_sats', type: 'u64' }],
    outputs: [{ type: 'u256' }, { type: 'felt252' }],
    state_mutability: 'external',
  },
  {
    name: 'claim_deposit',
    type: 'function',
    inputs: [
      { name: 'deposit_id', type: 'u256' },
      { name: 'btc_tx_hash', type: 'u256' },
      { name: 'merkle_proof', type: 'Array<u256>' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    name: 'get_deposit',
    type: 'function',
    inputs: [{ name: 'deposit_id', type: 'u256' }],
    outputs: [
      {
        type: 'struct',
        members: [
          { name: 'user', type: 'ContractAddress' },
          { name: 'amount_sats', type: 'u64' },
          { name: 'btc_address_hash', type: 'felt252' },
          { name: 'created_at', type: 'u64' },
          { name: 'expires_at', type: 'u64' },
          { name: 'status', type: 'u8' },
          { name: 'escrow_id', type: 'u256' },
        ],
      },
    ],
    state_mutability: 'view',
  },
  {
    name: 'get_user_deposits',
    type: 'function',
    inputs: [{ name: 'user', type: 'ContractAddress' }],
    outputs: [{ type: 'Array<u256>' }],
    state_mutability: 'view',
  },
] as const;

/**
 * Atomiq Bridge Service
 */
export class AtomiqBridgeService {
  private config: AtomiqBridgeConfig;
  private atomiqAdapter: Contract | null = null;
  private pendingDeposits: Map<string, BridgeDepositStatus> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: AtomiqBridgeConfig) {
    this.config = config;
  }

  /**
   * Initialize the bridge service
   */
  async initialize(): Promise<void> {
    const atomiqAdapterAddress = process.env.ATOMIQ_ADAPTER_ADDRESS;
    if (!atomiqAdapterAddress) {
      logger.warn('ATOMIQ_ADAPTER_ADDRESS not set, bridge service disabled');
      return;
    }

    const account = getKeeperAccount();
    this.atomiqAdapter = new Contract(
      ATOMIQ_ADAPTER_ABI as any,
      atomiqAdapterAddress,
      account
    );

    logger.info(`Atomiq Bridge Service initialized`);
    logger.info(`Atomiq Adapter: ${atomiqAdapterAddress}`);
  }

  /**
   * Start monitoring for Bitcoin deposits
   */
  async startMonitoring(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Atomiq Bridge monitoring disabled');
      return;
    }

    logger.info('Starting Atomiq Bridge monitoring...');
    logger.info(`Poll interval: ${this.config.pollIntervalMs}ms`);
    logger.info(`Required confirmations: ${this.config.requiredConfirmations}`);

    // Initial scan
    await this.scanPendingDeposits();

    // Start polling
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.scanPendingDeposits();
        await this.processConfirmedDeposits();
      } catch (error) {
        logger.error({ error }, 'Bridge monitoring error');
      }
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Atomiq Bridge monitoring stopped');
    }
  }

  /**
   * Request a new deposit address for a user
   */
  async requestDeposit(request: BridgeDepositRequest): Promise<BridgeDepositResponse> {
    if (!this.atomiqAdapter) {
      throw new Error('Atomiq adapter not initialized');
    }

    logger.info({
      user: request.starknetAddress,
      amountSats: request.amountSats.toString(),
    }, 'Requesting deposit address');

    try {
      // Call the contract to create deposit request
      // Note: In production, this would be called by the user's wallet
      // The backend would then monitor for the BTC deposit

      // For now, we simulate generating a deposit address
      // In production, this would come from Atomiq's actual service
      const depositId = BigInt(Date.now());
      const btcAddressHash = this.generateBtcAddressHash(
        request.starknetAddress,
        depositId
      );

      // Generate a testnet BTC address (simplified)
      const btcAddress = this.hashToBtcAddress(btcAddressHash);

      const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours

      const deposit: BridgeDepositStatus = {
        depositId: depositId.toString(),
        user: request.starknetAddress,
        amountSats: request.amountSats,
        btcAddressHash,
        status: DepositStatus.Pending,
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt,
      };

      this.pendingDeposits.set(depositId.toString(), deposit);

      logger.info({
        depositId: depositId.toString(),
        btcAddress,
        expiresAt,
      }, 'Deposit address generated');

      return {
        depositId: depositId.toString(),
        btcAddress,
        btcAddressHash,
        amountSats: request.amountSats,
        expiresAt,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to request deposit');
      throw error;
    }
  }

  /**
   * Scan for pending deposits that need to be monitored
   */
  private async scanPendingDeposits(): Promise<void> {
    logger.debug('Scanning pending deposits...');

    const now = Math.floor(Date.now() / 1000);

    for (const [depositId, deposit] of this.pendingDeposits) {
      // Check if expired
      if (now > deposit.expiresAt) {
        deposit.status = DepositStatus.Expired;
        logger.info({ depositId }, 'Deposit expired');
        continue;
      }

      // Check for BTC transaction
      if (deposit.status === DepositStatus.Pending) {
        const btcTx = await this.checkBtcDeposit(deposit.btcAddressHash);

        if (btcTx) {
          deposit.btcTxHash = btcTx.txHash;
          deposit.confirmations = btcTx.confirmations;

          if (btcTx.confirmations >= this.config.requiredConfirmations) {
            deposit.status = DepositStatus.Confirmed;
            logger.info({
              depositId,
              txHash: btcTx.txHash,
              confirmations: btcTx.confirmations,
            }, 'Deposit confirmed');
          } else {
            logger.debug({
              depositId,
              confirmations: btcTx.confirmations,
              required: this.config.requiredConfirmations,
            }, 'Waiting for confirmations');
          }
        }
      }
    }
  }

  /**
   * Process confirmed deposits by triggering wBTC minting
   */
  private async processConfirmedDeposits(): Promise<void> {
    for (const [depositId, deposit] of this.pendingDeposits) {
      if (deposit.status === DepositStatus.Confirmed && deposit.btcTxHash) {
        try {
          await this.claimDeposit(depositId, deposit);
        } catch (error) {
          logger.error({ error, depositId }, 'Failed to claim deposit');
        }
      }
    }
  }

  /**
   * Claim a confirmed deposit to mint wBTC
   */
  private async claimDeposit(
    depositId: string,
    deposit: BridgeDepositStatus
  ): Promise<void> {
    if (!this.atomiqAdapter || !deposit.btcTxHash) {
      return;
    }

    logger.info({ depositId, btcTxHash: deposit.btcTxHash }, 'Claiming deposit');

    try {
      // Convert BTC tx hash to u256
      const btcTxHashU256 = BigInt('0x' + deposit.btcTxHash);

      // In production, get the actual merkle proof from Atomiq's BTC relay
      // For now, we use an empty proof (testing mode)
      const merkleProof: bigint[] = [];

      const calls: Call[] = [
        {
          contractAddress: this.atomiqAdapter.address,
          entrypoint: 'claim_deposit',
          calldata: [
            depositId,
            btcTxHashU256.toString(),
            merkleProof.length.toString(),
            ...merkleProof.map((p) => p.toString()),
          ],
        },
      ];

      const txHash = await executeTransaction(calls);

      deposit.status = DepositStatus.Claimed;
      logger.info({ depositId, txHash }, 'Deposit claimed successfully');

      // Remove from pending
      this.pendingDeposits.delete(depositId);
    } catch (error) {
      logger.error({ error, depositId }, 'Failed to claim deposit');
      throw error;
    }
  }

  /**
   * Check Bitcoin blockchain for deposit to address
   * In production, this would query a Bitcoin node or Atomiq's API
   */
  private async checkBtcDeposit(
    btcAddressHash: string
  ): Promise<BtcTransaction | null> {
    // In production, this would:
    // 1. Query Atomiq API for deposits to the address
    // 2. Or query a Bitcoin node/indexer directly
    // 3. Return transaction details if found

    // For testing, we simulate no transaction found
    // Users would need to actually send BTC to trigger the bridge
    return null;
  }

  /**
   * Generate BTC address hash from user address and deposit ID
   */
  private generateBtcAddressHash(
    starknetAddress: string,
    depositId: bigint
  ): string {
    // Simple hash for demo - in production use proper key derivation
    const combined = starknetAddress + depositId.toString();
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Convert hash to testnet BTC address (simplified)
   */
  private hashToBtcAddress(hash: string): string {
    // This is a placeholder - in production, Atomiq would provide
    // the actual BTC deposit address
    const shortHash = hash.slice(2, 34);
    return `tb1q${shortHash}`; // Testnet bech32 format
  }

  /**
   * Get deposit status by ID
   */
  async getDepositStatus(depositId: string): Promise<BridgeDepositStatus | null> {
    return this.pendingDeposits.get(depositId) || null;
  }

  /**
   * Get all pending deposits for a user
   */
  async getUserDeposits(starknetAddress: string): Promise<BridgeDepositStatus[]> {
    const deposits: BridgeDepositStatus[] = [];
    for (const deposit of this.pendingDeposits.values()) {
      if (deposit.user === starknetAddress) {
        deposits.push(deposit);
      }
    }
    return deposits;
  }

  /**
   * Get bridge statistics
   */
  getStats(): {
    pendingDeposits: number;
    confirmedDeposits: number;
    totalValuePending: bigint;
  } {
    let pendingCount = 0;
    let confirmedCount = 0;
    let totalValue = 0n;

    for (const deposit of this.pendingDeposits.values()) {
      if (deposit.status === DepositStatus.Pending) {
        pendingCount++;
        totalValue += deposit.amountSats;
      } else if (deposit.status === DepositStatus.Confirmed) {
        confirmedCount++;
      }
    }

    return {
      pendingDeposits: pendingCount,
      confirmedDeposits: confirmedCount,
      totalValuePending: totalValue,
    };
  }
}

// Default configuration
export const DEFAULT_ATOMIQ_CONFIG: AtomiqBridgeConfig = {
  enabled: process.env.ATOMIQ_BRIDGE_ENABLED === 'true',
  pollIntervalMs: parseInt(process.env.ATOMIQ_POLL_INTERVAL || '60000'),
  requiredConfirmations: parseInt(process.env.ATOMIQ_CONFIRMATIONS || '3'),
  atomiqApiUrl: process.env.ATOMIQ_API_URL || 'https://api.atomiq.exchange',
  atomiqApiKey: process.env.ATOMIQ_API_KEY,
  alertWebhook: process.env.ALERT_WEBHOOK,
};

// Singleton instance
let bridgeServiceInstance: AtomiqBridgeService | null = null;

/**
 * Get or create the bridge service instance
 */
export function getBridgeService(
  config: AtomiqBridgeConfig = DEFAULT_ATOMIQ_CONFIG
): AtomiqBridgeService {
  if (!bridgeServiceInstance) {
    bridgeServiceInstance = new AtomiqBridgeService(config);
  }
  return bridgeServiceInstance;
}
