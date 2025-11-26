/**
 * Yield Card Component
 *
 * Displays yield earnings with glassmorphism styling.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants';
import { GlassCard } from './GlassCard';
import type { YieldInfo } from '../types';

interface Props {
  yieldInfo: YieldInfo | null;
  onHarvest: () => void;
}

export function YieldCard({ yieldInfo, onHarvest }: Props) {
  const formatBTC = (value: bigint | undefined) => {
    if (!value) return '0.00000000';
    return (Number(value) / 1e8).toFixed(8);
  };

  if (!yieldInfo || yieldInfo.pendingYield === 0n) {
    return (
      <GlassCard style={styles.container}>
        <Text style={styles.title}>Yield Earnings</Text>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>%</Text>
          </View>
          <Text style={styles.emptyText}>No yield deposits</Text>
          <Text style={styles.emptySubtext}>
            Deposit wBTC to start earning yield through Vesu
          </Text>
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Yield Earnings</Text>
        <View style={styles.apyBadge}>
          <Text style={styles.apyText}>{(yieldInfo.apy / 100).toFixed(2)}% APY</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.label}>Total Deposited</Text>
          <Text style={styles.value}>{formatBTC(yieldInfo.deposited)}</Text>
          <Text style={styles.unit}>wBTC</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.label}>Total Earned</Text>
          <Text style={[styles.value, styles.earned]}>
            +{formatBTC(yieldInfo.cumulativeYield)}
          </Text>
          <Text style={styles.unit}>wBTC</Text>
        </View>
      </View>

      <View style={styles.pendingSection}>
        <View style={styles.pendingInfo}>
          <Text style={styles.pendingLabel}>Pending Yield</Text>
          <Text style={styles.pendingValue}>
            {formatBTC(yieldInfo.pendingYield)} wBTC
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.harvestButton,
            yieldInfo.pendingYield === 0n && styles.harvestButtonDisabled
          ]}
          onPress={onHarvest}
          disabled={yieldInfo.pendingYield === 0n}
          activeOpacity={0.8}
        >
          <Text style={styles.harvestButtonText}>Harvest</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  apyBadge: {
    backgroundColor: COLORS.secondary + '20',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.secondary + '40',
  },
  apyText: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 36,
    color: COLORS.secondary,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  unit: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  earned: {
    color: COLORS.secondary,
  },
  pendingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  pendingValue: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  harvestButton: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  harvestButtonDisabled: {
    backgroundColor: COLORS.surfaceLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  harvestButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '700',
  },
});
