/**
 * Bridge API Service
 *
 * Client for the BTC ↔ wBTC bridge backend API.
 * Handles deposit requests, status polling, and withdrawal operations.
 */

import { BRIDGE } from '../constants';
import type {
  BridgeDepositRequest,
  BridgeDepositResponse,
  BridgeDeposit,
  BridgeDepositStatus,
  BridgeStats,
  BridgeWithdrawalRequest,
  BridgeWithdrawalResponse,
} from '../types';

// ============ API Response Types ============

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface DepositResponseData {
  depositId: string;
  btcAddress: string;
  amountSats: number;
  expiresAt: number;
  requiredConfirmations: number;
  explorerUrl: string;
}

interface DepositStatusData {
  depositId: string;
  user: string;
  amountSats: number;
  btcAddress: string;
  status: string;
  statusCode: number;
  btcTxHash: string | null;
  confirmations: number;
  requiredConfirmations: number;
  createdAt: number;
  expiresAt: number;
  explorerUrl: string | null;
}

interface UserDepositsData {
  deposits: DepositStatusData[];
  count: number;
}

interface StatsData {
  pendingDeposits: number;
  confirmedDeposits: number;
  totalValuePending: number;
  config: {
    requiredConfirmations: number;
    minDepositSats: number;
    maxDepositSats: number;
    depositExpirySeconds: number;
    bitcoinNetwork: string;
  };
}

interface HealthData {
  status: string;
  bitcoinNetwork: string;
  bitcoinBlockHeight: number;
  timestamp: number;
}

// ============ Bridge API Service ============

class BridgeApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = BRIDGE.API_URL;
  }

  /**
   * Set the API base URL (useful for testing or different environments)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Make an API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'API request failed');
    }

    return data.data as T;
  }

  /**
   * Check API health
   */
  async checkHealth(): Promise<HealthData> {
    return this.request<HealthData>('/health');
  }

  /**
   * Request a new deposit address
   */
  async requestDeposit(request: BridgeDepositRequest): Promise<BridgeDepositResponse> {
    const data = await this.request<DepositResponseData>('/deposit', {
      method: 'POST',
      body: JSON.stringify({
        starknetAddress: request.starknetAddress,
        amountSats: request.amountSats,
      }),
    });

    return {
      depositId: data.depositId,
      btcAddress: data.btcAddress,
      btcAddressHash: '', // Not needed on frontend
      amountSats: data.amountSats,
      expiresAt: data.expiresAt,
    };
  }

  /**
   * Get deposit status by ID
   */
  async getDepositStatus(depositId: string): Promise<BridgeDeposit> {
    const data = await this.request<DepositStatusData>(`/deposit/${depositId}`);

    return {
      depositId: data.depositId,
      user: data.user,
      amountSats: data.amountSats,
      btcAddress: data.btcAddress,
      btcAddressHash: '',
      status: data.statusCode as BridgeDepositStatus,
      btcTxHash: data.btcTxHash || undefined,
      confirmations: data.confirmations,
      requiredConfirmations: data.requiredConfirmations,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
    };
  }

  /**
   * Get all deposits for a user
   */
  async getUserDeposits(starknetAddress: string): Promise<BridgeDeposit[]> {
    const data = await this.request<UserDepositsData>(`/user/${starknetAddress}`);

    return data.deposits.map((d) => ({
      depositId: d.depositId,
      user: d.user,
      amountSats: d.amountSats,
      btcAddress: d.btcAddress,
      btcAddressHash: '',
      status: d.statusCode as BridgeDepositStatus,
      btcTxHash: d.btcTxHash || undefined,
      confirmations: d.confirmations,
      requiredConfirmations: d.requiredConfirmations,
      createdAt: d.createdAt,
      expiresAt: d.expiresAt,
    }));
  }

  /**
   * Get bridge statistics
   */
  async getStats(): Promise<BridgeStats> {
    const data = await this.request<StatsData>('/stats');

    return {
      pendingDeposits: data.pendingDeposits,
      confirmedDeposits: data.confirmedDeposits,
      totalValuePendingSats: data.totalValuePending,
      pendingWithdrawals: 0, // Not yet implemented
      processingWithdrawals: 0,
    };
  }

  /**
   * Poll deposit status until it reaches a terminal state or timeout
   */
  async pollDepositStatus(
    depositId: string,
    options: {
      onUpdate?: (deposit: BridgeDeposit) => void;
      intervalMs?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<BridgeDeposit> {
    const {
      onUpdate,
      intervalMs = BRIDGE.STATUS_POLL_INTERVAL,
      timeoutMs = BRIDGE.DEPOSIT_EXPIRY_HOURS * 60 * 60 * 1000,
    } = options;

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          // Check timeout
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error('Polling timeout'));
            return;
          }

          const deposit = await this.getDepositStatus(depositId);

          // Notify of update
          if (onUpdate) {
            onUpdate(deposit);
          }

          // Check if terminal state
          if (
            deposit.status === BridgeDepositStatus.Claimed ||
            deposit.status === BridgeDepositStatus.Expired
          ) {
            resolve(deposit);
            return;
          }

          // Continue polling
          setTimeout(poll, intervalMs);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }
}

// Export singleton instance
export const bridgeApi = new BridgeApiService();

// Export class for testing
export { BridgeApiService };
