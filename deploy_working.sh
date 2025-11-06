#!/bin/bash

source ~/.starkli/env

# Use PublicNode's free RPC (tested and working)
export STARKNET_RPC="https://starknet-sepolia-rpc.publicnode.com"

echo "🚀 Deploying account with PublicNode RPC (tested working)..."
echo ""
echo "Your account address: 0x01f7bb20a9a9f073da23ab3319ec81e81289982b9afd1115269003a6c5f20acf"
echo ""
echo "Make sure this address has testnet funds!"
echo "Get funds at: https://starknet-faucet.vercel.app/"
echo ""

starkli account deploy \
    ~/.starkli-wallets/deployer/account.json \
    --keystore ~/.starkli-wallets/deployer/keystore.json

echo ""
if [ $? -eq 0 ]; then
    echo "✅ Account deployed successfully!"
else
    echo "❌ Deployment failed. Make sure:"
    echo "   1. Address 0x01f7bb... has testnet STRK/ETH"
    echo "   2. You haven't already deployed this account"
fi
