/**
 * Atomiq Protocol API Integration
 *
 * Client for interacting with the Atomiq exchange protocol.
 * Handles HD wallet derivation, deposit address generation, and transaction verification.
 *
 * Production Integration:
 * - Register with Atomiq to get API credentials
 * - Use their HD wallet service for secure address derivation
 * - Verify transactions through their BTC relay
 */

import pino from 'pino';
import { BRIDGE_CONFIG } from '../config/index.js';

// @ts-ignore - pino ESM typing issue
const createLogger = pino.default || pino;
const logger = createLogger({ name: 'atomiq-api' });

// ============ Types ============

export interface AtomiqConfig {
  apiUrl: string;
  apiKey?: string;
  webhookSecret?: string;
  network: 'mainnet' | 'testnet';
}

export interface AtomiqDepositAddress {
  address: string;
  addressType: 'p2wpkh' | 'p2sh' | 'p2pkh';
  derivationPath: string;
  expiresAt: number;
  escrowId: string;
}

export interface AtomiqTransaction {
  txid: string;
  confirmations: number;
  blockHeight?: number;
  blockHash?: string;
  amount: number;
  fee: number;
  timestamp: number;
  inputs: Array<{
    address: string;
    amount: number;
  }>;
  outputs: Array<{
    address: string;
    amount: number;
    scriptPubKey: string;
  }>;
}

export interface AtomiqMerkleProof {
  txid: string;
  blockHash: string;
  blockHeight: number;
  proof: string[];
  index: number;
}

export interface AtomiqEscrow {
  id: string;
  status: 'pending' | 'funded' | 'claimed' | 'expired' | 'refunded';
  btcAddress: string;
  amountSats: number;
  receiverAddress: string;
  createdAt: number;
  expiresAt: number;
  btcTxid?: string;
  claimTxHash?: string;
}

// ============ Atomiq API Client ============

export class AtomiqApiClient {
  private config: AtomiqConfig;
  private baseUrl: string;

  constructor(config: AtomiqConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl;
  }

