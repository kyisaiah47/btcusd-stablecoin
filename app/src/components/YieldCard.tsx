/**
 * Yield Card Component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useHarvestYield } from '@/hooks/useYield';
import type { FormattedYieldInfo } from '@/types';

interface YieldCardProps {
  yieldInfo: FormattedYieldInfo | null;
}

export function YieldCard({ yieldInfo }: YieldCardProps) {
  const { harvest, loading } = useHarvestYield();

  const handleHarvest = async () => {
    await harvest();
  };

  if (!yieldInfo) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Yield Earnings</Text>
        <Text style={styles.emptyText}>Deposit collateral to start earning</Text>
      </View>
    );
  }

  const hasYield = parseFloat(yieldInfo.userClaimable) > 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Yield Earnings</Text>
        <View style={styles.apyBadge}>
          <Text style={styles.apyText}>{yieldInfo.apy} APY</Text>
        </View>
      </View>

      {/* Main Yield Display */}
      <View style={styles.yieldDisplay}>
        <Text style={styles.yieldAmount}>{yieldInfo.earnedYieldUSD}</Text>
        <Text style={styles.yieldSubtext}>
          {yieldInfo.earnedYield} wBTC earned
        </Text>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdown}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Your share (70%)</Text>
          <Text style={styles.breakdownValue}>{yieldInfo.userClaimable} wBTC</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Protocol fee (30%)</Text>
          <Text style={styles.breakdownValue}>{yieldInfo.protocolFee} wBTC</Text>
        </View>
      </View>

      {/* Harvest Button */}
      <TouchableOpacity
        style={[styles.harvestButton, !hasYield && styles.harvestButtonDisabled]}
        onPress={handleHarvest}
        disabled={loading || !hasYield}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.harvestButtonText}>
            {hasYield ? 'Harvest Yield' : 'No Yield to Harvest'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Info */}
      <Text style={styles.infoText}>
        Yield is generated from Vesu lending pools. 70% goes to you, 30% to the protocol.
      </Text>
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
  apyBadge: {
    backgroundColor: '#1A3A1A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A5A2A',
  },
  apyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
  },
  yieldDisplay: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    marginBottom: 16,
  },
  yieldAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#00D4AA',
    letterSpacing: -1,
  },
  yieldSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  breakdown: {
    gap: 8,
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#888',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  harvestButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  harvestButtonDisabled: {
    backgroundColor: '#333',
  },
  harvestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginVertical: 30,
  },
});
