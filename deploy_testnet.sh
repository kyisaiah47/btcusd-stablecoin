#!/bin/bash

# BTCUSD Testnet Deployment Script

# Setup environment
source ~/.starkli/env

# Testnet RPC (Starknet Sepolia) - PublicNode is working
export STARKNET_RPC="https://starknet-sepolia-rpc.publicnode.com"

echo "🚀 BTCUSD Testnet Deployment"
echo "=============================="
echo ""

# Check if account exists
if [ ! -f ~/.starkli-wallets/deployer/account.json ]; then
    echo "❌ No account found. You need to create one first."
    echo ""
    echo "Run these commands:"
    echo "1. mkdir -p ~/.starkli-wallets/deployer"
    echo "2. starkli signer keystore from-key ~/.starkli-wallets/deployer/keystore.json"
    echo "3. Get testnet ETH from: https://starknet-faucet.vercel.app/"
    echo ""
    exit 1
fi

echo "📦 Declaring contract class..."
CLASS_HASH=$(starkli declare \
    target/dev/btcusd_stablecoin_DemoBTCUSD.contract_class.json \
    --rpc $STARKNET_RPC \
    --account ~/.starkli-wallets/deployer/account.json \
    --keystore ~/.starkli-wallets/deployer/keystore.json \
    2>&1 | grep "Class hash declared" | awk '{print $NF}')

if [ -z "$CLASS_HASH" ]; then
    echo "❌ Declaration failed. Check your account has testnet ETH."
    exit 1
fi

echo "✅ Class hash: $CLASS_HASH"
echo ""

echo "🚀 Deploying contract..."
# Deploy with owner address (you'll need to replace with your account address)
ACCOUNT_ADDRESS=$(starkli account fetch ~/.starkli-wallets/deployer/account.json --rpc $STARKNET_RPC | grep "Address:" | awk '{print $2}')

CONTRACT_ADDRESS=$(starkli deploy \
    $CLASS_HASH \
    $ACCOUNT_ADDRESS \
    --rpc $STARKNET_RPC \
    --account ~/.starkli-wallets/deployer/account.json \
    --keystore ~/.starkli-wallets/deployer/keystore.json \
    2>&1 | grep "Contract deployed" | awk '{print $NF}')

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "❌ Deployment failed."
    exit 1
fi

echo ""
echo "🎉 SUCCESS!"
echo "=============================="
echo "Contract Address: $CONTRACT_ADDRESS"
echo "Network: Starknet Sepolia Testnet"
echo "Explorer: https://sepolia.starkscan.co/contract/$CONTRACT_ADDRESS"
echo ""
echo "Save this address for your mobile app!"
echo "$CONTRACT_ADDRESS" > deployed_address.txt
