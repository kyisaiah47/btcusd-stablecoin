/**
 * Contract addresses for different networks
 */

import type { ContractAddresses } from '@/types';

// Starknet Sepolia (testnet)
export const SEPOLIA_ADDRESSES: ContractAddresses = {
  vault: '0x0', // TODO: Deploy and update
  btcusdToken: '0x0',
  wbtc: '0x0',
  oracle: '0x0',
  yieldManager: '0x0',
};

// Starknet Mainnet
export const MAINNET_ADDRESSES: ContractAddresses = {
  vault: '0x0', // TODO: Deploy and update
  btcusdToken: '0x0',
  wbtc: '0x0',
  oracle: '0x0',
  yieldManager: '0x0',
};

// Development (local devnet)
export const DEVNET_ADDRESSES: ContractAddresses = {
  vault: '0x0',
  btcusdToken: '0x0',
  wbtc: '0x0',
  oracle: '0x0',
  yieldManager: '0x0',
};

// Get addresses for current network
export function getAddresses(chainId: string): ContractAddresses {
  switch (chainId) {
    case 'SN_MAIN':
      return MAINNET_ADDRESSES;
    case 'SN_SEPOLIA':
      return SEPOLIA_ADDRESSES;
    default:
      return DEVNET_ADDRESSES;
  }
}

// Network configuration
export const NETWORKS = {
  mainnet: {
    name: 'Starknet Mainnet',
    chainId: 'SN_MAIN',
    rpcUrl: 'https://starknet-mainnet.public.blastapi.io',
    explorerUrl: 'https://starkscan.co',
  },
  sepolia: {
    name: 'Starknet Sepolia',
    chainId: 'SN_SEPOLIA',
    rpcUrl: 'https://starknet-sepolia.public.blastapi.io',
    explorerUrl: 'https://sepolia.starkscan.co',
  },
} as const;

export type NetworkKey = keyof typeof NETWORKS;

export const DEFAULT_NETWORK: NetworkKey = 'sepolia';
