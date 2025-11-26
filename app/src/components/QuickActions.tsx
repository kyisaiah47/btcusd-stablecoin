/**
 * Quick Actions Component
 *
 * Action buttons with modern pill-style design.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants';
import { GlassCard } from './GlassCard';

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
  { id: 'faucet', label: 'Faucet', icon: '💧', color: COLORS.secondary },
  { id: 'deposit', label: 'Deposit', icon: '+', color: COLORS.primary },
  { id: 'mint', label: 'Mint', icon: '$', color: COLORS.accent },
  { id: 'withdraw', label: 'Withdraw', icon: '−', color: COLORS.textSecondary },
];

export function QuickActions({ onAction }: Props) {
  return (
    <GlassCard style={styles.container}>
      <Text style={styles.title}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionButton}
            onPress={() => onAction(action.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: action.color + '20' }]}>
              <Text style={[styles.icon, { color: action.color }]}>{action.icon}</Text>
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  icon: {
    fontSize: 24,
    fontWeight: '600',
  },
  actionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
});