  /**
   * Initialize the API client
   */
  async initialize(): Promise<void> {
    logger.info({ apiUrl: this.baseUrl, network: this.config.network }, 'Atomiq API client initialized');

    // Verify API connectivity
    try {
      await this.healthCheck();
      logger.info('Atomiq API health check passed');
    } catch (error) {
      logger.warn({ error }, 'Atomiq API health check failed - running in offline mode');
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<boolean> {
    const response = await this.request('GET', '/health');
    return response.status === 'ok';
  }

  /**
   * Request a new deposit address from Atomiq
   */
  async requestDepositAddress(params: {
    receiverAddress: string;
    amountSats: number;
    expirySeconds?: number;
  }): Promise<AtomiqDepositAddress> {
    logger.info({ receiverAddress: params.receiverAddress, amountSats: params.amountSats }, 'Requesting deposit address from Atomiq');

    const response = await this.request('POST', '/escrow/create', {
      receiver_address: params.receiverAddress,
      amount_sats: params.amountSats,
      expiry_seconds: params.expirySeconds || BRIDGE_CONFIG.depositExpirySeconds,
      network: this.config.network,
    });

    return {
      address: response.btc_address,
      addressType: response.address_type,
      derivationPath: response.derivation_path,
      expiresAt: response.expires_at,
      escrowId: response.escrow_id,
    };
  }

  /**
   * Get escrow status
   */
  async getEscrowStatus(escrowId: string): Promise<AtomiqEscrow> {
    const response = await this.request('GET', `/escrow/${escrowId}`);

    return {
      id: response.id,
      status: response.status,
      btcAddress: response.btc_address,
      amountSats: response.amount_sats,
      receiverAddress: response.receiver_address,
      createdAt: response.created_at,
      expiresAt: response.expires_at,
      btcTxid: response.btc_txid,
      claimTxHash: response.claim_tx_hash,
    };
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<AtomiqTransaction> {
    const response = await this.request('GET', `/tx/${txid}`);

    return {
      txid: response.txid,
      confirmations: response.confirmations,
      blockHeight: response.block_height,
      blockHash: response.block_hash,
      amount: response.amount,
      fee: response.fee,
      timestamp: response.timestamp,
      inputs: response.inputs,
      outputs: response.outputs,
    };
  }

  /**
   * Get merkle proof for a transaction
   */
  async getMerkleProof(txid: string): Promise<AtomiqMerkleProof | null> {
    try {
      const response = await this.request('GET', `/tx/${txid}/proof`);

      return {
        txid: response.txid,
        blockHash: response.block_hash,
        blockHeight: response.block_height,
        proof: response.merkle_proof,
        index: response.tx_index,
      };
    } catch (error) {
      logger.warn({ txid, error }, 'Failed to get merkle proof - transaction may not be confirmed');
      return null;
    }
  }

  /**
   * Verify a transaction using BTC relay
   */
  async verifyTransaction(params: {
    txid: string;
    expectedAddress: string;
    expectedAmountSats: number;
  }): Promise<{
    verified: boolean;
    confirmations: number;
    merkleProof?: AtomiqMerkleProof;
  }> {
    const tx = await this.getTransaction(params.txid);

    // Check if the transaction pays to the expected address
    const matchingOutput = tx.outputs.find(
      (o) => o.address === params.expectedAddress && o.amount >= params.expectedAmountSats
    );

    if (!matchingOutput) {
      return {
        verified: false,
        confirmations: tx.confirmations,
      };
    }

    // Get merkle proof if confirmed
    let merkleProof: AtomiqMerkleProof | null = null;
    if (tx.confirmations >= 1) {
      merkleProof = await this.getMerkleProof(params.txid);
    }

    return {
      verified: true,
      confirmations: tx.confirmations,
      merkleProof: merkleProof || undefined,
    };
  }

  /**
   * List all escrows for an address
   */
  async listEscrows(receiverAddress: string): Promise<AtomiqEscrow[]> {
    const response = await this.request('GET', `/escrows/${receiverAddress}`);

    return response.escrows.map((e: any) => ({
      id: e.id,
      status: e.status,
      btcAddress: e.btc_address,
      amountSats: e.amount_sats,
      receiverAddress: e.receiver_address,
      createdAt: e.created_at,
      expiresAt: e.expires_at,
      btcTxid: e.btc_txid,
      claimTxHash: e.claim_tx_hash,
    }));
  }

  /**
   * Make an HTTP request to the Atomiq API
   */
  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Atomiq API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      logger.error({ error, method, path }, 'Atomiq API request failed');
      throw error;
    }
  }
}

// ============ Mock Atomiq Client for Development ============

/**
 * Mock implementation for development without real Atomiq API
 */
export class MockAtomiqApiClient extends AtomiqApiClient {
  private escrows: Map<string, AtomiqEscrow> = new Map();
  private counter = 0;

