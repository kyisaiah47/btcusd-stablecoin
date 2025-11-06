#!/bin/bash

source ~/.starkli/env
export STARKNET_RPC="https://starknet-sepolia-rpc.publicnode.com"

echo "🚀 BTCUSD Contract Deployment"
echo "=============================="
echo ""

ACCOUNT_ADDR="0x01f7bb20a9a9f073da23ab3319ec81e81289982b9afd1115269003a6c5f20acf"

echo "📦 Step 1: Declaring contract class..."
echo "   This will take ~30 seconds..."
echo ""

starkli declare \
    target/dev/btcusd_stablecoin_DemoBTCUSD.contract_class.json \
    --account ~/.starkli-wallets/deployer/account.json \
    --keystore ~/.starkli-wallets/deployer/keystore.json

echo ""
echo "✅ If declaration succeeded, copy the CLASS_HASH from above"
echo ""
echo "🚀 Step 2: Deploy the contract with:"
echo ""
echo "   starkli deploy CLASS_HASH $ACCOUNT_ADDR \\"
echo "       --account ~/.starkli-wallets/deployer/account.json \\"
echo "       --keystore ~/.starkli-wallets/deployer/keystore.json"
echo ""
echo "Replace CLASS_HASH with the value from the declaration output"
