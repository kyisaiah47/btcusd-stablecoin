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

      <LinearGradient
        colors={['#FF6B35', '#F7931E', '#FFD700']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>BTCUSD</Text>
        <Text style={styles.headerSubtitle}>Bitcoin-Backed Stablecoin</Text>
        <Text style={styles.headerTagline}>Powered by Starknet + Vesu</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {!walletConnected ? (
          <View style={styles.connectSection}>
            <Text style={styles.sectionTitle}>Connect Your Wallet</Text>
            <Text style={styles.sectionSubtitle}>
              Use Braavos wallet for seamless Bitcoin integration
            </Text>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={connectWallet}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>Connect Braavos Wallet</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* User Position Card */}
            <View style={styles.card}>
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
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 5,
    opacity: 0.9,
  },
  headerTagline: {
    fontSize: 12,
    color: '#fff',
    marginTop: 5,
    opacity: 0.7,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  connectSection: {
    alignItems: 'center',
    marginTop: 50,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  connectButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  positionLabel: {
    fontSize: 14,
    color: '#999',
  },
  positionValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  yieldContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  yieldAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  yieldLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  inputLabel: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#444',
    marginBottom: 15,
  },
  previewContainer: {
    backgroundColor: '#0a2a1a',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  previewText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  previewSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  actionButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 15,
    width: 30,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
});
