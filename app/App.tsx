/**
 * BTCUSD Protocol Mobile App
 *
 * A Bitcoin-backed stablecoin on Starknet
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens
import { DashboardScreen } from '@/screens/Dashboard';

// Initialize Starknet provider
import { initProvider } from '@/services/starknet';
initProvider('sepolia');

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#111',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: '700',
            },
            contentStyle: {
              backgroundColor: '#0A0A0A',
            },
          }}
        >
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{
              title: 'BTCUSD',
              headerLargeTitle: true,
            }}
          />
          {/* Add other screens here */}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
