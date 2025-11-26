/**
 * Contract Addresses for BTCUSD Protocol
 *
 * These are the deployed contract addresses on Starknet Sepolia testnet.
 * Update these addresses after each deployment.
 */

/**
 * Sepolia Testnet Addresses
 */
export const SEPOLIA_ADDRESSES = {
  // Core protocol contracts
  VAULT: '0x05d8736f22d6eb6b347ec1ee9b8f7cf093057610ed394dd54593c7c93757a6c1',
  TOKEN: '0x01cacb0278219b58914ea2a02695a7288f3b4f4a4fdf7911f56f21a1c3095345',
  ORACLE: '0x0198de7b85d16fa058a9d9736d2243a6e50478105008f5482ad8e8c4fa0aa13e',
  WBTC: '0x034127ccbb52ed9ab742db89fdb6d261833e118dd5aa1c69f54258553388f6fb',

  // Yield management
  YIELD_MANAGER: '0x07fe41efd9c731c25610f7d9d28d0de8ec4e46695155354845da1c9b7fef94b8', // MockYieldManager (Stage 1)
  VESU_YIELD_MANAGER: '0x050079ad8253da45dc0ab0c724c85cd07198b230e0cd7d123b8bd6520ce879f0', // VesuYieldManager (Stage 3)

  // Liquidation
  LIQUIDATOR: '0x047920e18d296dd5f5da36613a83e3b9badc019cb4e0d59f5fae8af2bae9141c',

  // External protocols (Vesu on Sepolia)
  VESU_SINGLETON: '0x2110b3cde727cd34407e257e1070857a06010cf02a14b1ee181612fb1b61c30',
} as const;

/**
 * Mainnet Addresses (placeholder - not yet deployed)
 */
export const MAINNET_ADDRESSES = {
  VAULT: '',
  TOKEN: '',
  ORACLE: '',
  WBTC: '',
  YIELD_MANAGER: '',
  VESU_YIELD_MANAGER: '',
  LIQUIDATOR: '',
  VESU_SINGLETON: '',
} as const;

/**
 * Vesu Protocol Pool IDs
 */
export const VESU_POOLS = {
  SEPOLIA_WBTC: '566154675190438152544449762131613456939576463701265245209877893089848934391',
  MAINNET_WBTC: '', // Not yet available
} as const;

/**
 * Network Configuration
 */
export const NETWORKS = {
  SEPOLIA: {
    chainId: 'SN_SEPOLIA',
    name: 'Starknet Sepolia',
    rpcUrl: 'https://starknet-sepolia.public.blastapi.io',
    explorerUrl: 'https://sepolia.starkscan.co',
    addresses: SEPOLIA_ADDRESSES,
  },
  MAINNET: {
    chainId: 'SN_MAIN',
    name: 'Starknet Mainnet',
    rpcUrl: 'https://starknet-mainnet.public.blastapi.io',
    explorerUrl: 'https://starkscan.co',
    addresses: MAINNET_ADDRESSES,
  },
} as const;

/**
 * Get addresses for current network
 */
export function getAddresses(network: 'SEPOLIA' | 'MAINNET' = 'SEPOLIA') {
  return NETWORKS[network].addresses;
}

/**
 * Get explorer URL for a contract
 */
export function getExplorerUrl(address: string, network: 'SEPOLIA' | 'MAINNET' = 'SEPOLIA') {
  return `${NETWORKS[network].explorerUrl}/contract/${address}`;
}

/**
 * Get explorer URL for a transaction
 */
export function getTxExplorerUrl(txHash: string, network: 'SEPOLIA' | 'MAINNET' = 'SEPOLIA') {
  return `${NETWORKS[network].explorerUrl}/tx/${txHash}`;
}
