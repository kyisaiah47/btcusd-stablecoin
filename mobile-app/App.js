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
import { Contract, RpcProvider, Account, CallData, shortString } from 'starknet';
import contractAbi from './contract-abi.json';

const { width, height } = Dimensions.get('window');

// Deployed testnet contract
const CONTRACT_ADDRESS = '0x069818be022a2633500ba32c398280c2f49f19b881f9c3952d3d164df93bfd4e';

export default function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [btcAmount, setBtcAmount] = useState('');
  const [btcusdAmount, setBtcusdAmount] = useState('');
  const [userPosition, setUserPosition] = useState(null);
  const [privateKey, setPrivateKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Initialize Starknet provider (Sepolia testnet)
  const provider = new RpcProvider({
    nodeUrl: 'https://starknet-sepolia-rpc.publicnode.com'
  });

  // Initialize read-only contract
  useEffect(() => {
    const readOnlyContract = new Contract(contractAbi, CONTRACT_ADDRESS, provider);
    setContract(readOnlyContract);
  }, []);

  const connectWallet = async () => {
    try {
      setLoading(true);

      if (!privateKey) {
        setShowKeyInput(true);
        setLoading(false);
        return;
      }

      // Create account from private key
      // Replace with your deployed account address
      const accountAddress = '0x01f7bb20a9a9f073da23ab3319ec81e81289982b9afd1115269003a6c5f20acf';

      const userAccount = new Account(provider, accountAddress, privateKey);
      setAccount(userAccount);

      // Connect contract to account for transactions
      const connectedContract = new Contract(contractAbi, CONTRACT_ADDRESS, userAccount);
      setContract(connectedContract);

      setWalletConnected(true);
      setShowKeyInput(false);
      setLoading(false);

      await loadUserData(accountAddress, connectedContract);
    } catch (error) {
      console.error('Wallet connection failed:', error);
      Alert.alert('Error', 'Failed to connect wallet. Check your private key.');
      setLoading(false);
    }
  };

  const loadUserData = async (address, contractInstance) => {
    try {
      const contract = contractInstance || contract;

      // Get user stats from contract
      const stats = await contract.get_user_stats(address);

      // stats returns (collateral, debt, balance)
      const collateral = stats[0];
      const debt = stats[1];
      const balance = stats[2];

      setUserPosition({
        collateral: (Number(collateral) / 1e8).toFixed(4), // Assuming 8 decimals
        debt: (Number(debt) / 1e18).toFixed(2),
        collateralRatio: debt > 0 ? ((Number(collateral) * 100) / Number(debt)).toFixed(0) : '0',
        liquidationPrice: '0' // Calculate based on your logic
      });

      // Get balance
      const userBalance = await contract.balance_of(address);
      setBtcusdAmount((Number(userBalance) / 1e18).toFixed(2));

    } catch (error) {
      console.error('Failed to load user data:', error);
      // Set defaults if no position yet
      setUserPosition({
        collateral: '0',
        debt: '0',
        collateralRatio: '0',
        liquidationPrice: '0'
      });
    }
  };

  const depositAndMint = async () => {
    if (!btcAmount || parseFloat(btcAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid BTC amount');
      return;
    }

    if (!account) {
      Alert.alert('Error', 'Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      // Convert amount to proper format (assuming 8 decimals for BTC)
      const amountInSmallestUnit = Math.floor(parseFloat(btcAmount) * 1e8);

      // Call deposit_and_mint
      const result = await contract.deposit_and_mint(amountInSmallestUnit);

      // Wait for transaction
      await provider.waitForTransaction(result.transaction_hash);

      const mintAmount = (parseFloat(btcAmount) * 65000 * 0.6667).toFixed(2);
      setBtcusdAmount(mintAmount);

      Alert.alert(
        'Success!',
        `Transaction confirmed!\nDeposited ${btcAmount} BTC\nMinted ~${mintAmount} BTCUSD\n\nTx: ${result.transaction_hash.slice(0, 10)}...`
      );

      setLoading(false);
      await loadUserData(account.address, contract);
    } catch (error) {
      console.error('Transaction failed:', error);
      Alert.alert('Error', `Transaction failed: ${error.message}`);
      setLoading(false);
    }
  };

  const checkContractInfo = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      const name = await contract.name();
      const symbol = await contract.symbol();
      const totalSupply = await contract.total_supply();

      // Convert felt252 to string - handle BigInt properly
      const nameHex = typeof name === 'bigint' ? name.toString(16) : name.toString(16);
      const symbolHex = typeof symbol === 'bigint' ? symbol.toString(16) : symbol.toString(16);

      const nameStr = shortString.decodeShortString('0x' + nameHex.replace(/^0x/, ''));
      const symbolStr = shortString.decodeShortString('0x' + symbolHex.replace(/^0x/, ''));

      Alert.alert(
        'Contract Info',
        `Name: ${nameStr}\nSymbol: ${symbolStr}\nTotal Supply: ${Number(totalSupply[0]) / 1e18}`
      );
      setLoading(false);
    } catch (error) {
      console.error('Failed to get contract info:', error);
      Alert.alert('Error', `Failed to load contract info: ${error.message}`);
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
          <Text style={styles.headerSubtitle}>Live on Starknet Testnet</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {!walletConnected ? (
          <View style={styles.connectSection}>
            <Text style={styles.sectionTitle}>Connect Your Wallet</Text>
            <Text style={styles.sectionSubtitle}>
              Enter your Starknet private key to connect
            </Text>

            {showKeyInput && (
              <>
                <TextInput
                  style={styles.keyInput}
                  value={privateKey}
                  onChangeText={setPrivateKey}
                  placeholder="0x... (your private key)"
                  placeholderTextColor="#666"
                  secureTextEntry
                />
                <Text style={styles.warningText}>
                  ⚠️ Only use testnet keys! Never enter mainnet private keys.
                </Text>
              </>
            )}

            <TouchableOpacity
              style={[styles.connectButton, loading && styles.connectButtonLoading]}
              onPress={connectWallet}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.connectButtonText}>
                  {showKeyInput ? 'Connect' : 'Connect Wallet'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, {marginTop: 12}]}
              onPress={checkContractInfo}
            >
              <Text style={styles.secondaryButtonText}>View Contract Info</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Connected Badge */}
            <View style={styles.connectedBadge}>
              <Text style={styles.connectedText}>
                Connected: {account?.address.slice(0, 6)}...{account?.address.slice(-4)}
              </Text>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Collateral</Text>
                <Text style={styles.statValue}>{userPosition?.collateral || '0'}</Text>
                <Text style={styles.statUnit}>wBTC</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Debt</Text>
                <Text style={styles.statValue}>${userPosition?.debt || '0'}</Text>
                <Text style={styles.statUnit}>BTCUSD</Text>
              </View>
            </View>

            {/* Health Ratio Card */}
            <View style={[
              styles.healthCard,
              {
                backgroundColor: parseInt(userPosition?.collateralRatio || '0') > 150
                  ? '#10B98115'
                  : '#EF444415'
              }
            ]}>
              <View style={styles.healthHeader}>
                <Text style={styles.healthLabel}>Health Ratio</Text>
                <View style={[
                  styles.healthBadge,
                  {
                    backgroundColor: parseInt(userPosition?.collateralRatio || '0') > 150
                      ? '#10B981'
                      : '#EF4444'
                  }
                ]}>
                  <Text style={styles.healthBadgeText}>
                    {parseInt(userPosition?.collateralRatio || '0') > 150 ? 'SAFE' : 'AT RISK'}
                  </Text>
                </View>
              </View>
              <Text style={[
                styles.healthValue,
                {
                  color: parseInt(userPosition?.collateralRatio || '0') > 150
                    ? '#10B981'
                    : '#EF4444'
                }
              ]}>
                {userPosition?.collateralRatio || '0'}%
              </Text>
              <View style={styles.healthBar}>
                <View style={[
                  styles.healthBarFill,
                  {
                    width: `${Math.min(parseInt(userPosition?.collateralRatio || '0'), 300)}%`,
                    backgroundColor: parseInt(userPosition?.collateralRatio || '0') > 150
                      ? '#10B981'
                      : '#EF4444'
                  }
                ]} />
              </View>
              <Text style={styles.healthSubtext}>
                Liquidation at 120% • Safe above 150%
              </Text>
            </View>

            {/* Deposit Card */}
            <View style={styles.actionCard}>
              <Text style={styles.cardTitle}>Deposit & Mint</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Amount</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.amountInput}
                    value={btcAmount}
                    onChangeText={setBtcAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor="#6B7280"
                  />
                  <View style={styles.inputBadge}>
                    <Text style={styles.inputBadgeText}>wBTC</Text>
                  </View>
                </View>
              </View>

              {btcAmount && parseFloat(btcAmount) > 0 && (
                <View style={styles.mintPreview}>
                  <View style={styles.mintPreviewRow}>
                    <Text style={styles.mintPreviewLabel}>You'll Receive</Text>
                    <Text style={styles.mintPreviewValue}>
                      ${(parseFloat(btcAmount || 0) * 65000 * 0.6667).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.mintPreviewRow}>
                    <Text style={styles.mintPreviewLabel}>Collateral Ratio</Text>
                    <Text style={styles.mintPreviewValue}>150%</Text>
                  </View>
                  <View style={styles.mintPreviewRow}>
                    <Text style={styles.mintPreviewLabel}>LTV</Text>
                    <Text style={styles.mintPreviewValue}>66.67%</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, (loading || !btcAmount) && styles.buttonDisabled]}
                onPress={depositAndMint}
                disabled={loading || !btcAmount}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Execute Transaction</Text>
                    <Text style={styles.primaryButtonSubtext}>On Starknet Testnet</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Contract Info */}
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Contract Details</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Address</Text>
                <Text style={styles.infoRowValue}>{CONTRACT_ADDRESS.slice(0, 8)}...{CONTRACT_ADDRESS.slice(-6)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Network</Text>
                <View style={styles.networkBadge}>
                  <View style={styles.networkDot} />
                  <Text style={styles.infoRowValue}>Sepolia Testnet</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={checkContractInfo}
              >
                <Text style={styles.outlineButtonText}>View Contract Data</Text>
              </TouchableOpacity>
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
    backgroundColor: '#0F0F1A',
  },
  header: {
    backgroundColor: '#1A1A2E',
    paddingTop: 50,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A40',
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#A5B4FC',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    backgroundColor: '#0F0F1A',
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
  keyInput: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A40',
    marginBottom: 12,
    width: '100%',
    fontFamily: 'monospace',
  },
  warningText: {
    fontSize: 12,
    color: '#FCD34D',
    marginBottom: 16,
    textAlign: 'center',
  },
  connectButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#1A1A2E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  secondaryButtonText: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '600',
  },
  connectedBadge: {
    backgroundColor: '#10B98120',
    padding: 12,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  connectedText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  statLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statUnit: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  healthCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  healthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  healthBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  healthValue: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -1,
  },
  healthBar: {
    height: 8,
    backgroundColor: '#2A2A40',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  healthSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  actionCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F1A',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2A2A40',
    paddingRight: 12,
  },
  amountInput: {
    flex: 1,
    padding: 20,
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputBadge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  inputBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mintPreview: {
    backgroundColor: '#0F0F1A',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  mintPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mintPreviewLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  mintPreviewValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  primaryButtonSubtext: {
    color: '#C7D2FE',
    fontSize: 13,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  infoCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoRowLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  infoRowValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#2A2A40',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  outlineButtonText: {
    color: '#A5B4FC',
    fontSize: 15,
    fontWeight: '600',
  },
  firstCard: {
    marginTop: 16,
  },
  connectButtonLoading: {
    opacity: 0.7,
  },
});
