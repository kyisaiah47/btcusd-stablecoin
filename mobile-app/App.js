import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Contract, RpcProvider, Account } from 'starknet';

const { width, height } = Dimensions.get('window');

// Mock contract addresses (replace with actual deployed addresses)
const CONTRACTS = {
  VAULT: '0x123...',
  TOKEN: '0x456...',
  WBTC: '0x789...'
};

export default function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [btcAmount, setBtcAmount] = useState('');
  const [btcusdAmount, setBtcusdAmount] = useState('');
  const [userPosition, setUserPosition] = useState(null);
  const [yieldEarned, setYieldEarned] = useState('0');

  // Initialize Starknet provider
  const provider = new RpcProvider({
    nodeUrl: 'https://starknet-mainnet.public.blastapi.io'
  });

  const connectWallet = async () => {
    try {
      setLoading(true);
      // Mock wallet connection - in production, integrate with Braavos
      setTimeout(() => {
        setWalletConnected(true);
        setAccount({
          address: '0x0123456789abcdef...',
          balance: '0.5'
        });
        setLoading(false);
        loadUserData();
      }, 2000);
    } catch (error) {
      console.error('Wallet connection failed:', error);
      setLoading(false);
    }
  };

  const loadUserData = async () => {
    // Mock user position data
    setUserPosition({
      collateral: '0.15',
      debt: '6500',
      collateralRatio: '165',
      liquidationPrice: '45000'
    });
    setYieldEarned('127.50');
  };

  const depositAndMint = async () => {
    if (!btcAmount || parseFloat(btcAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid BTC amount');
      return;
    }

    setLoading(true);
    try {
      // Mock transaction - replace with actual Starknet contract call
      setTimeout(() => {
        const mintAmount = (parseFloat(btcAmount) * 65000 * 0.6667).toFixed(2);
        setBtcusdAmount(mintAmount);
        Alert.alert(
          'Success!',
          `Deposited ${btcAmount} BTC\nMinted ${mintAmount} BTCUSD\nNow earning yield on Vesu!`
        );
        setLoading(false);
        loadUserData();
      }, 3000);
    } catch (error) {
      console.error('Transaction failed:', error);
      Alert.alert('Error', 'Transaction failed. Please try again.');
      setLoading(false);
    }
  };

  const harvestYield = async () => {
    setLoading(true);
    try {
      setTimeout(() => {
        Alert.alert('Yield Harvested!', `Claimed $${yieldEarned} in yield rewards`);
        setYieldEarned('0');
        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error('Harvest failed:', error);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>₿</Text>
            </View>
            <Text style={styles.headerTitle}>BTCUSD</Text>
          </View>
          <Text style={styles.headerSubtitle}>Bitcoin-Backed Stablecoin</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {!walletConnected ? (
          <View style={styles.connectSection}>
            <Text style={styles.sectionTitle}>Connect Your Wallet</Text>
            <Text style={styles.sectionSubtitle}>
              Use Braavos wallet for seamless Bitcoin integration
            </Text>
            <TouchableOpacity
              style={[styles.connectButton, loading && styles.connectButtonLoading]}
              onPress={connectWallet}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.connectButtonText}>Connect Braavos Wallet</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* User Position Card */}
            <View style={[styles.card, styles.firstCard]}>
              <Text style={styles.cardTitle}>Your Position</Text>
              <View style={styles.positionRow}>
                <Text style={styles.positionLabel}>Collateral (wBTC)</Text>
                <Text style={styles.positionValue}>{userPosition?.collateral || '0'} wBTC</Text>
              </View>
              <View style={styles.positionRow}>
                <Text style={styles.positionLabel}>Debt (BTCUSD)</Text>
                <Text style={styles.positionValue}>${userPosition?.debt || '0'}</Text>
              </View>
              <View style={styles.positionRow}>
                <Text style={styles.positionLabel}>Collateral Ratio</Text>
                <Text style={[
                  styles.positionValue,
                  { color: parseInt(userPosition?.collateralRatio || '0') > 150 ? '#4CAF50' : '#FF5722' }
                ]}>
                  {userPosition?.collateralRatio || '0'}%
                </Text>
              </View>
              <View style={styles.positionRow}>
                <Text style={styles.positionLabel}>Liquidation Price</Text>
                <Text style={styles.positionValue}>${userPosition?.liquidationPrice || '0'}</Text>
              </View>
            </View>

            {/* Yield Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Yield Earnings</Text>
              <View style={styles.yieldContainer}>
                <Text style={styles.yieldAmount}>${yieldEarned}</Text>
                <Text style={styles.yieldLabel}>Available to Claim</Text>
              </View>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                onPress={harvestYield}
                disabled={loading || parseFloat(yieldEarned) === 0}
              >
                <Text style={styles.actionButtonText}>Harvest Yield</Text>
              </TouchableOpacity>
            </View>

            {/* Deposit Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Deposit BTC & Mint BTCUSD</Text>
              <Text style={styles.inputLabel}>BTC Amount</Text>
              <TextInput
                style={styles.input}
                value={btcAmount}
                onChangeText={setBtcAmount}
                placeholder="0.01"
                keyboardType="decimal-pad"
                placeholderTextColor="#999"
              />

              {btcAmount && (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewText}>
                    You'll receive: ~${(parseFloat(btcAmount || 0) * 65000 * 0.6667).toFixed(2)} BTCUSD
                  </Text>
                  <Text style={styles.previewSubtext}>
                    At 66.67% LTV (150% collateral ratio)
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={depositAndMint}
                disabled={loading || !btcAmount}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Deposit & Mint</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Features Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Why BTCUSD?</Text>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>⚡</Text>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Lightning Fast</Text>
                  <Text style={styles.featureDescription}>Instant transactions on Starknet</Text>
                </View>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🔒</Text>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Bitcoin Secured</Text>
                  <Text style={styles.featureDescription}>Backed by real Bitcoin via Atomiq bridge</Text>
                </View>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>💰</Text>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Earn Yield</Text>
                  <Text style={styles.featureDescription}>Auto-farming on Vesu protocol</Text>
                </View>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>📱</Text>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Mobile Native</Text>
                  <Text style={styles.featureDescription}>Optimized for mobile DeFi</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    backgroundColor: '#111111',
    paddingTop: 50,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerContent: {
    paddingHorizontal: 24,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F7931E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#A0A0A0',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  connectSection: {
    padding: 24,
    alignItems: 'center',
    marginTop: 40,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#A0A0A0',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontWeight: '500',
  },
  connectButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  positionLabel: {
    fontSize: 15,
    color: '#A0A0A0',
    fontWeight: '500',
  },
  positionValue: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  yieldContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  yieldAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#00D4AA',
    letterSpacing: -1,
  },
  yieldLabel: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 4,
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 16,
    fontWeight: '500',
  },
  previewContainer: {
    backgroundColor: '#0A1A0F',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#00D4AA',
  },
  previewText: {
    fontSize: 16,
    color: '#00D4AA',
    fontWeight: '600',
  },
  previewSubtext: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 4,
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 16,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  featureDescription: {
    fontSize: 14,
    color: '#A0A0A0',
    lineHeight: 20,
    fontWeight: '500',
  },
  firstCard: {
    marginTop: 24,
  },
  connectButtonLoading: {
    opacity: 0.7,
  },
});
