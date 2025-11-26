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

import { Contract, Call, hash } from 'starknet';
import { getProvider, getKeeperAccount, executeTransaction } from './starknet.js';
import { CONTRACTS, BRIDGE_CONFIG } from '../config/index.js';
import { getBitcoinMonitor, type DepositInfo } from './bitcoin-monitor.js';
import * as db from './database.js';
import pino from 'pino';

// Export types from database module for external consumers
// Note: consumers should import directly from database.js
export type { BridgeDeposit, BridgeWithdrawal } from './database.js';

// Local type aliases
type BridgeDeposit = db.BridgeDeposit;
type BridgeWithdrawal = db.BridgeWithdrawal;

// @ts-ignore - pino ESM typing issue
const createLogger = pino.default || pino;
const logger = createLogger({ name: 'atomiq-bridge' });

// Export enum values as constants for convenience
export const BridgeDepositStatus = db.BridgeDepositStatus;
export const BridgeWithdrawalStatus = db.BridgeWithdrawalStatus;

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
  btcAddress: string;
  btcAddressHash: string;
  status: DepositStatus;
  btcTxHash?: string;
  confirmations: number;
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
  private monitoringInterval: NodeJS.Timeout | null = null;
  private dbInitialized: boolean = false;

  constructor(config: AtomiqBridgeConfig) {
    this.config = config;
  }

  /**
   * Initialize database
   */
  private initDb(): void {
    if (!this.dbInitialized) {
      db.initDatabase();
      this.dbInitialized = true;
      logger.info('Database initialized for bridge service');
    }
  }

  /**
   * Initialize the bridge service
   */
  async initialize(): Promise<void> {
    // Initialize database first
    this.initDb();

    const atomiqAdapterAddress = process.env.ATOMIQ_ADAPTER_ADDRESS;
    if (!atomiqAdapterAddress) {
      logger.warn('ATOMIQ_ADAPTER_ADDRESS not set, bridge will operate in API-only mode');
    } else {
      const account = getKeeperAccount();
      this.atomiqAdapter = new Contract(
        ATOMIQ_ADAPTER_ABI as any,
        atomiqAdapterAddress,
        account
      );
      logger.info(`Atomiq Adapter: ${atomiqAdapterAddress}`);
    }

    logger.info('Atomiq Bridge Service initialized');
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
    this.initDb();

    // Validate amount
    const amountSats = Number(request.amountSats);
    if (amountSats < BRIDGE_CONFIG.minDepositSats) {
      throw new Error(`Minimum deposit is ${BRIDGE_CONFIG.minDepositSats} sats`);
    }
    if (amountSats > BRIDGE_CONFIG.maxDepositSats) {
      throw new Error(`Maximum deposit is ${BRIDGE_CONFIG.maxDepositSats} sats`);
    }

    logger.info({
      user: request.starknetAddress,
      amountSats: amountSats.toString(),
    }, 'Requesting deposit address');

    try {
      // Generate unique deposit ID
      const depositId = `dep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Generate BTC address hash (deterministic from user + deposit ID)
      const btcAddressHash = this.generateBtcAddressHash(
        request.starknetAddress,
        BigInt(Date.now())
      );

      // Generate the actual BTC deposit address
      // In production with real Atomiq integration, this would come from Atomiq's service
      // For now, we generate a deterministic testnet address
      const btcAddress = this.generateDepositAddress(request.starknetAddress, BigInt(Date.now()));

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + BRIDGE_CONFIG.depositExpirySeconds;

      // Create deposit record for database
      const deposit: BridgeDeposit = {
        id: depositId,
        starknetAddress: request.starknetAddress,
        btcAddress,
        amountSats,
        status: BridgeDepositStatus.Pending,
        confirmations: 0,
        requiredConfirmations: this.config.requiredConfirmations,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      };

      // Save to database
      db.saveDeposit(deposit);

      logger.info({
        depositId,
        btcAddress,
        expiresAt,
      }, 'Deposit address generated and saved');

      return {
        depositId,
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

    // Get pending deposits from database
    const pendingDeposits = db.getPendingDeposits();

    // Check for expired deposits
    const expiredDeposits = db.getExpiredDeposits();
    for (const deposit of expiredDeposits) {
      deposit.status = BridgeDepositStatus.Expired;
      deposit.updatedAt = now;
      db.updateDeposit(deposit);
      logger.info({ depositId: deposit.id }, 'Deposit expired');
    }

    // Process each pending deposit
    for (const deposit of pendingDeposits) {
      // Check for BTC transaction using the actual BTC address
      if (deposit.status === BridgeDepositStatus.Pending || deposit.status === BridgeDepositStatus.Detected) {
        const btcTx = await this.checkBtcDeposit(deposit.btcAddress, BigInt(deposit.amountSats));

        if (btcTx) {
          deposit.btcTxHash = btcTx.txHash;
          deposit.confirmations = btcTx.confirmations;
          deposit.updatedAt = now;

          if (btcTx.confirmations >= this.config.requiredConfirmations) {
            deposit.status = BridgeDepositStatus.Confirmed;
            logger.info({
              depositId: deposit.id,
              txHash: btcTx.txHash,
              confirmations: btcTx.confirmations,
              amountSats: btcTx.amountSats.toString(),
            }, 'Deposit confirmed');
          } else if (btcTx.confirmations > 0) {
            deposit.status = BridgeDepositStatus.Confirming;
            logger.debug({
              depositId: deposit.id,
              confirmations: btcTx.confirmations,
              required: this.config.requiredConfirmations,
            }, 'Waiting for confirmations');
          } else {
            deposit.status = BridgeDepositStatus.Detected;
          }

          // Update in database
          db.updateDeposit(deposit);
        }
      }
    }
  }

  /**
   * Process confirmed deposits by triggering wBTC minting
   */
  private async processConfirmedDeposits(): Promise<void> {
    // Get confirmed deposits from database
    const pendingDeposits = db.getPendingDeposits();

    for (const deposit of pendingDeposits) {
      if (deposit.status === BridgeDepositStatus.Confirmed && deposit.btcTxHash) {
        try {
          await this.claimDeposit(deposit);
        } catch (error) {
          logger.error({ error, depositId: deposit.id }, 'Failed to claim deposit');
          // Mark as failed in database
          deposit.status = BridgeDepositStatus.Failed;
          deposit.error = error instanceof Error ? error.message : 'Unknown error';
          deposit.updatedAt = Math.floor(Date.now() / 1000);
          db.updateDeposit(deposit);
        }
      }
    }
  }

  /**
   * Claim a confirmed deposit to mint wBTC
   */
  private async claimDeposit(deposit: BridgeDeposit): Promise<void> {
    if (!deposit.btcTxHash) {
      return;
    }

    logger.info({ depositId: deposit.id, btcTxHash: deposit.btcTxHash }, 'Claiming deposit');

    try {
      let starknetTxHash: string | undefined;

      // Only try to execute on-chain if adapter is configured
      if (this.atomiqAdapter) {
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
              deposit.id,
              btcTxHashU256.toString(),
              merkleProof.length.toString(),
              ...merkleProof.map((p) => p.toString()),
            ],
          },
        ];

        starknetTxHash = await executeTransaction(calls);
        logger.info({ depositId: deposit.id, starknetTxHash }, 'On-chain claim executed');
      } else {
        logger.warn({ depositId: deposit.id }, 'No Atomiq adapter configured, marking as claimed without on-chain tx');
      }

      // Update deposit in database
      const now = Math.floor(Date.now() / 1000);
      deposit.status = BridgeDepositStatus.Claimed;
      deposit.starknetTxHash = starknetTxHash;
      deposit.claimedAt = now;
      deposit.updatedAt = now;
      db.updateDeposit(deposit);

      // Update statistics
      db.updateBridgeStats(1, 0, deposit.amountSats);

      logger.info({ depositId: deposit.id, starknetTxHash }, 'Deposit claimed successfully');
    } catch (error) {
      logger.error({ error, depositId: deposit.id }, 'Failed to claim deposit');
      throw error;
    }
  }

  /**
   * Check Bitcoin blockchain for deposit to address
   * Uses Mempool.space API for real Bitcoin monitoring
   */
  private async checkBtcDeposit(
    btcAddress: string,
    expectedAmountSats?: bigint
  ): Promise<BtcTransaction | null> {
    try {
      const bitcoinMonitor = getBitcoinMonitor();
      const depositInfo = await bitcoinMonitor.checkForDeposit(
        btcAddress,
        expectedAmountSats ? Number(expectedAmountSats) : undefined
      );

      if (!depositInfo) {
        return null;
      }

      return {
        txHash: depositInfo.txid,
        outputIndex: 0, // We don't track specific output index
        address: btcAddress,
        amountSats: BigInt(depositInfo.amountSats),
        confirmations: depositInfo.confirmations,
        blockHeight: depositInfo.blockHeight,
      };
    } catch (error) {
      logger.error({ error, btcAddress }, 'Failed to check BTC deposit');
      return null;
    }
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
   * Generate a deposit address for a user
   * In production, this would come from Atomiq's HD wallet derivation
   * For testnet demo, we generate deterministic addresses
   */
  private generateDepositAddress(starknetAddress: string, depositId: bigint): string {
    // Create a deterministic hash from the user address and deposit ID
    const combined = `${starknetAddress}:${depositId.toString()}`;
    const hashBytes = this.simpleHash(combined);

    // For testnet, generate a tb1q (native segwit) style address
    // This is a simplified version - real implementation would use proper HD derivation
    const addressData = hashBytes.slice(0, 20).toString('hex');

    if (BRIDGE_CONFIG.bitcoinNetwork === 'mainnet') {
      return `bc1q${addressData}`;
    } else {
      return `tb1q${addressData}`;
    }
  }

  /**
   * Simple hash function for address generation
   * In production, use proper cryptographic derivation
   */
  private simpleHash(input: string): Buffer {
    let hash = 0n;
    for (let i = 0; i < input.length; i++) {
      const char = BigInt(input.charCodeAt(i));
      hash = ((hash << 5n) - hash + char) & 0xffffffffffffffffn;
    }

    // Convert to bytes and pad to 32 bytes
    const hexStr = hash.toString(16).padStart(64, '0');
    return Buffer.from(hexStr, 'hex');
  }

  /**
   * Convert hash to BTC address (legacy method for compatibility)
   */
  private hashToBtcAddress(hash: string): string {
    const shortHash = hash.slice(2, 42);
    if (BRIDGE_CONFIG.bitcoinNetwork === 'mainnet') {
      return `bc1q${shortHash}`;
    }
    return `tb1q${shortHash}`; // Testnet bech32 format
  }

  /**
   * Get deposit status by ID
   */
  async getDepositStatus(depositId: string): Promise<BridgeDeposit | null> {
    this.initDb();
    return db.getDeposit(depositId);
  }

  /**
   * Get all deposits for a user
   */
  async getUserDeposits(starknetAddress: string): Promise<BridgeDeposit[]> {
    this.initDb();
    return db.getDepositsByStarknetAddress(starknetAddress);
  }

  /**
   * Get bridge statistics
   */
  getStats(): {
    pendingDeposits: number;
    confirmedDeposits: number;
    totalValuePending: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalVolumeSats: number;
  } {
    this.initDb();

    const statusCounts = db.getDepositCountsByStatus();
    const stats = db.getBridgeStats();

    const pendingCount = (statusCounts['pending'] || 0) + (statusCounts['detected'] || 0) + (statusCounts['confirming'] || 0);
    const confirmedCount = statusCounts['confirmed'] || 0;

    // Calculate total pending value
    const pendingDeposits = db.getPendingDeposits();
    let totalPendingValue = 0;
    for (const deposit of pendingDeposits) {
      totalPendingValue += deposit.amountSats;
    }

    return {
      pendingDeposits: pendingCount,
      confirmedDeposits: confirmedCount,
      totalValuePending: totalPendingValue,
      totalDeposits: stats.totalDeposits,
      totalWithdrawals: stats.totalWithdrawals,
      totalVolumeSats: stats.totalVolumeSats,
    };
  }

  /**
   * Get recent deposits
   */
  getRecentDeposits(limit: number = 10): BridgeDeposit[] {
    this.initDb();
    return db.getRecentDeposits(limit);
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
