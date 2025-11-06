#!/bin/bash

echo "🔧 Fixing account and deploying..."
echo ""

source ~/.starkli/env

# Remove old account that might be broken
rm -f ~/.starkli-wallets/deployer/account.json

echo "📝 Recreating account config..."
# Recreate account (you'll need to enter keystore password once)
starkli account oz init \
    ~/.starkli-wallets/deployer/account.json \
    --keystore ~/.starkli-wallets/deployer/keystore.json

echo ""
echo "🚀 Now deploying account..."
echo "   (Enter your keystore password when prompted)"
echo ""

# Deploy without specifying RPC (auto-selects working endpoint)
starkli account deploy \
    ~/.starkli-wallets/deployer/account.json \
    --keystore ~/.starkli-wallets/deployer/keystore.json

echo ""
echo "✅ Account deployed! Now you can run:"
echo "   ./deploy_testnet.sh"
