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
  Linking,
} from 'react-native';
import { COLORS } from '../constants';
import { useStore } from '../store';
import { useStarknetWallet } from '../hooks';
import { GlassCard, PositionCard, YieldCard, QuickActions } from '../components';
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
    faucet,
    getTxUrl,
  } = useStarknetWallet();

  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | 'wallet' | null>(null);

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

    // Always show wallet modal for better UX
    setActiveModal('wallet');
  };

  const handleWalletSelect = async (connectorId: string) => {
    setActiveModal(null);
    try {
      await connect(connectorId);
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        'Could not connect to wallet. Make sure the extension is installed and unlocked.'
      );
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
          'BTC bridging via Atomiq is coming soon. Use the Faucet button to get test wBTC.',
          [{ text: 'OK' }]
        );
        break;
      case 'faucet':
        handleFaucet();
        break;
      default:
        Alert.alert('Coming Soon', `${actionId} functionality is under development.`);
    }
  };

  const handleFaucet = async () => {
    if (!isConnected) {
      Alert.alert('Connect Wallet', 'Please connect your wallet first');
      return;
    }

    try {
      const result = await faucet();
      Alert.alert(
        'Faucet Success!',
        `1 wBTC is being sent to your wallet.\n\nTransaction: ${result.hash.slice(0, 20)}...`,
        [
          {
            text: 'View Transaction',
            onPress: () => Linking.openURL(getTxUrl(result.hash)),
          },
          {
            text: 'OK',
            onPress: () => refreshAll(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Faucet Failed', 'Could not mint test wBTC. Try again later.');
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
      <GlassCard style={styles.priceBanner} padding="small">
        <View style={styles.priceItem}>
          <Text style={styles.priceLabel}>BTC Price</Text>
          <Text style={styles.priceValue}>{formatPrice(price?.btcPrice ?? null)}</Text>
        </View>
        <View style={styles.priceDivider} />
        <View style={styles.priceItem}>
          <Text style={styles.priceLabel}>Network</Text>
          <View style={styles.networkBadge}>
            <View style={styles.networkDot} />
            <Text style={styles.networkValue}>Sepolia</Text>
          </View>
        </View>
      </GlassCard>

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
        <GlassCard style={styles.infoCard}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <View style={styles.infoStep}>
            <View style={styles.stepNumberContainer}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Deposit wBTC</Text>
              <Text style={styles.stepDescription}>
                Bridge BTC via Atomiq or deposit wBTC as collateral
              </Text>
            </View>
          </View>
          <View style={styles.infoStep}>
            <View style={[styles.stepNumberContainer, { backgroundColor: COLORS.secondary + '20' }]}>
              <Text style={[styles.stepNumber, { color: COLORS.secondary }]}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Mint BTCUSD</Text>
              <Text style={styles.stepDescription}>
                Borrow up to 66.67% of your collateral value
              </Text>
            </View>
          </View>
          <View style={[styles.infoStep, { marginBottom: 0 }]}>
            <View style={[styles.stepNumberContainer, { backgroundColor: COLORS.accent + '20' }]}>
              <Text style={[styles.stepNumber, { color: COLORS.accent }]}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Earn Yield</Text>
              <Text style={styles.stepDescription}>
                Your collateral earns yield through Vesu lending
              </Text>
            </View>
          </View>
        </GlassCard>

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

      {/* Wallet Selection Modal */}
      <Modal
        visible={activeModal === 'wallet'}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.walletModalOverlay}>
          <View style={styles.walletModal}>
            <Text style={styles.walletModalTitle}>Connect Wallet</Text>
            <Text style={styles.walletModalSubtitle}>
              Choose a wallet to connect to BTCUSD Protocol
            </Text>

            {/* ArgentX */}
            <TouchableOpacity
              style={styles.walletOption}
              onPress={() => handleWalletSelect('argentX')}
            >
              <View style={styles.walletIconPlaceholder}>
                <Text style={styles.walletIconText}>A</Text>
              </View>
              <View style={styles.walletInfo}>
                <Text style={styles.walletName}>ArgentX</Text>
                <Text style={styles.walletDesc}>Most popular Starknet wallet</Text>
              </View>
            </TouchableOpacity>

            {/* Braavos */}
            <TouchableOpacity
              style={styles.walletOption}
              onPress={() => handleWalletSelect('braavos')}
            >
              <View style={[styles.walletIconPlaceholder, { backgroundColor: '#FF6B35' }]}>
                <Text style={styles.walletIconText}>B</Text>
              </View>
              <View style={styles.walletInfo}>
                <Text style={styles.walletName}>Braavos</Text>
                <Text style={styles.walletDesc}>Smart wallet with hardware signer</Text>
              </View>
            </TouchableOpacity>

            {/* Install Links */}
            <View style={styles.installSection}>
              <Text style={styles.installTitle}>Don't have a wallet?</Text>
              <View style={styles.installLinks}>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://www.argent.xyz/argent-x/')}
                >
                  <Text style={styles.installLink}>Install ArgentX</Text>
                </TouchableOpacity>
                <Text style={styles.installDivider}>|</Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://braavos.app/')}
                >
                  <Text style={styles.installLink}>Install Braavos</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.walletCloseBtn}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.walletCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  connectButton: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    minWidth: 110,
    alignItems: 'center',
  },
  connectedButton: {
    backgroundColor: COLORS.secondary + '15',
    borderColor: COLORS.secondary + '40',
  },
  connectButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  priceBanner: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  priceItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    marginRight: 6,
  },
  networkValue: {
    color: COLORS.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  priceDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoCard: {
    marginBottom: 16,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumberContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepNumber: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  // Wallet Modal Styles
  walletModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 7, 3, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  walletModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  walletModalTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  walletModalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
  },
  walletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  walletIconPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  walletIconText: {
    color: COLORS.background,
    fontSize: 24,
    fontWeight: '700',
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  walletDesc: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  installSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  installTitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 10,
  },
  installLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  installLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  installDivider: {
    color: COLORS.textMuted,
    marginHorizontal: 12,
  },
  walletCloseBtn: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  walletCloseBtnText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