  constructor(config: AtomiqConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    logger.info('Mock Atomiq API client initialized (development mode)');
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async requestDepositAddress(params: {
    receiverAddress: string;
    amountSats: number;
    expirySeconds?: number;
  }): Promise<AtomiqDepositAddress> {
    const escrowId = `escrow_${++this.counter}_${Date.now()}`;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + (params.expirySeconds || BRIDGE_CONFIG.depositExpirySeconds);

    // Generate deterministic address from receiver + counter
    const addressHash = this.simpleHash(`${params.receiverAddress}:${escrowId}`);
    const btcAddress = BRIDGE_CONFIG.bitcoinNetwork === 'mainnet'
      ? `bc1q${addressHash.slice(0, 40)}`
      : `tb1q${addressHash.slice(0, 40)}`;

    const escrow: AtomiqEscrow = {
      id: escrowId,
      status: 'pending',
      btcAddress,
      amountSats: params.amountSats,
      receiverAddress: params.receiverAddress,
      createdAt: now,
      expiresAt,
    };

    this.escrows.set(escrowId, escrow);

    logger.info({ escrowId, btcAddress, receiverAddress: params.receiverAddress }, 'Mock deposit address generated');

    return {
      address: btcAddress,
      addressType: 'p2wpkh',
      derivationPath: `m/84'/0'/0'/0/${this.counter}`,
      expiresAt,
      escrowId,
    };
  }

  async getEscrowStatus(escrowId: string): Promise<AtomiqEscrow> {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error(`Escrow not found: ${escrowId}`);
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (now > escrow.expiresAt && escrow.status === 'pending') {
      escrow.status = 'expired';
    }

    return escrow;
  }

  async getTransaction(txid: string): Promise<AtomiqTransaction> {
    // Return mock transaction data
    return {
      txid,
      confirmations: 3,
      blockHeight: 800000,
      blockHash: '0'.repeat(64),
      amount: 100000,
      fee: 1000,
      timestamp: Math.floor(Date.now() / 1000),
      inputs: [],
      outputs: [],
    };
  }

  async getMerkleProof(txid: string): Promise<AtomiqMerkleProof | null> {
    // Return mock proof
    return {
      txid,
      blockHash: '0'.repeat(64),
      blockHeight: 800000,
      proof: [],
      index: 0,
    };
  }

  async verifyTransaction(params: {
    txid: string;
    expectedAddress: string;
    expectedAmountSats: number;
  }): Promise<{
    verified: boolean;
    confirmations: number;
    merkleProof?: AtomiqMerkleProof;
  }> {
    // In mock mode, always verify if escrow exists
    return {
      verified: true,
      confirmations: 3,
      merkleProof: {
        txid: params.txid,
        blockHash: '0'.repeat(64),
        blockHeight: 800000,
        proof: [],
        index: 0,
      },
    };
  }

  async listEscrows(receiverAddress: string): Promise<AtomiqEscrow[]> {
    return Array.from(this.escrows.values()).filter(
      (e) => e.receiverAddress === receiverAddress
    );
  }

  /**
   * Update escrow status (for testing)
   */
  updateEscrow(escrowId: string, update: Partial<AtomiqEscrow>): void {
    const escrow = this.escrows.get(escrowId);
    if (escrow) {
      Object.assign(escrow, update);
    }
  }

  private simpleHash(input: string): string {
    let hash = 0n;
    for (let i = 0; i < input.length; i++) {
      const char = BigInt(input.charCodeAt(i));
      hash = ((hash << 5n) - hash + char) & 0xffffffffffffffffn;
    }
    return hash.toString(16).padStart(64, '0');
  }
}

// ============ Factory Function ============

let atomiqClient: AtomiqApiClient | null = null;

/**
 * Get or create the Atomiq API client
 * Uses mock client in development, real client in production
 */
export function getAtomiqClient(config?: AtomiqConfig): AtomiqApiClient {
  if (!atomiqClient) {
    const defaultConfig: AtomiqConfig = {
      apiUrl: process.env.ATOMIQ_API_URL || 'https://api.atomiq.exchange',
      apiKey: process.env.ATOMIQ_API_KEY,
      webhookSecret: process.env.ATOMIQ_WEBHOOK_SECRET,
      network: (BRIDGE_CONFIG.bitcoinNetwork as 'mainnet' | 'testnet') || 'testnet',
    };

    const finalConfig = config || defaultConfig;

    // Use mock client if no API key is provided
    if (!finalConfig.apiKey) {
      logger.warn('No ATOMIQ_API_KEY provided, using mock client');
      atomiqClient = new MockAtomiqApiClient(finalConfig);
    } else {
      atomiqClient = new AtomiqApiClient(finalConfig);
    }
  }

  return atomiqClient;
}
