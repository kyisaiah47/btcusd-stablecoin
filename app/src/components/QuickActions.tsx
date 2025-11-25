/**
 * Quick Actions Component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants';

interface Action {
  id: string;
  label: string;
  icon: string;
  color: string;
}

interface Props {
  onAction: (actionId: string) => void;
}

const actions: Action[] = [
  { id: 'deposit', label: 'Deposit', icon: '⬇️', color: COLORS.success },
  { id: 'withdraw', label: 'Withdraw', icon: '⬆️', color: COLORS.warning },
  { id: 'mint', label: 'Mint', icon: '🪙', color: COLORS.primary },
  { id: 'burn', label: 'Repay', icon: '🔥', color: COLORS.danger },
];

export function QuickActions({ onAction }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionButton}
            onPress={() => onAction(action.id)}
          >
            <View style={[styles.iconContainer, { backgroundColor: action.color + '20' }]}>
              <Text style={styles.icon}>{action.icon}</Text>
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
  actionsRow: {
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
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
  },
  actionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
});
