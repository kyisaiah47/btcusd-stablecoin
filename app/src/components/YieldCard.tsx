/**
 * Yield Card Component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants';
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
      <View style={styles.card}>
        <Text style={styles.title}>Yield Earnings</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📈</Text>
          <Text style={styles.emptyText}>No yield deposits</Text>
          <Text style={styles.emptySubtext}>
            Deposit wBTC to start earning yield through Vesu
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Yield Earnings</Text>
        <View style={styles.apyBadge}>
          <Text style={styles.apyText}>{(yieldInfo.apy / 100).toFixed(2)}% APY</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.label}>Pending Yield</Text>
          <Text style={styles.value}>{formatBTC(yieldInfo.pendingYield)} wBTC</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>Total Earned</Text>
          <Text style={[styles.value, styles.earned]}>
            +{formatBTC(yieldInfo.cumulativeYield)} wBTC
          </Text>
        </View>
      </View>

      <View style={styles.pendingSection}>
        <View style={styles.pendingInfo}>
          <Text style={styles.label}>Pending Yield</Text>
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
        >
          <Text style={styles.harvestButtonText}>Harvest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  apyBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  apyText: {
    color: COLORS.success,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stat: {
    flex: 1,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  earned: {
    color: COLORS.success,
  },
  pendingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingValue: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  harvestButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  harvestButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  harvestButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
