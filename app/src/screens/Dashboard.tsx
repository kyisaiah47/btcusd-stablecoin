/**
 * Dashboard Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants';
import { useStore } from '../store';
import { useStarknetWallet } from '../hooks';
import { PositionCard, YieldCard, QuickActions } from '../components';
import { Deposit } from './Deposit';
import { Withdraw } from './Withdraw';

export function Dashboard() {
  const { wallet, position, yieldInfo, price, isLoading, refreshAll } = useStore();
  const {
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    availableConnectors,
    harvest,
    getTxUrl,
  } = useStarknetWallet();

  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | null>(null);

  const formatPrice = (value: bigint | null) => {
    if (!value) return '$--,---';
    return `$${(Number(value) / 1e8).toLocaleString()}`;
  };

  const handleConnect = async () => {
    if (isConnected) {
      // Show disconnect option
      Alert.alert(
        'Wallet Connected',
        `Connected to ${address?.slice(0, 10)}...${address?.slice(-6)}`,
        [
          { text: 'Disconnect', onPress: disconnect, style: 'destructive' },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }

    // Show connector options
    if (availableConnectors.length === 0) {
      Alert.alert(
        'No Wallet Found',
        'Please install ArgentX or Braavos wallet extension to connect.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await connect();
    } catch (error) {
      Alert.alert('Connection Failed', 'Could not connect to wallet');
    }
  };

  const handleAction = (actionId: string) => {
    if (!isConnected) {
      Alert.alert('Connect Wallet', 'Please connect your wallet first');
      return;
    }

    switch (actionId) {
      case 'deposit':
        setActiveModal('deposit');
        break;
      case 'withdraw':
        setActiveModal('withdraw');
        break;
      case 'mint':
        // Mint is part of deposit flow
        setActiveModal('deposit');
        break;
      case 'bridge':
        Alert.alert(
          'Bridge BTC',
          'BTC bridging via Atomiq is coming soon. For now, use the MockWBTC faucet on Starkscan.',
          [{ text: 'OK' }]
        );
        break;
      default:
        Alert.alert('Coming Soon', `${actionId} functionality is under development.`);
    }
  };

  const handleHarvest = async () => {
    if (!isConnected) {
      Alert.alert('Connect Wallet', 'Please connect your wallet first');
      return;
    }

    try {
      const result = await harvest();
      Alert.alert(
        'Harvest Submitted',
        `Transaction submitted!\n\nView on Starkscan:\n${getTxUrl(result.hash)}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Harvest Failed', 'Could not harvest yield. Try again later.');
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    refreshAll();
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
          style={[styles.connectButton, isConnected && styles.connectedButton]}
          onPress={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator color={COLORS.text} size="small" />
          ) : (
            <Text style={styles.connectButtonText}>
              {isConnected ? address?.slice(0, 6) + '...' + address?.slice(-4) : 'Connect'}
            </Text>
          )}
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

      {/* Deposit Modal */}
      <Modal
        visible={activeModal === 'deposit'}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <Deposit onBack={closeModal} onSuccess={closeModal} />
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        visible={activeModal === 'withdraw'}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <Withdraw onBack={closeModal} onSuccess={closeModal} />
      </Modal>
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
    minWidth: 100,
    alignItems: 'center',
  },
  connectedButton: {
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
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
