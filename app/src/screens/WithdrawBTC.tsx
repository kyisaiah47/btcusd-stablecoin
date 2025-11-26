/**
 * Withdraw BTC Screen
 *
 * Allows users to withdraw wBTC to BTC via Atomiq bridge.
 *
 * Flow:
 * 1. User enters amount of wBTC to withdraw
 * 2. User enters their BTC receiving address
 * 3. wBTC is burned and withdrawal request is created
 * 4. Backend processes the withdrawal
 * 5. BTC is sent to user's address
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
  Linking,
} from 'react-native';
import { COLORS, BRIDGE } from '../constants';
import { useStore } from '../store';
import { xverseWallet } from '../services/xverse';
import { BridgeWithdrawalStatus } from '../types';

// Withdrawal status steps
enum WithdrawalStep {
  EnterDetails = 0,
  Confirm = 1,
  Processing = 2,
  Complete = 3,
}

interface WithdrawalState {
  step: WithdrawalStep;
  amountBtc: string;
  amountSats: bigint;
  btcAddress: string;
  withdrawalId: string | null;
  btcTxHash: string | null;
  status: BridgeWithdrawalStatus;
  error: string | null;
}

export function WithdrawBTC() {
  const { wallet, position } = useStore();

  const [state, setState] = useState<WithdrawalState>({
    step: WithdrawalStep.EnterDetails,
    amountBtc: '',
    amountSats: 0n,
    btcAddress: '',
    withdrawalId: null,
    btcTxHash: null,
    status: BridgeWithdrawalStatus.Pending,
    error: null,
  });

  const [isLoading, setIsLoading] = useState(false);

  // Get user's wBTC balance (from position collateral or wallet)
  const wbtcBalance = position?.collateral || 0n;
  const wbtcBalanceBtc = Number(wbtcBalance) / 100000000;

  // Parse BTC amount
  const handleAmountChange = useCallback((text: string) => {
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

  // Set max amount
  const handleSetMax = useCallback(() => {
    const btcAmount = wbtcBalanceBtc.toFixed(8);
    const satsAmount = wbtcBalance;

    setState((prev) => ({
      ...prev,
      amountBtc: btcAmount,
      amountSats: satsAmount,
    }));
  }, [wbtcBalance, wbtcBalanceBtc]);

  // Update BTC address
  const handleAddressChange = useCallback((text: string) => {
    setState((prev) => ({
      ...prev,
      btcAddress: text.trim(),
    }));
  }, []);

  // Get BTC address from Xverse
  const handleGetXverseAddress = useCallback(async () => {
    try {
      const connection = await xverseWallet.connect();
      if (connection.btcPaymentAddress?.address) {
        setState((prev) => ({
          ...prev,
          btcAddress: connection.btcPaymentAddress!.address,
        }));
      }
    } catch (error) {
      console.error('Failed to get Xverse address:', error);
    }
  }, []);

  // Validate and proceed to confirmation
  const handleProceedToConfirm = useCallback(() => {
    if (state.amountSats <= 0n) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (Number(state.amountSats) < BRIDGE.MIN_DEPOSIT_SATS) {
      Alert.alert('Amount Too Low', `Minimum withdrawal is ${BRIDGE.MIN_DEPOSIT_SATS} sats`);
      return;
    }

    if (state.amountSats > wbtcBalance) {
      Alert.alert('Insufficient Balance', 'You do not have enough wBTC');
      return;
    }

    if (!state.btcAddress) {
      Alert.alert('Missing Address', 'Please enter a BTC receiving address');
      return;
    }

    // Basic BTC address validation
    const isValidAddress =
      state.btcAddress.startsWith('bc1') ||
      state.btcAddress.startsWith('tb1') ||
      state.btcAddress.startsWith('1') ||
      state.btcAddress.startsWith('3') ||
      state.btcAddress.startsWith('m') ||
      state.btcAddress.startsWith('n') ||
      state.btcAddress.startsWith('2');

    if (!isValidAddress) {
      Alert.alert('Invalid Address', 'Please enter a valid Bitcoin address');
      return;
    }

    setState((prev) => ({ ...prev, step: WithdrawalStep.Confirm }));
  }, [state.amountSats, state.btcAddress, wbtcBalance]);

  // Submit withdrawal request
  const handleSubmitWithdrawal = useCallback(async () => {
    setIsLoading(true);
    setState((prev) => ({ ...prev, error: null }));

    try {
      // In a full implementation, this would:
      // 1. Call the smart contract to burn wBTC
      // 2. Create a withdrawal request via the backend API
      // 3. Backend monitors and processes the withdrawal

      // For now, we simulate the withdrawal request
      const withdrawalId = `wd_${Date.now()}`;

      setState((prev) => ({
        ...prev,
        step: WithdrawalStep.Processing,
        withdrawalId,
        status: BridgeWithdrawalStatus.Processing,
      }));

      // Simulate processing delay
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          step: WithdrawalStep.Complete,
          status: BridgeWithdrawalStatus.Completed,
          btcTxHash: 'simulated_btc_tx_hash_' + Date.now(),
        }));
      }, 3000);
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      setState((prev) => ({
        ...prev,
        error: error.message || 'Failed to process withdrawal',
      }));
    } finally {
      setIsLoading(false);
    }
  }, [state.amountSats, state.btcAddress, wallet.address]);

  // Reset to start
  const handleReset = useCallback(() => {
    setState({
      step: WithdrawalStep.EnterDetails,
      amountBtc: '',
      amountSats: 0n,
      btcAddress: '',
      withdrawalId: null,
      btcTxHash: null,
      status: BridgeWithdrawalStatus.Pending,
      error: null,
    });
  }, []);

  // Open transaction in explorer
  const handleViewTransaction = useCallback(() => {
    if (state.btcTxHash) {
      const explorerUrl = BRIDGE.BITCOIN_NETWORK === 'mainnet'
        ? `https://mempool.space/tx/${state.btcTxHash}`
        : `https://mempool.space/testnet/tx/${state.btcTxHash}`;
      Linking.openURL(explorerUrl);
    }
  }, [state.btcTxHash]);

  // Calculate fee
  const feeAmount = Number(state.amountSats) * (BRIDGE.BRIDGE_FEE_BPS / 10000);
  const receiveAmount = Number(state.amountSats) - feeAmount;

  // Render step content
  const renderStep = () => {
    switch (state.step) {
      case WithdrawalStep.EnterDetails:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Withdraw wBTC to BTC</Text>
            <Text style={styles.stepDescription}>
              Enter the amount and your Bitcoin receiving address.
            </Text>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>Amount</Text>
                <TouchableOpacity onPress={handleSetMax}>
                  <Text style={styles.maxButton}>Max: {wbtcBalanceBtc.toFixed(8)} wBTC</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="decimal-pad"
                  value={state.amountBtc}
                  onChangeText={handleAmountChange}
                />
                <Text style={styles.inputSuffix}>wBTC</Text>
              </View>
              {state.amountSats > 0n && (
                <Text style={styles.satsLabel}>
                  = {state.amountSats.toString()} satoshis
                </Text>
              )}
            </View>

            {/* BTC Address Input */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>BTC Receiving Address</Text>
                <TouchableOpacity onPress={handleGetXverseAddress}>
                  <Text style={styles.xverseButton}>Use Xverse</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.addressInput}
                placeholder="bc1q... or tb1q..."
                placeholderTextColor={COLORS.textSecondary}
                value={state.btcAddress}
                onChangeText={handleAddressChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (state.amountSats <= 0n || !state.btcAddress) && styles.buttonDisabled,
              ]}
              onPress={handleProceedToConfirm}
              disabled={state.amountSats <= 0n || !state.btcAddress}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case WithdrawalStep.Confirm:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Confirm Withdrawal</Text>
            <Text style={styles.stepDescription}>
              Please review the details before confirming.
            </Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>You Send</Text>
                <Text style={styles.summaryValue}>{state.amountBtc} wBTC</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Bridge Fee ({BRIDGE.BRIDGE_FEE_BPS / 100}%)</Text>
                <Text style={styles.summaryValue}>
                  -{(feeAmount / 100000000).toFixed(8)} BTC
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelBold}>You Receive</Text>
                <Text style={styles.summaryValueBold}>
                  {(receiveAmount / 100000000).toFixed(8)} BTC
                </Text>
              </View>
            </View>

            <View style={styles.addressPreview}>
              <Text style={styles.addressPreviewLabel}>To Address:</Text>
              <Text style={styles.addressPreviewValue} numberOfLines={2}>
                {state.btcAddress}
              </Text>
            </View>

            <View style={styles.warningCard}>
              <Text style={styles.warningText}>
                Please verify the receiving address is correct. Bitcoin transactions cannot be reversed.
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setState((prev) => ({ ...prev, step: WithdrawalStep.EnterDetails }))}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, isLoading && styles.buttonDisabled]}
                onPress={handleSubmitWithdrawal}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm Withdrawal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );

      case WithdrawalStep.Processing:
        return (
          <View style={styles.stepContent}>
            <View style={styles.processingIcon}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Processing Withdrawal</Text>
            <Text style={styles.stepDescription}>
              Your withdrawal is being processed. This may take a few minutes.
            </Text>

            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Withdrawal ID:</Text>
                <Text style={styles.statusValue}>{state.withdrawalId}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Amount:</Text>
                <Text style={styles.statusValue}>{state.amountBtc} wBTC</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Status:</Text>
                <Text style={[styles.statusValue, styles.statusProcessing]}>Processing</Text>
              </View>
            </View>
          </View>
        );

      case WithdrawalStep.Complete:
        return (
          <View style={styles.stepContent}>
            <View style={styles.successIcon}>
              <Text style={styles.successEmoji}>&#10003;</Text>
            </View>
            <Text style={styles.stepTitle}>Withdrawal Complete!</Text>
            <Text style={styles.stepDescription}>
              {(receiveAmount / 100000000).toFixed(8)} BTC has been sent to your address.
            </Text>

            {state.btcTxHash && (
              <TouchableOpacity
                style={styles.viewTxButton}
                onPress={handleViewTransaction}
              >
                <Text style={styles.viewTxButtonText}>View Transaction</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={handleReset}>
              <Text style={styles.primaryButtonText}>New Withdrawal</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Withdraw BTC</Text>
        <Text style={styles.headerSubtitle}>Convert wBTC back to BTC</Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressIndicator}>
        {[0, 1, 2, 3].map((step) => (
          <View key={step} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                state.step >= step && styles.progressDotActive,
                state.step === step && styles.progressDotCurrent,
              ]}
            />
            {step < 3 && (
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
          <Text style={styles.infoTitle}>Withdrawal Info</Text>
          <Text style={styles.infoText}>
            • Minimum withdrawal: {BRIDGE.MIN_DEPOSIT_SATS.toLocaleString()} sats{'\n'}
            • Bridge fee: {BRIDGE.BRIDGE_FEE_BPS / 100}%{'\n'}
            • Estimated time: 10-30 minutes{'\n'}
            • Withdrawals are processed in batches
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
    width: 50,
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
    textAlign: 'center',
  },
  stepDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  maxButton: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  xverseButton: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 16,
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
    marginTop: 4,
  },
  addressInput: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: COLORS.text,
    fontSize: 14,
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
  buttonDisabled: {
    opacity: 0.5,
  },
  summaryCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 14,
  },
  summaryLabelBold: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryValueBold: {
    color: COLORS.success,
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  addressPreview: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  addressPreviewLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  addressPreviewValue: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  warningCard: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  warningText: {
    color: COLORS.warning,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  backButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  processingIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
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
  statusProcessing: {
    color: COLORS.warning,
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
  viewTxButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  viewTxButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
