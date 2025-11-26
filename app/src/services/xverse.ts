/**
 * Xverse Wallet Integration via Sats Connect
 *
 * Provides Bitcoin wallet connectivity for the BTCUSD Protocol.
 * Uses sats-connect library to connect to Xverse and other Bitcoin wallets.
 *
 * @see https://docs.xverse.app/sats-connect
 */

import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// Types for Sats Connect (we'll use dynamic import for the library)
export enum AddressPurpose {
  Payment = 'payment',
  Ordinals = 'ordinals',
  Stacks = 'stacks',
  Starknet = 'starknet',
}

export interface BitcoinAddress {
  address: string;
  publicKey: string;
  purpose: AddressPurpose;
  addressType?: 'p2wpkh' | 'p2tr' | 'p2sh' | 'p2pkh';
}

export interface StarknetAddress {
  address: string;
  publicKey: string;
}

export interface WalletConnection {
  btcPaymentAddress?: BitcoinAddress;
  btcOrdinalsAddress?: BitcoinAddress;
  starknetAddress?: StarknetAddress;
  isConnected: boolean;
}

export interface SendBtcParams {
  recipient: string;
  amountSats: number;
  message?: string;
}

export interface SendBtcResult {
  txId: string;
}

// Deep link URL for Xverse mobile app
const XVERSE_DEEP_LINK = 'xverse://';
const XVERSE_CONNECT_URL = 'https://connect.xverse.app/browser';

/**
 * XverseWallet - Service for Xverse/Sats Connect wallet integration
 */
class XverseWalletService {
  private satsConnect: typeof import('sats-connect') | null = null;
  private connection: WalletConnection = { isConnected: false };

  /**
   * Initialize sats-connect library (lazy load for React Native compatibility)
   */
  private async loadSatsConnect() {
    if (!this.satsConnect) {
      try {
        // Dynamic import for React Native compatibility
        this.satsConnect = await import('sats-connect');
      } catch (error) {
        console.warn('sats-connect not available, using deep links only');
        return null;
      }
    }
    return this.satsConnect;
  }

