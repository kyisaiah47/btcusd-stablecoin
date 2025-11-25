/**
 * Starknet provider and connection utilities
 */

import { RpcProvider, Account, Contract, Call, InvocationsSignerDetails } from 'starknet';
import { NETWORKS, NetworkKey, DEFAULT_NETWORK, getAddresses } from '@/constants/addresses';
import type { ContractAddresses } from '@/types';

// ABIs will be generated from contract compilation
// For now, define minimal ABIs for the interfaces we need
import { VAULT_ABI, TOKEN_ABI, ORACLE_ABI, YIELD_MANAGER_ABI } from '@/constants/abis';

let provider: RpcProvider | null = null;
let currentNetwork: NetworkKey = DEFAULT_NETWORK;

/**
 * Initialize Starknet provider
 */
export function initProvider(network: NetworkKey = DEFAULT_NETWORK): RpcProvider {
  currentNetwork = network;
  const networkConfig = NETWORKS[network];
  provider = new RpcProvider({ nodeUrl: networkConfig.rpcUrl });
  return provider;
}

/**
 * Get current provider (initializes if needed)
 */
export function getProvider(): RpcProvider {
  if (!provider) {
    return initProvider();
  }
  return provider;
}

/**
 * Get current network config
 */
export function getCurrentNetwork() {
  return NETWORKS[currentNetwork];
}

/**
 * Get contract addresses for current network
 */
export function getContractAddresses(): ContractAddresses {
  return getAddresses(getCurrentNetwork().chainId);
}

/**
 * Create contract instances
 */
export function createContracts(account?: Account) {
  const p = getProvider();
  const addresses = getContractAddresses();

  const vault = new Contract(VAULT_ABI, addresses.vault, account || p);
  const btcusdToken = new Contract(TOKEN_ABI, addresses.btcusdToken, account || p);
  const wbtc = new Contract(TOKEN_ABI, addresses.wbtc, account || p);
  const oracle = new Contract(ORACLE_ABI, addresses.oracle, account || p);
  const yieldManager = new Contract(YIELD_MANAGER_ABI, addresses.yieldManager, account || p);

  return { vault, btcusdToken, wbtc, oracle, yieldManager };
}

/**
 * Execute multiple calls in a single transaction
 */
export async function multicall(
  account: Account,
  calls: Call[]
): Promise<string> {
  const response = await account.execute(calls);
  await getProvider().waitForTransaction(response.transaction_hash);
  return response.transaction_hash;
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(txHash: string) {
  const receipt = await getProvider().getTransactionReceipt(txHash);
  return receipt;
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(txHash: string, timeoutMs: number = 60000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const receipt = await getProvider().getTransactionReceipt(txHash);
      if (receipt.execution_status === 'SUCCEEDED') {
        return receipt;
      }
      if (receipt.execution_status === 'REVERTED') {
        throw new Error('Transaction reverted');
      }
    } catch (e) {
      // Transaction not found yet, keep waiting
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Transaction timeout');
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerUrl(txHash: string): string {
  const network = getCurrentNetwork();
  return `${network.explorerUrl}/tx/${txHash}`;
}

/**
 * Get explorer URL for address
 */
export function getAddressExplorerUrl(address: string): string {
  const network = getCurrentNetwork();
  return `${network.explorerUrl}/contract/${address}`;
}
