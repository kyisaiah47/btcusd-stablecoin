import { Contract, RpcProvider, Account, CallData, stark } from 'starknet';

// Starknet configuration
export const STARKNET_CONFIG = {
  RPC_URL: 'https://starknet-mainnet.public.blastapi.io',
  CHAIN_ID: stark.StarknetChainId.SN_MAIN,
};

// Contract addresses (replace with actual deployed addresses)
export const CONTRACT_ADDRESSES = {
  BTCUSD_VAULT: '0x0123456789abcdef...',
  BTCUSD_TOKEN: '0x0234567890abcdef...',
  WBTC_TOKEN: '0x0345678901abcdef...',
  YIELD_MANAGER: '0x0456789012abcdef...',
  ATOMIQ_ADAPTER: '0x0567890123abcdef...',
  VESU_HOOK: '0x0678901234abcdef...',
};

// Contract ABIs (simplified - replace with actual ABIs)
export const VAULT_ABI = [
  {
    name: 'deposit_and_mint',
    type: 'function',
    inputs: [{ name: 'wbtc_amount', type: 'core::integer::u256' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'external',
  },
  {
    name: 'repay_and_withdraw',
    type: 'function',
    inputs: [{ name: 'btcusd_amount', type: 'core::integer::u256' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'external',
  },
  {
    name: 'get_position',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'btcusd_vault::Position' }],
    state_mutability: 'view',
  },
  {
    name: 'get_collateral_ratio',
    type: 'function',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
];

export const TOKEN_ABI = [
  {
    name: 'balance_of',
    type: 'function',
    inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' }
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'external',
  },
];

export const YIELD_MANAGER_ABI = [
  {
    name: 'harvest_yield',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'external',
  },
  {
    name: 'get_current_yield',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
];

// Initialize provider
export const provider = new RpcProvider({
  nodeUrl: STARKNET_CONFIG.RPC_URL,
});

// Contract instances
export const getVaultContract = (account) => {
  return new Contract(VAULT_ABI, CONTRACT_ADDRESSES.BTCUSD_VAULT, account || provider);
};

export const getTokenContract = (tokenAddress, account) => {
  return new Contract(TOKEN_ABI, tokenAddress, account || provider);
};

export const getYieldManagerContract = (account) => {
  return new Contract(YIELD_MANAGER_ABI, CONTRACT_ADDRESSES.YIELD_MANAGER, account || provider);
};

// Utility functions
export const formatTokenAmount = (amount, decimals = 18) => {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  const remainderStr = remainder.toString().padStart(decimals, '0');
  return `${whole}.${remainderStr.slice(0, 6)}`;
};

export const parseTokenAmount = (amount, decimals = 18) => {
  const [whole, decimal = '0'] = amount.toString().split('.');
  const paddedDecimal = decimal.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedDecimal);
};

// Transaction helper
export const executeTransaction = async (contract, method, params = [], account) => {
  try {
    const call = contract.populate(method, params);
    const { transaction_hash } = await account.execute(call);

    // Wait for transaction confirmation
    const receipt = await provider.waitForTransaction(transaction_hash);
    return { success: true, transactionHash: transaction_hash, receipt };
  } catch (error) {
    console.error('Transaction failed:', error);
    return { success: false, error: error.message };
  }
};

// Wallet connection helpers
export const connectBraavosWallet = async () => {
  try {
    // This is a mock implementation
    // In production, you would integrate with the actual Braavos wallet SDK

    // Check if Braavos is available
    if (typeof window !== 'undefined' && window.starknet) {
      const starknet = window.starknet;

      // Request wallet connection
      await starknet.enable();

      // Get the account
      const account = new Account(
        provider,
        starknet.selectedAddress,
        starknet.signer
      );

      return {
        success: true,
        account,
        address: starknet.selectedAddress,
      };
    } else {
      throw new Error('Braavos wallet not detected');
    }
  } catch (error) {
    console.error('Wallet connection failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Price calculation helpers
export const calculateMintAmount = (btcAmount, btcPrice = 65000, ltvRatio = 0.6667) => {
  const collateralValue = parseFloat(btcAmount) * btcPrice;
  return collateralValue * ltvRatio;
};

export const calculateCollateralRatio = (collateralAmount, debtAmount, btcPrice = 65000) => {
  if (debtAmount === 0) return Infinity;
  const collateralValue = parseFloat(collateralAmount) * btcPrice;
  return (collateralValue / parseFloat(debtAmount)) * 100;
};

export const calculateLiquidationPrice = (collateralAmount, debtAmount, liquidationThreshold = 120) => {
  if (parseFloat(collateralAmount) === 0) return 0;
  return (parseFloat(debtAmount) * liquidationThreshold / 100) / parseFloat(collateralAmount);
};

// Error handling
export const handleStarknetError = (error) => {
  if (error.message.includes('User rejected')) {
    return 'Transaction cancelled by user';
  } else if (error.message.includes('insufficient')) {
    return 'Insufficient balance';
  } else if (error.message.includes('revert')) {
    return 'Transaction reverted - please check your inputs';
  } else {
    return 'Transaction failed - please try again';
  }
};