  /**
   * Check if Xverse wallet is available
   * On mobile, we always use deep links instead of browser extension detection
   */
  isAvailable(): boolean {
    // On mobile, we always allow connection via deep link
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      return true;
    }
    // On web, check if Xverse extension is installed
    if (typeof window !== 'undefined') {
      return !!(window as any).XverseProviders?.BitcoinProvider;
    }
    return false;
  }

  /**
   * Open Xverse wallet app via deep link
   * Used on mobile to trigger wallet connection
   */
  async openXverseApp(returnUrl?: string): Promise<void> {
    const deepLink = returnUrl
      ? `${XVERSE_CONNECT_URL}?url=${encodeURIComponent(returnUrl)}`
      : XVERSE_DEEP_LINK;

    const canOpen = await Linking.canOpenURL(deepLink);
    if (canOpen) {
      await Linking.openURL(deepLink);
    } else {
      // Redirect to app store if Xverse not installed
      const storeUrl = Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/xverse-bitcoin-web3-wallet/id1552272513'
        : 'https://play.google.com/store/apps/details?id=com.xverse.wallet';
      await Linking.openURL(storeUrl);
    }
  }

  /**
   * Connect to Xverse wallet and get addresses
   * Returns both Bitcoin (payment & ordinals) and Starknet addresses if available
   */
  async connect(): Promise<WalletConnection> {
    const satsConnect = await this.loadSatsConnect();

    if (!satsConnect) {
      // On mobile without sats-connect, use deep link flow
      await this.openXverseApp();
      return { isConnected: false };
    }

    try {
      const response = await satsConnect.request('getAccounts', {
        purposes: [
          AddressPurpose.Payment,
          AddressPurpose.Ordinals,
          AddressPurpose.Starknet,
        ],
        message: 'BTCUSD Protocol wants to connect to your wallet',
      });

      if (response.status === 'success' && response.result) {
        const accounts = response.result;

        // Extract addresses by purpose
        const paymentAccount = accounts.find(
          (acc: any) => acc.purpose === AddressPurpose.Payment
        );
        const ordinalsAccount = accounts.find(
          (acc: any) => acc.purpose === AddressPurpose.Ordinals
        );
        const starknetAccount = accounts.find(
          (acc: any) => acc.purpose === AddressPurpose.Starknet
        );

        this.connection = {
          btcPaymentAddress: paymentAccount ? {
            address: paymentAccount.address,
            publicKey: paymentAccount.publicKey,
            purpose: AddressPurpose.Payment,
            addressType: paymentAccount.addressType,
          } : undefined,
          btcOrdinalsAddress: ordinalsAccount ? {
            address: ordinalsAccount.address,
            publicKey: ordinalsAccount.publicKey,
            purpose: AddressPurpose.Ordinals,
            addressType: ordinalsAccount.addressType,
          } : undefined,
          starknetAddress: starknetAccount ? {
            address: starknetAccount.address,
            publicKey: starknetAccount.publicKey,
          } : undefined,
          isConnected: true,
        };

        return this.connection;
      }

      throw new Error('Failed to connect to wallet');
    } catch (error) {
      console.error('Xverse connect error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    const satsConnect = await this.loadSatsConnect();

    if (satsConnect?.Wallet?.disconnect) {
      await satsConnect.Wallet.disconnect();
    }

    this.connection = { isConnected: false };
  }

  /**
   * Get current connection state
   */
  getConnection(): WalletConnection {
    return this.connection;
  }

  /**
   * Send BTC to a recipient address
   * Used for bridging BTC to wBTC via Atomiq
   */
  async sendBtc(params: SendBtcParams): Promise<SendBtcResult> {
    const satsConnect = await this.loadSatsConnect();

    if (!satsConnect) {
      throw new Error('sats-connect not available. Please use Xverse app directly.');
    }

    if (!this.connection.isConnected || !this.connection.btcPaymentAddress) {
      throw new Error('Wallet not connected. Please connect first.');
    }

    try {
      const response = await satsConnect.request('sendTransfer', {
        recipients: [
          {
            address: params.recipient,
            amount: params.amountSats,
          },
        ],
        message: params.message || 'BTCUSD Protocol - Bridge to wBTC',
      });

      if (response.status === 'success' && response.result?.txid) {
        return { txId: response.result.txid };
      }

      throw new Error('Transaction failed or was rejected');
    } catch (error) {
      console.error('Send BTC error:', error);
      throw error;
    }
  }

  /**
   * Sign a message for authentication
   */
  async signMessage(message: string): Promise<string> {
    const satsConnect = await this.loadSatsConnect();

    if (!satsConnect) {
      throw new Error('sats-connect not available');
    }

    if (!this.connection.isConnected || !this.connection.btcPaymentAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      const response = await satsConnect.request('signMessage', {
        address: this.connection.btcPaymentAddress.address,
        message,
      });

      if (response.status === 'success' && response.result?.signature) {
        return response.result.signature;
      }

      throw new Error('Message signing failed');
    } catch (error) {
      console.error('Sign message error:', error);
      throw error;
    }
  }

  /**
   * Get Starknet address from connected wallet
   * Returns null if Starknet is not available in the wallet
   */
  getStarknetAddress(): string | null {
    return this.connection.starknetAddress?.address || null;
  }

  /**
   * Get Bitcoin payment address from connected wallet
   */
  getBtcAddress(): string | null {
    return this.connection.btcPaymentAddress?.address || null;
  }

  /**
   * Generate a deep link URL to open Xverse with our app
   * Used for mobile-to-wallet communication
   */
  generateDeepLink(action: 'connect' | 'send', params?: Record<string, string>): string {
    const baseUrl = 'xverse://';
    const queryParams = params
      ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      : '';

    return `${baseUrl}${action}${queryParams}`;
  }

  /**
   * Format satoshis to BTC for display
   */
  static satsToBtc(sats: number): string {
    return (sats / 100_000_000).toFixed(8);
  }

  /**
   * Format BTC to satoshis
   */
  static btcToSats(btc: number): number {
    return Math.round(btc * 100_000_000);
  }
}

// Export singleton instance
export const xverseWallet = new XverseWalletService();

// Export types and class for direct use
export { XverseWalletService };
