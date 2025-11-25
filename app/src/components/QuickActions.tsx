/**
 * Quick Actions Component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export function QuickActions() {
  const navigation = useNavigation<any>();

  const actions = [
    {
      id: 'deposit',
      label: 'Deposit',
      icon: '+',
      color: '#4CAF50',
      onPress: () => navigation.navigate('Deposit'),
    },
    {
      id: 'withdraw',
      label: 'Withdraw',
      icon: '-',
      color: '#FF9800',
      onPress: () => navigation.navigate('Withdraw'),
    },
    {
      id: 'mint',
      label: 'Mint',
      icon: '$',
      color: '#2196F3',
      onPress: () => navigation.navigate('Mint'),
    },
    {
      id: 'burn',
      label: 'Repay',
      icon: '×',
      color: '#9C27B0',
      onPress: () => navigation.navigate('Burn'),
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Actions</Text>
      <View style={styles.grid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionButton}
            onPress={action.onPress}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${action.color}20` }]}>
              <Text style={[styles.icon, { color: action.color }]}>{action.icon}</Text>
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
    fontWeight: '700',
  },
  actionLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
});
