/**
 * Position Card Component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, PROTOCOL } from '../constants';
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

  const getHealthColor = (healthFactor: number) => {
    if (healthFactor >= 2) return COLORS.success;
    if (healthFactor >= 1.5) return COLORS.warning;
    return COLORS.danger;
  };

  if (!position || position.collateral === 0n) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Your Position</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>₿</Text>
          <Text style={styles.emptyText}>No active position</Text>
          <Text style={styles.emptySubtext}>
            Deposit wBTC collateral to mint BTCUSD stablecoin
          </Text>
        </View>
      </View>
    );
  }

  const collateralUSD = btcPrice
    ? (Number(position.collateral) * Number(btcPrice)) / (1e8 * 1e8)
    : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your Position</Text>

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.label}>Collateral</Text>
          <Text style={styles.value}>{formatBTC(position.collateral)} wBTC</Text>
          <Text style={styles.subvalue}>${collateralUSD.toFixed(2)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>Debt</Text>
          <Text style={styles.value}>{formatUSD(position.debt)} BTCUSD</Text>
        </View>
      </View>

      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <Text style={styles.label}>Health Factor</Text>
          <Text style={[styles.healthValue, { color: getHealthColor(position.healthFactor) }]}>
            {position.healthFactor.toFixed(2)}
          </Text>
        </View>
        <View style={styles.healthBar}>
          <View
            style={[
              styles.healthFill,
              {
                width: `${Math.min(position.healthFactor / 3 * 100, 100)}%`,
                backgroundColor: getHealthColor(position.healthFactor)
              }
            ]}
          />
        </View>
        <Text style={styles.healthNote}>
          {position.healthFactor >= 1.5
            ? 'Your position is healthy'
            : position.healthFactor >= 1.2
            ? '⚠️ Consider adding collateral'
            : '🚨 Liquidation risk!'}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.label}>Collateral Ratio</Text>
          <Text style={styles.value}>{(position.collateralRatio / 100).toFixed(1)}%</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>Max Borrowable</Text>
          <Text style={styles.value}>{formatUSD(position.maxBorrowable)} BTCUSD</Text>
        </View>
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
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
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
  subvalue: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  healthSection: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  healthBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  healthFill: {
    height: '100%',
    borderRadius: 4,
  },
  healthNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});
