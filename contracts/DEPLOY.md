# BTCUSD Protocol Deployment Guide

## Prerequisites

1. **Starkli CLI** - Install from [starkli docs](https://book.starkli.rs/)
2. **Scarb** - Install from [scarb docs](https://docs.swmansion.com/scarb/)
3. **Funded Sepolia Account** - Get testnet ETH from [faucet](https://starknet-faucet.vercel.app/)

## Setup Account

If you don't have a Starknet account:

```bash
# Create a new keystore
starkli signer keystore new ~/.starkli-wallets/deployer/keystore.json

# Create account configuration (Argent or Braavos)
starkli account oz init ~/.starkli-wallets/deployer/account.json

# Deploy account (needs ETH from faucet first)
starkli account deploy ~/.starkli-wallets/deployer/account.json \
  --keystore ~/.starkli-wallets/deployer/keystore.json
```

## Build Contracts

```bash
cd contracts
scarb build
```

## Set Environment Variables

```bash
export STARKNET_ACCOUNT=~/.starkli-wallets/deployer/account.json
export STARKNET_KEYSTORE=~/.starkli-wallets/deployer/keystore.json
export STARKNET_RPC=https://starknet-sepolia.public.blastapi.io
```

## Deployment Steps

### Step 1: Declare Contracts

```bash
# Declare MockWBTC
starkli declare target/dev/btcusd_protocol_MockWBTC.contract_class.json
# Save the class hash: WBTC_CLASS_HASH=0x...

# Declare MockOracle
starkli declare target/dev/btcusd_protocol_MockOracle.contract_class.json
# Save the class hash: ORACLE_CLASS_HASH=0x...

# Declare BTCUSDToken
starkli declare target/dev/btcusd_protocol_BTCUSDToken.contract_class.json
# Save the class hash: TOKEN_CLASS_HASH=0x...

# Declare MockYieldManager
starkli declare target/dev/btcusd_protocol_MockYieldManager.contract_class.json
# Save the class hash: YIELD_CLASS_HASH=0x...

# Declare BTCUSDVault
starkli declare target/dev/btcusd_protocol_BTCUSDVault.contract_class.json
# Save the class hash: VAULT_CLASS_HASH=0x...
```

### Step 2: Deploy Contracts

Get your deployer address:
```bash
starkli account address --account $STARKNET_ACCOUNT
# DEPLOYER=0x...
```

Deploy in order:

```bash
# 1. Deploy MockWBTC (owner)
starkli deploy $WBTC_CLASS_HASH $DEPLOYER
# Save: WBTC_ADDRESS=0x...

# 2. Deploy MockOracle (owner, initial_price)
# Initial price: $95,000 = 9500000000000 (8 decimals)
starkli deploy $ORACLE_CLASS_HASH $DEPLOYER 9500000000000
# Save: ORACLE_ADDRESS=0x...

# 3. Deploy BTCUSDToken (owner)
starkli deploy $TOKEN_CLASS_HASH $DEPLOYER
# Save: TOKEN_ADDRESS=0x...

# 4. Deploy MockYieldManager (wbtc_token, owner, yield_rate_bps)
# Yield rate: 5% = 500 basis points
starkli deploy $YIELD_CLASS_HASH $WBTC_ADDRESS $DEPLOYER 500
# Save: YIELD_ADDRESS=0x...

# 5. Deploy BTCUSDVault (owner, wbtc, btcusd, oracle, yield_manager)
starkli deploy $VAULT_CLASS_HASH $DEPLOYER $WBTC_ADDRESS $TOKEN_ADDRESS $ORACLE_ADDRESS $YIELD_ADDRESS
# Save: VAULT_ADDRESS=0x...
```

### Step 3: Configure Contracts

```bash
# Set vault as minter on BTCUSDToken
starkli invoke $TOKEN_ADDRESS set_minter $VAULT_ADDRESS

# Set vault on YieldManager
starkli invoke $YIELD_ADDRESS set_vault $VAULT_ADDRESS
```

### Step 4: Test Deployment

```bash
# Mint test wBTC to your address (1 BTC = 100000000)
starkli invoke $WBTC_ADDRESS mint $DEPLOYER 100000000

# Check balance
starkli call $WBTC_ADDRESS balance_of $DEPLOYER
```

## Contract Addresses (After Deployment)

Update these after deployment:

| Contract | Address |
|----------|---------|
| MockWBTC | `0x...` |
| MockOracle | `0x...` |
| BTCUSDToken | `0x...` |
| MockYieldManager | `0x...` |
| BTCUSDVault | `0x...` |

## Update App Config

After deployment, update `app/src/constants/index.ts`:

```typescript
export const CONTRACTS = {
  VAULT: '0x...',
  TOKEN: '0x...',
  ORACLE: '0x...',
  YIELD_MANAGER: '0x...',
  WBTC: '0x...',
} as const;
```

## Troubleshooting

### "Class already declared"
This is fine - it means the contract class is already on-chain. Just use the returned class hash.

### "Insufficient balance"
Get more testnet ETH from the faucet.

### RPC errors
Try alternate RPCs:
- `https://starknet-sepolia.public.blastapi.io`
- `https://free-rpc.nethermind.io/sepolia-juno`

## Next Steps

1. Test the full flow: deposit wBTC → mint BTCUSD → check position
2. Deploy to mainnet (requires real wBTC and proper oracle integration)
3. Integrate Pragma oracle for production
4. Deploy Liquidator contract (Stage 2)
