/**
 * Deposit BTC Screen
 *
 * Allows users to deposit BTC via Xverse wallet and Atomiq bridge.
 *
 * Flow:
 * 1. User connects Xverse wallet
 * 2. App generates deposit address via backend API
 * 3. User sends BTC from Xverse
 * 4. Backend monitors for confirmations
 * 5. wBTC is minted to user's Starknet address
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Clipboard,
  Linking,
} from 'react-native';
import { COLORS, BRIDGE } from '../constants';
import { useStore } from '../store';
import { xverseWallet } from '../services/xverse';
import { bridgeApi } from '../services/bridge-api';
import { BridgeDepositStatus } from '../types';

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
  depositAddress: string | null;
  starknetAddress: string | null;
  amountBtc: string;
  amountSats: bigint;
  depositId: string | null;
  btcTxHash: string | null;
  confirmations: number;
  requiredConfirmations: number;
  expiresAt: number | null;
  error: string | null;
}

export function DepositBTC() {
  const { wallet } = useStore();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<DepositState>({
    step: DepositStep.ConnectWallet,
    btcAddress: null,
    depositAddress: null,
    starknetAddress: wallet.address || null,
    amountBtc: '',
    amountSats: 0n,
    depositId: null,
    btcTxHash: null,
    confirmations: 0,
    requiredConfirmations: BRIDGE.REQUIRED_CONFIRMATIONS,
    expiresAt: null,
    error: null,
  });

  const [isLoading, setIsLoading] = useState(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

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

  // Generate deposit address via backend API
  const handleGenerateAddress = useCallback(async () => {
    if (state.amountSats <= 0n) {
      Alert.alert('Invalid Amount', 'Please enter a valid BTC amount');
      return;
    }

    if (Number(state.amountSats) < BRIDGE.MIN_DEPOSIT_SATS) {
      Alert.alert('Amount Too Low', `Minimum deposit is ${BRIDGE.MIN_DEPOSIT_SATS} sats`);
      return;
    }

    if (Number(state.amountSats) > BRIDGE.MAX_DEPOSIT_SATS) {
      Alert.alert('Amount Too High', `Maximum deposit is ${BRIDGE.MAX_DEPOSIT_SATS} sats`);
      return;
    }

    setIsLoading(true);
    setState((prev) => ({ ...prev, error: null }));

    try {
      // Call backend API to request deposit address
      const response = await bridgeApi.requestDeposit({
        starknetAddress: state.starknetAddress || '',
        amountSats: Number(state.amountSats),
      });

      setState((prev) => ({
        ...prev,
        step: DepositStep.WaitingForDeposit,
        depositId: response.depositId,
        depositAddress: response.btcAddress,
        expiresAt: response.expiresAt,
      }));

      // Start polling for deposit status
      startPolling(response.depositId);

    } catch (error: any) {
      console.error('Generate address error:', error);
      setState((prev) => ({
        ...prev,
        error: error.message || 'Failed to generate deposit address',
      }));
    } finally {
      setIsLoading(false);
    }
  }, [state.amountSats, state.starknetAddress]);

  // Start polling for deposit status
  const startPolling = useCallback((depositId: string) => {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      try {
        const deposit = await bridgeApi.getDepositStatus(depositId);

        setState((prev) => ({
          ...prev,
          confirmations: deposit.confirmations,
          btcTxHash: deposit.btcTxHash || null,
          requiredConfirmations: deposit.requiredConfirmations,
        }));

        // Update step based on status
        if (deposit.status === BridgeDepositStatus.Confirmed) {
          setState((prev) => ({ ...prev, step: DepositStep.Confirming }));
        }

        if (deposit.status === BridgeDepositStatus.Claimed) {
          // Deposit complete
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          setState((prev) => ({ ...prev, step: DepositStep.Complete }));
          Alert.alert(
            'Deposit Complete!',
            `${(deposit.amountSats / 100000000).toFixed(8)} wBTC has been minted to your Starknet address.`
          );
        }

        if (deposit.status === BridgeDepositStatus.Expired) {
          // Deposit expired
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          setState((prev) => ({
            ...prev,
            error: 'Deposit expired. Please try again.',
          }));
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, BRIDGE.STATUS_POLL_INTERVAL);
  }, []);

  // Copy address to clipboard
  const handleCopyAddress = useCallback(() => {
    if (state.depositAddress) {
      Clipboard.setString(state.depositAddress);
      Alert.alert('Copied', 'Address copied to clipboard');
    }
  }, [state.depositAddress]);

  // Open Xverse to send BTC
  const handleOpenXverse = useCallback(async () => {
    if (!state.depositAddress) return;

    try {
      await xverseWallet.sendBtc({
        recipient: state.depositAddress,
        amountSats: Number(state.amountSats),
        message: 'BTCUSD Protocol Deposit',
      });
    } catch (error) {
      // Fallback to opening app
      await xverseWallet.openXverseApp();
    }
  }, [state.depositAddress, state.amountSats]);

  // Open transaction in explorer
  const handleViewTransaction = useCallback(() => {
    if (state.btcTxHash) {
      const explorerUrl = BRIDGE.BITCOIN_NETWORK === 'mainnet'
        ? `https://mempool.space/tx/${state.btcTxHash}`
        : `https://mempool.space/testnet/tx/${state.btcTxHash}`;
      Linking.openURL(explorerUrl);
    }
  }, [state.btcTxHash]);

  // Manual check deposit status
  const handleCheckStatus = useCallback(async () => {
    if (!state.depositId) return;

    setIsLoading(true);

    try {
      const deposit = await bridgeApi.getDepositStatus(state.depositId);

      setState((prev) => ({
        ...prev,
        confirmations: deposit.confirmations,
        btcTxHash: deposit.btcTxHash || null,
      }));

      if (deposit.status === BridgeDepositStatus.Claimed) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        setState((prev) => ({ ...prev, step: DepositStep.Complete }));
        Alert.alert(
          'Deposit Complete!',
          `${(deposit.amountSats / 100000000).toFixed(8)} wBTC has been minted to your Starknet address.`
        );
      } else if (deposit.confirmations > 0) {
        setState((prev) => ({ ...prev, step: DepositStep.Confirming }));
      }
    } catch (error: any) {
      console.error('Check status error:', error);
      setState((prev) => ({
        ...prev,
        error: error.message || 'Failed to check status',
      }));
    } finally {
      setIsLoading(false);
    }
  }, [state.depositId]);

  // Reset to start
  const handleReset = useCallback(() => {
    // Clear polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    setState({
      step: DepositStep.ConnectWallet,
      btcAddress: null,
      depositAddress: null,
      starknetAddress: wallet.address || null,
      amountBtc: '',
      amountSats: 0n,
      depositId: null,
      btcTxHash: null,
      confirmations: 0,
      requiredConfirmations: BRIDGE.REQUIRED_CONFIRMATIONS,
      expiresAt: null,
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
                ? 'Send BTC to the deposit address below.'
                : `Waiting for Bitcoin confirmations (${state.confirmations}/${state.requiredConfirmations})`}
            </Text>

            {/* Deposit Address */}
            {state.depositAddress && (
              <View style={styles.addressCard}>
                <Text style={styles.addressCardLabel}>Send BTC to:</Text>
                <Text style={styles.addressCardValue} selectable>
                  {state.depositAddress}
                </Text>
                <View style={styles.addressActions}>
                  <TouchableOpacity
                    style={styles.addressActionButton}
                    onPress={handleCopyAddress}
                  >
                    <Text style={styles.addressActionText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addressActionButton, styles.addressActionPrimary]}
                    onPress={handleOpenXverse}
                  >
                    <Text style={styles.addressActionTextPrimary}>Send with Xverse</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Amount:</Text>
                <Text style={styles.statusValue}>{state.amountBtc} BTC</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Deposit ID:</Text>
                <Text style={styles.statusValue}>{state.depositId?.slice(0, 12)}...</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Confirmations:</Text>
                <Text style={styles.statusValue}>
                  {state.confirmations}/{state.requiredConfirmations}
                </Text>
              </View>
              {state.btcTxHash && (
                <TouchableOpacity onPress={handleViewTransaction}>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Transaction:</Text>
                    <Text style={[styles.statusValue, styles.linkText]}>
                      {state.btcTxHash.slice(0, 12)}... (View)
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              {state.expiresAt && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Expires:</Text>
                  <Text style={styles.statusValue}>
                    {new Date(state.expiresAt * 1000).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(state.confirmations / state.requiredConfirmations) * 100}%` },
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
                <Text style={styles.secondaryButtonText}>Refresh Status</Text>
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
  addressCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  addressCardLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  addressCardValue: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 12,
    lineHeight: 20,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addressActionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  addressActionPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  addressActionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  addressActionTextPrimary: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  linkText: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});
