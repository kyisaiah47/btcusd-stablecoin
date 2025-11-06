# Testnet Deployment Guide

## Quick Deploy (5 minutes)

### Step 1: Create Testnet Account (if you don't have one)

```bash
# 1. Create wallet directory
mkdir -p ~/.starkli-wallets/deployer

# 2. Create a new keypair (generates a private key)
starkli signer keystore new ~/.starkli-wallets/deployer/keystore.json

# You'll be asked to set a password - remember it!
# It will output your public key address

# 3. Create account using Argent contract (recommended)
starkli account oz init ~/.starkli-wallets/deployer/account.json
# Enter your public key when prompted

# 4. Deploy the account
starkli account deploy ~/.starkli-wallets/deployer/account.json \
    --keystore ~/.starkli-wallets/deployer/keystore.json \
    --rpc https://starknet-sepolia.public.blastapi.io/rpc/v0_7
```

### Step 2: Get Testnet ETH

Your account address will be displayed after creation. Get testnet ETH from:
- https://starknet-faucet.vercel.app/
- https://faucet.goerli.starknet.io/

You need ~0.01 ETH for deployment.

### Step 3: Deploy Contract

```bash
./deploy_testnet.sh
```

That's it! The script will:
1. Declare your contract class
2. Deploy the contract
3. Save the contract address to `deployed_address.txt`
4. Give you an explorer link

### Step 4: Update Mobile App

Copy the deployed contract address and update in `mobile-app/App.js`:

```javascript
const CONTRACTS = {
  VAULT: 'YOUR_DEPLOYED_ADDRESS_HERE',  // <-- Paste here
  TOKEN: '0x456...',
  WBTC: '0x789...'
};
```

## Manual Deployment (if script fails)

```bash
source ~/.starkli/env
export STARKNET_RPC="https://starknet-sepolia.public.blastapi.io/rpc/v0_7"

# Declare
starkli declare target/dev/btcusd_stablecoin_DemoBTCUSD.contract_class.json \
    --rpc $STARKNET_RPC \
    --account ~/.starkli-wallets/deployer/account.json \
    --keystore ~/.starkli-wallets/deployer/keystore.json

# Deploy (replace CLASS_HASH with output from declare)
starkli deploy CLASS_HASH YOUR_ACCOUNT_ADDRESS \
    --rpc $STARKNET_RPC \
    --account ~/.starkli-wallets/deployer/account.json \
    --keystore ~/.starkli-wallets/deployer/keystore.json
```

## Verify Deployment

Check your contract on the explorer:
```
https://sepolia.starkscan.co/contract/YOUR_CONTRACT_ADDRESS
```

You should see:
- Contract creation transaction
- All the contract functions (name, symbol, deposit_and_mint, etc.)

## Next Steps

Once deployed:
1. ✅ Contract is live on testnet
2. 📱 Update mobile app with contract address
3. 🔗 Connect Braavos wallet to mobile app
4. 🧪 Test deposit_and_mint function
5. 📊 Show Xverse team in first mentorship call!
