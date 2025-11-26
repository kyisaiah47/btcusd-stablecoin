/**
 * Withdraw Screen
 *
 * Allows users to withdraw wBTC collateral from the vault.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { COLORS, PROTOCOL } from '../constants';
import { useStore } from '../store';
import { usePosition, useStarknetWallet } from '../hooks';
import { GlassCard } from '../components';
import { formatWBTC, formatBTCUSD, parseWBTC } from '../services/starknet';

interface Props {
  onBack?: () => void;
  onSuccess?: () => void;
}

export function Withdraw({ onBack, onSuccess }: Props) {
  const { wallet, price, refreshAll } = useStore();
  const {
    collateral,
    debt,
    collateralRatio,
    calculateMaxWithdraw,
    calculateNewHealthFactor,
  } = usePosition();
  const { isConnected, withdraw, getTxUrl } = useStarknetWallet();

  const [amount, setAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const btcPrice = price?.btcPrice ?? 0n;

  // Parse input amount
  const withdrawAmount = amount ? parseWBTC(amount) : 0n;

  // Calculate max withdrawable
  const maxWithdraw = calculateMaxWithdraw();

  // Calculate new position values
  const newCollateral = collateral > withdrawAmount ? collateral - withdrawAmount : 0n;
  const newHealthFactor = calculateNewHealthFactor(withdrawAmount, 0n, false);

  // USD value of withdrawal
  const withdrawValueUSD =
    btcPrice > 0n
      ? (Number(withdrawAmount) / 1e8) * (Number(btcPrice) / 1e8)
      : 0;

  // Check if withdrawal is safe
  const isWithdrawSafe =
    debt === 0n || newHealthFactor >= Number(PROTOCOL.MIN_COLLATERAL_RATIO);
  const isWithdrawable = withdrawAmount > 0n && withdrawAmount <= maxWithdraw;

  // Handle max button
  const handleMax = useCallback(() => {
    setAmount(formatWBTC(maxWithdraw));
  }, [maxWithdraw]);

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect your wallet first');
      return;
    }

    if (withdrawAmount <= 0n) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (withdrawAmount > maxWithdraw) {
      Alert.alert(
        'Amount Too High',
        'This withdrawal would make your position unhealthy. Please reduce the amount or repay some debt first.'
      );
      return;
    }

    if (!isWithdrawSafe) {
      Alert.alert(
        'Position At Risk',
        'This withdrawal would put your position below the minimum collateral ratio.'
      );
      return;
    }

    setIsWithdrawing(true);

    try {
      const result = await withdraw(withdrawAmount);

      Alert.alert(
        'Withdrawal Submitted',
        `Transaction submitted!\n\nView on Starkscan:`,
        [
          {
            text: 'View Transaction',
            onPress: () => Linking.openURL(getTxUrl(result.hash)),
          },
          {
            text: 'OK',
            onPress: () => {
              refreshAll();
              if (onSuccess) onSuccess();
            },
          },
        ]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Withdrawal failed';
      Alert.alert('Withdrawal Failed', message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Withdraw Collateral</Text>
          <Text style={styles.subtitle}>
            Withdraw wBTC from your vault position
          </Text>
        </View>

        {/* Position Card */}
        <View style={styles.positionCard}>
          <Text style={styles.positionLabel}>Current Position</Text>
          <View style={styles.positionRow}>
            <Text style={styles.positionItemLabel}>Collateral</Text>
            <Text style={styles.positionItemValue}>{formatWBTC(collateral)} wBTC</Text>
          </View>
          <View style={styles.positionRow}>
            <Text style={styles.positionItemLabel}>Debt</Text>
            <Text style={styles.positionItemValue}>{formatBTCUSD(debt)} BTCUSD</Text>
          </View>
          <View style={styles.positionRow}>
            <Text style={styles.positionItemLabel}>Health Factor</Text>
            <Text
              style={[
                styles.positionItemValue,
                collateralRatio >= Number(PROTOCOL.MIN_COLLATERAL_RATIO)
                  ? styles.healthGood
                  : collateralRatio >= Number(PROTOCOL.LIQUIDATION_THRESHOLD)
                  ? styles.healthWarning
                  : styles.healthBad,
              ]}
            >
              {debt > 0n ? `${(collateralRatio / 100).toFixed(1)}%` : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Withdrawable Amount */}
        <View style={styles.withdrawableCard}>
          <Text style={styles.withdrawableLabel}>Max Withdrawable</Text>
          <Text style={styles.withdrawableValue}>
            {formatWBTC(maxWithdraw)} wBTC
          </Text>
          <Text style={styles.withdrawableNote}>
            {debt > 0n
              ? 'Limited by minimum collateral ratio requirement'
              : 'Full collateral available (no active debt)'}
          </Text>
        </View>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Withdraw Amount</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00000000"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
            />
            <View style={styles.inputRight}>
              <TouchableOpacity onPress={handleMax} style={styles.maxBtn}>
                <Text style={styles.maxBtnText}>MAX</Text>
              </TouchableOpacity>
              <Text style={styles.inputCurrency}>wBTC</Text>
            </View>
          </View>
          {withdrawAmount > 0n && (
            <Text style={styles.inputUSD}>
              ${withdrawValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Text>
          )}
        </View>

        {/* Position Preview */}
        {withdrawAmount > 0n && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Position After Withdrawal</Text>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Remaining Collateral</Text>
              <View style={styles.previewValues}>
                <Text style={styles.previewOld}>{formatWBTC(collateral)}</Text>
                <Text style={styles.previewArrow}>-&gt;</Text>
                <Text style={styles.previewNew}>{formatWBTC(newCollateral)}</Text>
              </View>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Health Factor</Text>
              <View style={styles.previewValues}>
                <Text style={styles.previewOld}>
                  {debt > 0n ? `${(collateralRatio / 100).toFixed(1)}%` : '--'}
                </Text>
                <Text style={styles.previewArrow}>-&gt;</Text>
                <Text
                  style={[
                    styles.previewNew,
                    isWithdrawSafe ? styles.healthGood : styles.healthBad,
                  ]}
                >
                  {debt > 0n
                    ? newHealthFactor === Infinity
                      ? '--'
                      : `${(newHealthFactor / 100).toFixed(1)}%`
                    : '--'}
                </Text>
              </View>
            </View>

            {!isWithdrawSafe && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  Warning: This withdrawal will put your position below the minimum
                  collateral ratio of 150%
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.withdrawBtn,
            (!isWithdrawable || !isWithdrawSafe || isWithdrawing) &&
              styles.withdrawBtnDisabled,
          ]}
          onPress={handleWithdraw}
          disabled={!isWithdrawable || !isWithdrawSafe || isWithdrawing}
        >
          {isWithdrawing ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.withdrawBtnText}>Withdraw</Text>
          )}
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Withdrawals</Text>
          <Text style={styles.infoText}>
            - Must maintain 150% collateral ratio{'\n'}
            - Repay debt to withdraw more collateral{'\n'}
            - No fees on withdrawals{'\n'}
            - Collateral returns from Vesu automatically
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 16,
  },
  backBtnText: {
    color: COLORS.primary,
    fontSize: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  positionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  positionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  positionItemLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  positionItemValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  withdrawableCard: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  withdrawableLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  withdrawableValue: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: '700',
  },
  withdrawableNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '600',
    paddingVertical: 16,
  },
  inputRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  maxBtn: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  maxBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  inputCurrency: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  inputUSD: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
    marginLeft: 4,
  },
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  previewValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewOld: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  previewArrow: {
    color: COLORS.textSecondary,
    marginHorizontal: 8,
  },
  previewNew: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  healthGood: {
    color: COLORS.success,
  },
  healthWarning: {
    color: COLORS.warning,
  },
  healthBad: {
    color: COLORS.danger,
  },
  warningBox: {
    backgroundColor: COLORS.danger + '20',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.danger + '40',
  },
  warningText: {
    color: COLORS.danger,
    fontSize: 12,
    textAlign: 'center',
  },
  withdrawBtn: {
    backgroundColor: COLORS.warning,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  withdrawBtnDisabled: {
    backgroundColor: COLORS.surfaceLight,
  },
  withdrawBtnText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 20,
  },
});
