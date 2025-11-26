/**
 * Connect Wallet Screen
 *
 * Allows users to connect Starknet and BTC wallets.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS } from '../constants';
import { useWallet } from '../hooks';

interface Props {
  onConnected?: () => void;
}

export function ConnectWallet({ onConnected }: Props) {
  const {
    starknetAddress,
    btcAddress,
    isStarknetConnected,
    isBtcConnected,
    isConnecting,
    error,
    connectStarknet,
    connectBtc,
    disconnectAll,
  } = useWallet();

  const handleConnectStarknet = async () => {
    try {
      await connectStarknet();
      if (onConnected) onConnected();
    } catch (err) {
      Alert.alert('Connection Failed', 'Could not connect to Starknet wallet');
    }
  };

  const handleConnectBtc = async () => {
    try {
      const result = await connectBtc();
      if (result && result.btcPaymentAddress?.address) {
        Alert.alert('BTC Connected', `Connected to ${result.btcPaymentAddress.address.slice(0, 12)}...`);
      }
    } catch (err) {
      Alert.alert('Connection Failed', 'Could not connect to Xverse wallet');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>BTCUSD</Text>
        <Text style={styles.subtitle}>Connect Your Wallets</Text>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Two Wallets, One Protocol</Text>
        <Text style={styles.infoText}>
          Connect your Starknet wallet to manage your position, and optionally connect
          Xverse to bridge BTC directly.
        </Text>
      </View>

      {/* Wallet Options */}
      <View style={styles.walletSection}>
        {/* Starknet Wallet */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <View style={styles.walletIcon}>
              <Text style={styles.walletIconText}>SN</Text>
            </View>
            <View style={styles.walletInfo}>
              <Text style={styles.walletName}>Starknet Wallet</Text>
              <Text style={styles.walletDescription}>
                {isStarknetConnected
                  ? `Connected: ${starknetAddress?.slice(0, 10)}...`
                  : 'ArgentX, Braavos, or any Starknet wallet'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.connectBtn,
              isStarknetConnected && styles.connectedBtn,
            ]}
            onPress={handleConnectStarknet}
            disabled={isConnecting || isStarknetConnected}
          >
            {isConnecting ? (
              <ActivityIndicator color={COLORS.text} size="small" />
            ) : (
              <Text style={styles.connectBtnText}>
                {isStarknetConnected ? 'Connected' : 'Connect'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* BTC Wallet */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <View style={[styles.walletIcon, styles.btcIcon]}>
              <Text style={styles.walletIconText}>BTC</Text>
            </View>
            <View style={styles.walletInfo}>
              <Text style={styles.walletName}>Bitcoin Wallet</Text>
              <Text style={styles.walletDescription}>
                {isBtcConnected
                  ? `Connected: ${btcAddress?.slice(0, 10)}...`
                  : 'Xverse wallet for BTC bridging (optional)'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.connectBtn,
              styles.btcConnectBtn,
              isBtcConnected && styles.connectedBtn,
            ]}
            onPress={handleConnectBtc}
            disabled={isConnecting || isBtcConnected}
          >
            {isConnecting ? (
              <ActivityIndicator color={COLORS.text} size="small" />
            ) : (
              <Text style={styles.connectBtnText}>
                {isBtcConnected ? 'Connected' : 'Connect'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Status Summary */}
      {(isStarknetConnected || isBtcConnected) && (
        <View style={styles.statusSection}>
          <Text style={styles.statusTitle}>Connection Status</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isStarknetConnected ? styles.statusActive : styles.statusInactive,
              ]}
            />
            <Text style={styles.statusText}>Starknet</Text>
          </View>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isBtcConnected ? styles.statusActive : styles.statusInactive,
              ]}
            />
            <Text style={styles.statusText}>Bitcoin</Text>
          </View>

          <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectAll}>
            <Text style={styles.disconnectBtnText}>Disconnect All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your keys, your coins. We never store your private keys.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  infoSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  walletSection: {
    gap: 16,
    marginBottom: 24,
  },
  walletCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  btcIcon: {
    backgroundColor: COLORS.primary,
  },
  walletIconText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  walletDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  connectBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btcConnectBtn: {
    backgroundColor: COLORS.primary,
  },
  connectedBtn: {
    backgroundColor: COLORS.success,
  },
  connectBtnText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: COLORS.danger + '20',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  statusSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusActive: {
    backgroundColor: COLORS.success,
  },
  statusInactive: {
    backgroundColor: COLORS.textSecondary,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 14,
  },
  disconnectBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  disconnectBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});
