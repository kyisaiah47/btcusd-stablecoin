/**
 * Dashboard Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { COLORS } from '../constants';
import { useStore } from '../store';
import { PositionCard, YieldCard, QuickActions } from '../components';

export function Dashboard() {
  const { wallet, position, yieldInfo, price, isLoading, refreshAll, setWallet } = useStore();

  const formatPrice = (value: bigint | null) => {
    if (!value) return '$--,---';
    return `$${(Number(value) / 1e8).toLocaleString()}`;
  };

  const handleConnect = () => {
    // Demo: simulate wallet connection
    setWallet({
      address: '0x123...abc',
      isConnected: true,
      chainId: 'SN_SEPOLIA',
    });
  };

  const handleAction = (actionId: string) => {
    Alert.alert(
      `${actionId.charAt(0).toUpperCase() + actionId.slice(1)}`,
      'This feature will be available once contracts are deployed to testnet.',
      [{ text: 'OK' }]
    );
  };

  const handleHarvest = () => {
    Alert.alert(
      'Harvest Yield',
      'This feature will be available once contracts are deployed to testnet.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>BTCUSD</Text>
          <Text style={styles.subtitle}>Bitcoin-Backed Stablecoin</Text>
        </View>
        <TouchableOpacity
          style={styles.connectButton}
          onPress={wallet.isConnected ? undefined : handleConnect}
        >
          <Text style={styles.connectButtonText}>
            {wallet.isConnected ? wallet.address?.slice(0, 8) + '...' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Price Banner */}
      <View style={styles.priceBanner}>
        <View style={styles.priceItem}>
          <Text style={styles.priceLabel}>BTC Price</Text>
          <Text style={styles.priceValue}>{formatPrice(price?.btcPrice ?? null)}</Text>
        </View>
        <View style={styles.priceDivider} />
        <View style={styles.priceItem}>
          <Text style={styles.priceLabel}>Network</Text>
          <Text style={styles.networkValue}>Sepolia</Text>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refreshAll} tintColor={COLORS.primary} />
        }
      >
        {/* Quick Actions */}
        <QuickActions onAction={handleAction} />

        {/* Position Card */}
        <PositionCard position={position} btcPrice={price?.btcPrice ?? null} />

        {/* Yield Card */}
        <YieldCard yieldInfo={yieldInfo} onHarvest={handleHarvest} />

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <View style={styles.infoStep}>
            <Text style={styles.stepNumber}>1</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Deposit wBTC</Text>
              <Text style={styles.stepDescription}>
                Bridge BTC via Atomiq or deposit wBTC as collateral
              </Text>
            </View>
          </View>
          <View style={styles.infoStep}>
            <Text style={styles.stepNumber}>2</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Mint BTCUSD</Text>
              <Text style={styles.stepDescription}>
                Borrow up to 66.67% of your collateral value
              </Text>
            </View>
          </View>
          <View style={styles.infoStep}>
            <Text style={styles.stepNumber}>3</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Earn Yield</Text>
              <Text style={styles.stepDescription}>
                Your collateral earns yield through Vesu lending
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Built for Starknet Re{'{'}Solve{'}'} Hackathon
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  logo: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  connectButton: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  connectButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  priceBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priceItem: {
    flex: 1,
    alignItems: 'center',
  },
  priceLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  priceValue: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  networkValue: {
    color: COLORS.success,
    fontSize: 16,
    fontWeight: '600',
  },
  priceDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoStep: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
    marginRight: 12,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});
