/**
 * GlassCard Component
 *
 * A reusable glassmorphism-style card with REAL blur effect.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS } from '../constants';

interface Props {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'glow';
  glowColor?: string;
  style?: ViewStyle;
  padding?: 'none' | 'small' | 'medium' | 'large';
  intensity?: number;
}

export function GlassCard({
  children,
  variant = 'default',
  glowColor = COLORS.primary,
  style,
  padding = 'medium',
  intensity = 25,
}: Props) {
  const paddingValue = {
    none: 0,
    small: 12,
    medium: 20,
    large: 28,
  }[padding];

  // Use BlurView for iOS/Android, fallback for web
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.card,
          styles.webGlass,
          variant === 'elevated' && styles.elevated,
          variant === 'glow' && [styles.glow, { shadowColor: glowColor }],
          { padding: paddingValue },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.cardOuter,
        variant === 'elevated' && styles.elevated,
        variant === 'glow' && [styles.glow, { shadowColor: glowColor }],
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[styles.blurView, { padding: paddingValue }]}
      >
        <View style={styles.innerOverlay}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  blurView: {
    overflow: 'hidden',
  },
  innerOverlay: {
    // Slight white overlay for glass effect
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    margin: -20,
    padding: 20,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  // Web fallback with CSS backdrop-filter
  webGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    // @ts-ignore - web-only property
    backdropFilter: 'blur(20px)',
    // @ts-ignore - Safari support
    WebkitBackdropFilter: 'blur(20px)',
  },
  elevated: {
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glow: {
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
});
