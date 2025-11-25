/**
 * Position Card Component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { FormattedPosition } from '@/types';

interface PositionCardProps {
  position: FormattedPosition | null;
  health: {
    isHealthy: boolean;
    isLiquidatable: boolean;
    warningLevel: 'none' | 'warning' | 'danger';
    ratio?: number;
  };
}

export function PositionCard({ position, health }: PositionCardProps) {
  if (!position) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Your Position</Text>
        <Text style={styles.emptyText}>No active position</Text>
        <Text style={styles.hintText}>Deposit wBTC to get started</Text>
      </View>
    );
  }

  const ratioColor =
    health.warningLevel === 'danger'
      ? '#FF5722'
      : health.warningLevel === 'warning'
      ? '#FFC107'
      : '#4CAF50';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Position</Text>
        {health.warningLevel !== 'none' && (
          <View style={[styles.badge, { backgroundColor: ratioColor }]}>
            <Text style={styles.badgeText}>
              {health.isLiquidatable ? 'LIQUIDATABLE' : 'AT RISK'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Collateral</Text>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{position.collateral} wBTC</Text>
          <Text style={styles.subValue}>{position.collateralUSD}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Debt</Text>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>${position.debt}</Text>
          <Text style={styles.subValue}>BTCUSD</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Collateral Ratio</Text>
        <Text style={[styles.value, { color: ratioColor }]}>{position.collateralRatio}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Liquidation Price</Text>
        <Text style={styles.value}>{position.liquidationPrice}</Text>
      </View>

      {/* Health Bar */}
      <View style={styles.healthBar}>
        <View style={styles.healthTrack}>
          <View
            style={[
              styles.healthFill,
              {
                width: `${Math.min(100, health.ratio ? (health.ratio / 200) * 100 : 0)}%`,
                backgroundColor: ratioColor,
              },
            ]}
          />
        </View>
        <View style={styles.healthLabels}>
          <Text style={styles.healthLabel}>120% Liq</Text>
          <Text style={styles.healthLabel}>150% Min</Text>
          <Text style={styles.healthLabel}>200%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#888',
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  subValue: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 12,
  },
  healthBar: {
    marginTop: 16,
  },
  healthTrack: {
    height: 8,
    backgroundColor: '#222',
    borderRadius: 4,
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    borderRadius: 4,
  },
  healthLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  healthLabel: {
    fontSize: 10,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  hintText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
});
