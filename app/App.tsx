/**
 * BTCUSD - Bitcoin-Backed Stablecoin App
 * Built for Starknet Re{Solve} Hackathon
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Dashboard } from './src/screens/Dashboard';
import { useStore } from './src/store';

export default function App() {
  const { refreshPrice, setPrice } = useStore();

  useEffect(() => {
    // Try to fetch real price from oracle
    refreshPrice().catch(() => {
      // Fallback to demo price if oracle fails
      console.log('Using demo price');
      setPrice({
        btcPrice: 9500000000000n, // $95,000
        timestamp: Math.floor(Date.now() / 1000),
        isStale: false,
        source: 'demo',
      });
    });

    // Refresh price every 60 seconds
    const interval = setInterval(() => {
      refreshPrice().catch(console.error);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Dashboard />
    </>
  );
}
