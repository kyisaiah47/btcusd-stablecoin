/**
 * Dashboard Screen - Main view showing position and yield
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFormattedPosition, usePositionHealth } from '@/hooks/usePosition';
import { useFormattedYield } from '@/hooks/useYield';
import { useWallet } from '@/store';
import { PositionCard } from '@/components/PositionCard';
import { YieldCard } from '@/components/YieldCard';
import { QuickActions } from '@/components/QuickActions';

export function DashboardScreen() {
  const wallet = useWallet();
  const position = useFormattedPosition();
  const yieldInfo = useFormattedYield();
  const health = usePositionHealth();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    // Refresh data
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  if (!wallet.connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Connect your wallet to view dashboard</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
      }
    >
      {/* Position Overview */}
      <PositionCard position={position} health={health} />

      {/* Yield Overview */}
      <YieldCard yieldInfo={yieldInfo} />

      {/* Quick Actions */}
      <QuickActions />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  message: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
});
