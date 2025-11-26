/**
 * Transaction Button Component
 *
 * A reusable button for blockchain transactions with loading states,
 * confirmation dialogs, and transaction status feedback.
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Alert,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS } from '../constants';
import { useStore } from '../store';

export type TransactionStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

export interface TransactionButtonProps {
  // Content
  label: string;
  loadingLabel?: string;
  successLabel?: string;

  // Action
  onPress: () => Promise<string | void>; // Returns tx hash on success
  onSuccess?: (txHash?: string) => void;
  onError?: (error: Error) => void;

  // Confirmation
  confirmTitle?: string;
  confirmMessage?: string;
  showConfirm?: boolean;

  // Styling
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function TransactionButton({
  label,
  loadingLabel = 'Processing...',
  successLabel = 'Success!',
  onPress,
  onSuccess,
  onError,
  confirmTitle,
  confirmMessage,
  showConfirm = false,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
}: TransactionButtonProps) {
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const { wallet, addTransaction, updateTransaction } = useStore();

  // Get button colors based on variant
  const getVariantColors = () => {
    switch (variant) {
      case 'secondary':
        return { bg: COLORS.secondary, text: COLORS.text };
      case 'success':
        return { bg: COLORS.success, text: COLORS.text };
      case 'warning':
        return { bg: COLORS.warning, text: COLORS.background };
      case 'danger':
        return { bg: COLORS.danger, text: COLORS.text };
      default:
        return { bg: COLORS.primary, text: COLORS.text };
    }
  };

  // Get button size styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 10, paddingHorizontal: 16, fontSize: 14 };
      case 'large':
        return { paddingVertical: 18, paddingHorizontal: 32, fontSize: 18 };
      default:
        return { paddingVertical: 14, paddingHorizontal: 24, fontSize: 16 };
    }
  };

  const colors = getVariantColors();
  const sizeStyles = getSizeStyles();

  // Handle button press
  const handlePress = async () => {
    if (disabled || status === 'pending' || status === 'confirming') return;

    // Check wallet connection
    if (!wallet.isConnected || !wallet.address) {
      Alert.alert('Wallet Not Connected', 'Please connect your wallet first');
      return;
    }

    // Show confirmation dialog if needed
    if (showConfirm) {
      Alert.alert(
        confirmTitle || 'Confirm Transaction',
        confirmMessage || 'Are you sure you want to proceed?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: executeTransaction },
        ]
      );
    } else {
      executeTransaction();
    }
  };

  // Execute the transaction
  const executeTransaction = async () => {
    setStatus('pending');

    try {
      // Execute the transaction
      const result = await onPress();
      const txHash = typeof result === 'string' ? result : undefined;

      // Add to transaction history
      if (txHash) {
        addTransaction({
          hash: txHash,
          type: 'unknown',
          status: 'pending',
          timestamp: Date.now(),
        });
      }

      // Wait for confirmation simulation
      setStatus('confirming');
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Success
      setStatus('success');

      if (txHash) {
        updateTransaction(txHash, 'confirmed');
      }

      if (onSuccess) {
        onSuccess(txHash);
      }

      // Reset after showing success
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('error');

      const error = err instanceof Error ? err : new Error('Transaction failed');

      if (onError) {
        onError(error);
      } else {
        Alert.alert('Transaction Failed', error.message);
      }

      // Reset after showing error
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  // Get current label based on status
  const getCurrentLabel = () => {
    switch (status) {
      case 'pending':
      case 'confirming':
        return loadingLabel;
      case 'success':
        return successLabel;
      case 'error':
        return 'Failed';
      default:
        return label;
    }
  };

  // Get status color
  const getStatusBgColor = () => {
    switch (status) {
      case 'success':
        return COLORS.success;
      case 'error':
        return COLORS.danger;
      default:
        return colors.bg;
    }
  };

  const isDisabled = disabled || status === 'pending' || status === 'confirming';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: isDisabled ? COLORS.surfaceLight : getStatusBgColor(),
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {(status === 'pending' || status === 'confirming') && (
          <ActivityIndicator
            color={colors.text}
            size="small"
            style={styles.spinner}
          />
        )}
        <Text
          style={[
            styles.label,
            { color: isDisabled ? COLORS.textSecondary : colors.text },
            { fontSize: sizeStyles.fontSize },
            textStyle,
          ]}
        >
          {getCurrentLabel()}
        </Text>
        {status === 'success' && <Text style={styles.checkmark}>  </Text>}
      </View>

      {status === 'confirming' && (
        <View style={styles.confirmingBar}>
          <View style={styles.confirmingProgress} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  label: {
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 16,
  },
  confirmingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  confirmingProgress: {
    height: '100%',
    width: '60%',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});
