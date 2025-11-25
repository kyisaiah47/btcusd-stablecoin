/**
 * BTCUSD - Bitcoin-Backed Stablecoin App
 * Built for Starknet Re{Solve} Hackathon
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Dashboard } from './src/screens/Dashboard';
import { useStore } from './src/store';

export default function App() {
  const { setPrice } = useStore();

  useEffect(() => {
    // Set demo price on load
    setPrice({
      btcPrice: 9500000000000n, // $95,000
      timestamp: Math.floor(Date.now() / 1000),
      isStale: false,
      source: 'demo',
    });
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Dashboard />
    </>
  );
}
