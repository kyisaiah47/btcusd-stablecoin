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

      // Convert felt252 to string
      const nameStr = shortString.decodeShortString(name.toString(16));
      const symbolStr = shortString.decodeShortString(symbol.toString(16));

      Alert.alert(
        'Contract Info',
        `Name: ${nameStr}\nSymbol: ${symbolStr}\nTotal Supply: ${Number(totalSupply) / 1e18}`
      );
      setLoading(false);
    } catch (error) {
      console.error('Failed to get contract info:', error);
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
            </View>

            {/* Deposit Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Deposit & Mint BTCUSD</Text>
              <Text style={styles.inputLabel}>Collateral Amount</Text>
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
                style={[styles.actionButton, (loading || !btcAmount) && styles.actionButtonDisabled]}
                onPress={depositAndMint}
                disabled={loading || !btcAmount}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.actionButtonText}>Deposit & Mint (Real TX)</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Contract Info */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contract Info</Text>
              <Text style={styles.infoText}>Address: {CONTRACT_ADDRESS.slice(0, 10)}...</Text>
              <Text style={styles.infoText}>Network: Starknet Sepolia</Text>
              <TouchableOpacity
                style={[styles.secondaryButton, {marginTop: 12}]}
                onPress={checkContractInfo}
              >
                <Text style={styles.secondaryButtonText}>Refresh Contract Data</Text>
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
  inputLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0F0F1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A40',
    marginBottom: 16,
    fontWeight: '500',
  },
  previewContainer: {
    backgroundColor: '#1E1B4B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  previewText: {
    fontSize: 16,
    color: '#A5B4FC',
    fontWeight: '600',
  },
  previewSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  firstCard: {
    marginTop: 16,
  },
  connectButtonLoading: {
    opacity: 0.7,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
});
