/**
 * Database Service
 *
 * JSON file-based persistence for bridge deposits and withdrawals.
 * Simple, portable, and doesn't require native dependencies.
 * For production, consider using PostgreSQL or Redis.
 */

import path from 'path';
import fs from 'fs';
import pino from 'pino';

// @ts-ignore - pino ESM typing issue
const createLogger = pino.default || pino;
const logger = createLogger({ name: 'database' });

// Status enums
export enum BridgeDepositStatus {
  Pending = 'pending',
  Detected = 'detected',
  Confirming = 'confirming',
  Confirmed = 'confirmed',
  Claimed = 'claimed',
  Expired = 'expired',
  Failed = 'failed',
}

export enum BridgeWithdrawalStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Refunded = 'refunded',
}

// Bridge deposit record
export interface BridgeDeposit {
  id: string;
  starknetAddress: string;
  btcAddress: string;
  amountSats: number;
  status: BridgeDepositStatus;
  btcTxHash?: string;
  starknetTxHash?: string;
  confirmations: number;
  requiredConfirmations: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  claimedAt?: number;
  error?: string;
}

// Bridge withdrawal record
export interface BridgeWithdrawal {
  id: string;
  starknetAddress: string;
  btcAddress: string;
  amountSats: number;
  feeSats: number;
  status: BridgeWithdrawalStatus;
  starknetTxHash?: string;
  btcTxHash?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}

// Database schema
interface DatabaseSchema {
  deposits: Record<string, BridgeDeposit>;
  withdrawals: Record<string, BridgeWithdrawal>;
  stats: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalVolumeSats: number;
    lastUpdated: number;
  };
}

// Database file path
const DB_DIR = process.env.DATABASE_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'bridge.json');

// In-memory cache
let data: DatabaseSchema = {
  deposits: {},
  withdrawals: {},
  stats: {
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalVolumeSats: 0,
    lastUpdated: Math.floor(Date.now() / 1000),
  },
};

let initialized = false;

/**
 * Initialize the database
 */
export function initDatabase(): void {
  if (initialized) return;

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Load existing data if available
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
      data = JSON.parse(fileContent);
      logger.info({ dbPath: DB_PATH, deposits: Object.keys(data.deposits).length }, 'Database loaded');
    } catch (error) {
      logger.warn({ error }, 'Failed to load database, starting fresh');
    }
  } else {
    logger.info({ dbPath: DB_PATH }, 'Creating new database');
    saveDatabase();
  }

  initialized = true;
}

/**
 * Save database to disk
 */
function saveDatabase(): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error({ error }, 'Failed to save database');
  }
}

/**
 * Close the database (flush to disk)
 */
export function closeDatabase(): void {
  saveDatabase();
  logger.info('Database closed');
}

// ============ Deposit Operations ============

/**
 * Save a new deposit
 */
export function saveDeposit(deposit: BridgeDeposit): void {
  initDatabase();
  data.deposits[deposit.id] = deposit;
  saveDatabase();
  logger.debug({ depositId: deposit.id }, 'Deposit saved');
}

/**
 * Update an existing deposit
 */
export function updateDeposit(deposit: BridgeDeposit): void {
  initDatabase();
  if (data.deposits[deposit.id]) {
    data.deposits[deposit.id] = {
      ...deposit,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    saveDatabase();
  }
}

/**
 * Get a deposit by ID
 */
export function getDeposit(id: string): BridgeDeposit | null {
  initDatabase();
  return data.deposits[id] || null;
}

/**
 * Get a deposit by BTC address
 */
export function getDepositByBtcAddress(btcAddress: string): BridgeDeposit | null {
  initDatabase();
  return Object.values(data.deposits).find(d => d.btcAddress === btcAddress) || null;
}

/**
 * Get all deposits for a Starknet address
 */
export function getDepositsByStarknetAddress(starknetAddress: string): BridgeDeposit[] {
  initDatabase();
  return Object.values(data.deposits)
    .filter(d => d.starknetAddress === starknetAddress)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get all pending deposits (for monitoring)
 */
export function getPendingDeposits(): BridgeDeposit[] {
  initDatabase();
  const pendingStatuses = [
    BridgeDepositStatus.Pending,
    BridgeDepositStatus.Detected,
    BridgeDepositStatus.Confirming,
    BridgeDepositStatus.Confirmed,
  ];
  return Object.values(data.deposits)
    .filter(d => pendingStatuses.includes(d.status))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get expired deposits
 */
export function getExpiredDeposits(): BridgeDeposit[] {
  initDatabase();
  const now = Math.floor(Date.now() / 1000);
  return Object.values(data.deposits)
    .filter(d => d.status === BridgeDepositStatus.Pending && d.expiresAt < now);
}

/**
 * Get recent deposits
 */
export function getRecentDeposits(limit: number = 10): BridgeDeposit[] {
  initDatabase();
  return Object.values(data.deposits)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

// ============ Withdrawal Operations ============

/**
 * Save a new withdrawal
 */
export function saveWithdrawal(withdrawal: BridgeWithdrawal): void {
  initDatabase();
  data.withdrawals[withdrawal.id] = withdrawal;
  saveDatabase();
  logger.debug({ withdrawalId: withdrawal.id }, 'Withdrawal saved');
}

/**
 * Update an existing withdrawal
 */
export function updateWithdrawal(withdrawal: BridgeWithdrawal): void {
  initDatabase();
  if (data.withdrawals[withdrawal.id]) {
    data.withdrawals[withdrawal.id] = {
      ...withdrawal,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    saveDatabase();
  }
}

/**
 * Get a withdrawal by ID
 */
export function getWithdrawal(id: string): BridgeWithdrawal | null {
  initDatabase();
  return data.withdrawals[id] || null;
}

/**
 * Get all withdrawals for a Starknet address
 */
export function getWithdrawalsByStarknetAddress(starknetAddress: string): BridgeWithdrawal[] {
  initDatabase();
  return Object.values(data.withdrawals)
    .filter(w => w.starknetAddress === starknetAddress)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get pending withdrawals
 */
export function getPendingWithdrawals(): BridgeWithdrawal[] {
  initDatabase();
  return Object.values(data.withdrawals)
    .filter(w => w.status === BridgeWithdrawalStatus.Pending || w.status === BridgeWithdrawalStatus.Processing)
    .sort((a, b) => a.createdAt - b.createdAt);
}

// ============ Statistics Operations ============

/**
 * Update bridge statistics
 */
export function updateBridgeStats(depositCount: number, withdrawalCount: number, volumeSats: number): void {
  initDatabase();
  data.stats.totalDeposits += depositCount;
  data.stats.totalWithdrawals += withdrawalCount;
  data.stats.totalVolumeSats += volumeSats;
  data.stats.lastUpdated = Math.floor(Date.now() / 1000);
  saveDatabase();
}

/**
 * Get bridge statistics
 */
export function getBridgeStats(): {
  totalDeposits: number;
  totalWithdrawals: number;
  totalVolumeSats: number;
  lastUpdated: number;
} {
  initDatabase();
  return { ...data.stats };
}

/**
 * Get deposit counts by status
 */
export function getDepositCountsByStatus(): Record<string, number> {
  initDatabase();
  const counts: Record<string, number> = {};
  for (const deposit of Object.values(data.deposits)) {
    counts[deposit.status] = (counts[deposit.status] || 0) + 1;
  }
  return counts;
}
