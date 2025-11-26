/**
 * Position Card Component
 *
 * Displays user's vault position with glassmorphism styling.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';
import { GlassCard } from './GlassCard';
import type { Position } from '../types';

interface Props {
  position: Position | null;
  btcPrice: bigint | null;
}

export function PositionCard({ position, btcPrice }: Props) {
  const formatBTC = (value: bigint) => {
    return (Number(value) / 1e8).toFixed(6);
  };

  const formatUSD = (value: bigint) => {
    return (Number(value) / 1e18).toFixed(2);
  };

  const getHealthColor = (healthFactor: number | bigint) => {
    const hf = typeof healthFactor === 'bigint' ? Number(healthFactor) / 10000 : healthFactor;
    if (hf >= 2) return COLORS.success;
    if (hf >= 1.5) return COLORS.warning;
    return COLORS.danger;
  };

  const formatHealthFactor = (hf: bigint | number) => {
    if (typeof hf === 'bigint') {
      return (Number(hf) / 10000).toFixed(2);
    }
    return hf.toFixed(2);
  };

  if (!position || position.collateral === 0n) {
    return (
      <GlassCard style={styles.container}>
        <Text style={styles.title}>Your Position</Text>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>₿</Text>
          </View>
          <Text style={styles.emptyText}>No active position</Text>
          <Text style={styles.emptySubtext}>
            Deposit wBTC collateral to mint BTCUSD stablecoin
          </Text>
        </View>
      </GlassCard>
    );
  }

  const collateralUSD = btcPrice
    ? (Number(position.collateral) * Number(btcPrice)) / (1e8 * 1e8)
    : 0;

  return (
    <GlassCard style={styles.container}>
      <Text style={styles.title}>Your Position</Text>

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.label}>Collateral</Text>
          <Text style={styles.value}>{formatBTC(position.collateral)}</Text>
          <Text style={styles.unit}>wBTC</Text>
          <Text style={styles.subvalue}>${collateralUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.label}>Debt</Text>
          <Text style={styles.value}>{formatUSD(position.debt)}</Text>
          <Text style={styles.unit}>BTCUSD</Text>
        </View>
      </View>

      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <Text style={styles.healthLabel}>Health Factor</Text>
          <Text style={[styles.healthValue, { color: getHealthColor(position.healthFactor) }]}>
            {formatHealthFactor(position.healthFactor)}
          </Text>
        </View>
        <View style={styles.healthBar}>
          <View
            style={[
              styles.healthFill,
              {
                width: `${Math.min(Number(position.healthFactor) / 30000 * 100, 100)}%`,
                backgroundColor: getHealthColor(position.healthFactor)
              }
            ]}
          />
        </View>
        <Text style={styles.healthNote}>
          {Number(position.healthFactor) >= 15000
            ? 'Your position is healthy'
            : Number(position.healthFactor) >= 12000
            ? 'Consider adding collateral'
            : 'Liquidation risk!'}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statBoxLabel}>Collateral Ratio</Text>
          <Text style={styles.statBoxValue}>{(position.collateralRatio / 100).toFixed(1)}%</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxLabel}>Liquidation Price</Text>
          <Text style={styles.statBoxValue}>${(Number(position.liquidationPrice) / 1e8).toLocaleString()}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
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
    color: COLORS.primary,
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
    fontSize: 28,
    fontWeight: '700',
  },
  unit: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  subvalue: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  healthSection: {
    backgroundColor: COLORS.glass,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  healthLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  healthValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  healthBar: {
    height: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  healthFill: {
    height: '100%',
    borderRadius: 3,
  },
  healthNote: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.glass,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  statBoxLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statBoxValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
