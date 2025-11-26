/**
 * Deposit Screen
 *
 * Allows users to deposit wBTC collateral to the vault.
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
import { formatWBTC, parseWBTC, parseBTCUSD } from '../services/starknet';

interface Props {
  onBack?: () => void;
  onSuccess?: () => void;
}

export function Deposit({ onBack, onSuccess }: Props) {
  const { wallet, wbtcBalance, price, refreshAll } = useStore();
  const {
    collateral,
    debt,
    collateralRatio,
    calculateMaxMint,
    calculateNewHealthFactor,
  } = usePosition();
  const {
    isConnected,
    deposit,
    mint,
    depositAndMint,
    getTxUrl,
  } = useStarknetWallet();

  const [amount, setAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [mintAmount, setMintAmount] = useState('');
  const [showMintOption, setShowMintOption] = useState(false);

  const btcPrice = price?.btcPrice ?? 0n;

  // Parse input amount
  const depositAmount = amount ? parseWBTC(amount) : 0n;

  // Calculate new position values
  const newCollateral = collateral + depositAmount;
  const newHealthFactor = calculateNewHealthFactor(depositAmount, 0n, true);
  const maxMintable = calculateMaxMint(depositAmount);

  // USD value of deposit
  const depositValueUSD =
    btcPrice > 0n
      ? (Number(depositAmount) / 1e8) * (Number(btcPrice) / 1e8)
      : 0;

  // Handle max button
  const handleMax = useCallback(() => {
    setAmount(formatWBTC(wbtcBalance));
  }, [wbtcBalance]);

  // Handle deposit
  const handleDeposit = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect your wallet first');
      return;
    }

    if (depositAmount <= 0n) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (depositAmount > wbtcBalance) {
      Alert.alert('Insufficient Balance', 'You do not have enough wBTC');
      return;
    }

    setIsDepositing(true);

    try {
      let txHash: string;

      if (showMintOption && mintAmount) {
        // Deposit and mint in one flow
        const mintAmountBigInt = parseBTCUSD(mintAmount);
        await depositAndMint(depositAmount, mintAmountBigInt);
        txHash = ''; // Multiple transactions
        Alert.alert(
          'Transactions Submitted',
          `Deposit and mint transactions have been submitted. Check your wallet for status.`,
          [
            {
              text: 'OK',
              onPress: () => {
                refreshAll();
                if (onSuccess) onSuccess();
              },
            },
          ]
        );
      } else {
        // Just deposit
        const result = await deposit(depositAmount);
        txHash = result.hash;

        Alert.alert(
          'Deposit Submitted',
          `Transaction submitted!\n\nView on Starkscan:`,
          [
            {
              text: 'View Transaction',
              onPress: () => Linking.openURL(getTxUrl(txHash)),
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
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deposit failed';
      Alert.alert('Deposit Failed', message);
    } finally {
      setIsDepositing(false);
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
          <Text style={styles.title}>Deposit Collateral</Text>
          <Text style={styles.subtitle}>
            Deposit wBTC to mint BTCUSD stablecoin
          </Text>
        </View>

        {/* Balance Card */}
        <GlassCard style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available wBTC</Text>
          <Text style={styles.balanceValue}>{formatWBTC(wbtcBalance)} wBTC</Text>
          <Text style={styles.balanceUSD}>
            {btcPrice > 0n
              ? `$${((Number(wbtcBalance) / 1e8) * (Number(btcPrice) / 1e8)).toLocaleString()}`
              : '--'}
          </Text>
        </GlassCard>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Deposit Amount</Text>
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
          {depositAmount > 0n && (
            <Text style={styles.inputUSD}>
              ${depositValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Text>
          )}
        </View>

        {/* Position Preview */}
        {depositAmount > 0n && (
          <GlassCard style={styles.previewCard}>
            <Text style={styles.previewTitle}>Position Preview</Text>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Total Collateral</Text>
              <View style={styles.previewValues}>
                <Text style={styles.previewOld}>{formatWBTC(collateral)}</Text>
                <Text style={styles.previewArrow}>→</Text>
                <Text style={styles.previewNew}>{formatWBTC(newCollateral)}</Text>
              </View>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Health Factor</Text>
              <View style={styles.previewValues}>
                <Text style={styles.previewOld}>
                  {debt > 0n ? `${(collateralRatio / 100).toFixed(1)}%` : '--'}
                </Text>
                <Text style={styles.previewArrow}>→</Text>
                <Text
                  style={[
                    styles.previewNew,
                    newHealthFactor >= Number(PROTOCOL.MIN_COLLATERAL_RATIO)
                      ? styles.healthGood
                      : styles.healthBad,
                  ]}
                >
                  {debt > 0n ? `${(newHealthFactor / 100).toFixed(1)}%` : '--'}
                </Text>
              </View>
            </View>

            <View style={[styles.previewRow, { marginBottom: 0 }]}>
              <Text style={styles.previewLabel}>Max Mintable</Text>
              <Text style={styles.previewValue}>
                {(Number(maxMintable) / 1e18).toLocaleString()} BTCUSD
              </Text>
            </View>
          </GlassCard>
        )}

        {/* Mint Option */}
        {depositAmount > 0n && (
          <TouchableOpacity
            style={styles.mintOption}
            onPress={() => setShowMintOption(!showMintOption)}
          >
            <View style={styles.checkbox}>
              {showMintOption && <View style={styles.checkboxInner} />}
            </View>
            <Text style={styles.mintOptionText}>
              Also mint BTCUSD after deposit
            </Text>
          </TouchableOpacity>
        )}

        {showMintOption && (
          <View style={styles.mintInputSection}>
            <Text style={styles.inputLabel}>Mint Amount</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={mintAmount}
                onChangeText={setMintAmount}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputCurrency}>BTCUSD</Text>
            </View>
            <Text style={styles.maxMintable}>
              Max: {(Number(maxMintable) / 1e18).toLocaleString()} BTCUSD
            </Text>
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.depositBtn,
            (depositAmount <= 0n || isDepositing) && styles.depositBtnDisabled,
          ]}
          onPress={handleDeposit}
          disabled={depositAmount <= 0n || isDepositing}
        >
          {isDepositing ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.depositBtnText}>
              {showMintOption ? 'Deposit & Mint' : 'Deposit'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Info */}
        <GlassCard style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Deposits</Text>
          <Text style={styles.infoText}>
            • Minimum collateral ratio: 150%{'\n'}
            • Liquidation threshold: 120%{'\n'}
            • Maximum LTV: 66.67%{'\n'}
            • Your collateral earns yield via Vesu
          </Text>
        </GlassCard>
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
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  balanceLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  balanceValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  balanceUSD: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
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
  previewValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  healthGood: {
    color: COLORS.success,
  },
  healthBad: {
    color: COLORS.danger,
  },
  mintOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxInner: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  mintOptionText: {
    color: COLORS.text,
    fontSize: 14,
  },
  mintInputSection: {
    marginBottom: 24,
  },
  maxMintable: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  depositBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  depositBtnDisabled: {
    backgroundColor: COLORS.surfaceLight,
    opacity: 0.5,
  },
  depositBtnText: {
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
