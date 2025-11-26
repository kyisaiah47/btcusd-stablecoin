/**
 * Deposit BTC Screen
 *
 * Allows users to deposit BTC via Xverse wallet and Atomiq bridge.
 *
 * Flow:
 * 1. User connects Xverse wallet
 * 2. App generates deposit address via Atomiq
 * 3. User sends BTC from Xverse
 * 4. Backend monitors for confirmations
 * 5. wBTC is minted to user's Starknet address
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS, PROTOCOL } from '../constants';
import { useStore } from '../store';
import { xverseWallet, XverseWalletService } from '../services/xverse';

// Deposit status steps
enum DepositStep {
  ConnectWallet = 0,
  EnterAmount = 1,
  GenerateAddress = 2,
  WaitingForDeposit = 3,
  Confirming = 4,
  Complete = 5,
}

interface DepositState {
  step: DepositStep;
  btcAddress: string | null;
  starknetAddress: string | null;
  amountBtc: string;
  amountSats: bigint;
  depositId: string | null;
  btcTxHash: string | null;
  confirmations: number;
  error: string | null;
}

export function DepositBTC() {
  const { wallet } = useStore();

  const [state, setState] = useState<DepositState>({
    step: DepositStep.ConnectWallet,
    btcAddress: null,
    starknetAddress: wallet.address || null,
    amountBtc: '',
    amountSats: 0n,
    depositId: null,
    btcTxHash: null,
    confirmations: 0,
    error: null,
  });

  const [isLoading, setIsLoading] = useState(false);

  // Connect Xverse wallet
  const handleConnectXverse = useCallback(async () => {
    setIsLoading(true);
    setState((prev) => ({ ...prev, error: null }));

    try {
      const connection = await xverseWallet.connect();

      if (connection.isConnected) {
        setState((prev) => ({
          ...prev,
          step: DepositStep.EnterAmount,
          btcAddress: connection.btcPaymentAddress?.address || null,
          starknetAddress:
            connection.starknetAddress?.address || wallet.address || null,
        }));
      } else {
        // Fallback: open Xverse app
        await xverseWallet.openXverseApp();
        setState((prev) => ({
          ...prev,
          error: 'Please complete connection in Xverse app',
        }));
      }
    } catch (error: any) {
      console.error('Xverse connection error:', error);
      setState((prev) => ({
        ...prev,
        error: error.message || 'Failed to connect wallet',
      }));
    } finally {
      setIsLoading(false);
    }
  }, [wallet.address]);

  // Parse BTC amount
  const handleAmountChange = useCallback((text: string) => {
    // Only allow valid decimal input
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 8)}` : cleaned;

    const btcAmount = parseFloat(formatted) || 0;
    const satsAmount = BigInt(Math.round(btcAmount * 100_000_000));

    setState((prev) => ({
      ...prev,
      amountBtc: formatted,
      amountSats: satsAmount,
    }));
  }, []);

  // Generate deposit address
  const handleGenerateAddress = useCallback(async () => {
    if (state.amountSats <= 0n) {
      Alert.alert('Invalid Amount', 'Please enter a valid BTC amount');
      return;
    }

    setIsLoading(true);
    setState((prev) => ({ ...prev, error: null }));

    try {
      // In production, this would call the backend API
      // which calls the Atomiq adapter contract
      // For now, we simulate the address generation
      const mockDepositId = `dep_${Date.now()}`;
      const mockBtcAddress = generateMockDepositAddress(
        state.starknetAddress || '',
        state.amountSats
      );

      setState((prev) => ({
        ...prev,
        step: DepositStep.WaitingForDeposit,
        depositId: mockDepositId,
      }));

      // Show the deposit address
      Alert.alert(
        'Send BTC to this address',
        `${mockBtcAddress}\n\nAmount: ${state.amountBtc} BTC\n\nThis address expires in 24 hours.`,
        [
          {
            text: 'Copy Address',
            onPress: () => {
              // Copy to clipboard would go here
              Alert.alert('Copied', 'Address copied to clipboard');
            },
          },
          {
            text: 'Open Xverse',
            onPress: async () => {
              try {
                await xverseWallet.sendBtc({
                  recipient: mockBtcAddress,
                  amountSats: Number(state.amountSats),
                  message: 'BTCUSD Protocol Deposit',
                });
              } catch (error) {
                // Fallback to opening app
                await xverseWallet.openXverseApp();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Generate address error:', error);
      setState((prev) => ({
        ...prev,
        error: error.message || 'Failed to generate deposit address',
      }));
    } finally {
      setIsLoading(false);
    }
  }, [state.amountSats, state.amountBtc, state.starknetAddress]);

  // Check deposit status
  const handleCheckStatus = useCallback(async () => {
    setIsLoading(true);

    try {
      // In production, this would query the backend
      // For demo, we simulate confirmation progress
      const newConfirmations = state.confirmations + 1;

      if (newConfirmations >= 3) {
        setState((prev) => ({
          ...prev,
          step: DepositStep.Complete,
          confirmations: newConfirmations,
        }));
        Alert.alert(
          'Deposit Complete!',
          `${state.amountBtc} wBTC has been minted to your Starknet address.`
        );
      } else {
        setState((prev) => ({
          ...prev,
          step: DepositStep.Confirming,
          confirmations: newConfirmations,
        }));
      }
    } finally {
      setIsLoading(false);
    }
  }, [state.confirmations, state.amountBtc]);

  // Reset to start
  const handleReset = useCallback(() => {
    setState({
      step: DepositStep.ConnectWallet,
      btcAddress: null,
      starknetAddress: wallet.address || null,
      amountBtc: '',
      amountSats: 0n,
      depositId: null,
      btcTxHash: null,
      confirmations: 0,
      error: null,
    });
  }, [wallet.address]);

  // Render step content
  const renderStep = () => {
    switch (state.step) {
      case DepositStep.ConnectWallet:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Connect Xverse Wallet</Text>
            <Text style={styles.stepDescription}>
              Connect your Xverse wallet to deposit BTC and receive wBTC on Starknet.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleConnectXverse}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.primaryButtonText}>Connect Xverse</Text>
              )}
            </TouchableOpacity>
          </View>
        );

      case DepositStep.EnterAmount:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Enter Amount</Text>
            <Text style={styles.stepDescription}>
              Enter the amount of BTC you want to deposit.
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
                value={state.amountBtc}
                onChangeText={handleAmountChange}
              />
              <Text style={styles.inputSuffix}>BTC</Text>
            </View>

            {state.amountSats > 0n && (
              <Text style={styles.satsLabel}>
                = {state.amountSats.toString()} satoshis
              </Text>
            )}

            <View style={styles.addressInfo}>
              <Text style={styles.addressLabel}>Your BTC Address:</Text>
              <Text style={styles.addressValue}>
                {state.btcAddress?.slice(0, 16)}...
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (isLoading || state.amountSats <= 0n) && styles.buttonDisabled,
              ]}
              onPress={handleGenerateAddress}
              disabled={isLoading || state.amountSats <= 0n}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.primaryButtonText}>Generate Deposit Address</Text>
              )}
            </TouchableOpacity>
          </View>
        );

      case DepositStep.WaitingForDeposit:
      case DepositStep.Confirming:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              {state.step === DepositStep.WaitingForDeposit
                ? 'Waiting for Deposit'
                : 'Confirming Transaction'}
            </Text>
            <Text style={styles.stepDescription}>
              {state.step === DepositStep.WaitingForDeposit
                ? 'Send BTC to the deposit address shown above.'
                : `Waiting for Bitcoin confirmations (${state.confirmations}/3)`}
            </Text>

            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Amount:</Text>
                <Text style={styles.statusValue}>{state.amountBtc} BTC</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Deposit ID:</Text>
                <Text style={styles.statusValue}>{state.depositId}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Confirmations:</Text>
                <Text style={styles.statusValue}>{state.confirmations}/3</Text>
              </View>
            </View>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(state.confirmations / 3) * 100}%` },
                ]}
              />
            </View>

            <TouchableOpacity
              style={[styles.secondaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleCheckStatus}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Text style={styles.secondaryButtonText}>Check Status</Text>
              )}
            </TouchableOpacity>
          </View>
        );

      case DepositStep.Complete:
        return (
          <View style={styles.stepContent}>
            <View style={styles.successIcon}>
              <Text style={styles.successEmoji}>&#10003;</Text>
            </View>
            <Text style={styles.stepTitle}>Deposit Complete!</Text>
            <Text style={styles.stepDescription}>
              {state.amountBtc} wBTC has been minted to your Starknet wallet.
              You can now deposit it as collateral to mint BTCUSD.
            </Text>

            <TouchableOpacity style={styles.primaryButton} onPress={handleReset}>
              <Text style={styles.primaryButtonText}>Deposit More</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deposit BTC</Text>
        <Text style={styles.headerSubtitle}>Bridge BTC to wBTC via Atomiq</Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressIndicator}>
        {[0, 1, 2, 3, 4].map((step) => (
          <View key={step} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                state.step >= step && styles.progressDotActive,
                state.step === step && styles.progressDotCurrent,
              ]}
            />
            {step < 4 && (
              <View
                style={[
                  styles.progressLine,
                  state.step > step && styles.progressLineActive,
                ]}
              />
            )}
          </View>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {state.error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        )}

        {renderStep()}

        {/* Info Section */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            1. Connect your Xverse Bitcoin wallet{'\n'}
            2. Enter the amount of BTC to deposit{'\n'}
            3. Send BTC to the generated address{'\n'}
            4. Wait for 3 confirmations (~30 min){'\n'}
            5. wBTC is minted to your Starknet address
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// Helper: Generate mock deposit address
function generateMockDepositAddress(starknetAddress: string, amount: bigint): string {
  // This is a placeholder - real address comes from Atomiq
  const hash = Math.abs(
    starknetAddress.split('').reduce((a, b) => {
      return a + b.charCodeAt(0);
    }, 0) + Number(amount % 1000000n)
  )
    .toString(16)
    .slice(0, 32);
  return `tb1q${hash}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  progressIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  progressDotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.border,
  },
  progressLineActive: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '600',
    paddingVertical: 16,
  },
  inputSuffix: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  satsLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 16,
  },
  addressInfo: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  addressLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  addressValue: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  statusCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  statusValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  successEmoji: {
    fontSize: 32,
    color: COLORS.text,
  },
  errorCard: {
    backgroundColor: '#331111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
});
