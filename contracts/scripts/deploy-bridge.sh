#!/bin/bash

# BTCUSD Bridge Deployment Script
# Deploy Atomiq adapter and mock BTC relay to Starknet Sepolia

set -e

echo "========================================="
echo "BTCUSD Bridge Deployment - Sepolia"
echo "========================================="

# Configuration
NETWORK=${NETWORK:-sepolia}
RPC_URL=${RPC_URL:-"https://starknet-sepolia.public.blastapi.io"}

# Existing contract addresses (from main deployment)
WBTC_ADDRESS=${WBTC_ADDRESS:-"0x034127ccbb52ed9ab742db89fdb6d261833e118dd5aa1c69f54258553388f6fb"}

# Check for required tools
command -v starkli >/dev/null 2>&1 || { echo "Error: starkli is not installed."; exit 1; }
command -v scarb >/dev/null 2>&1 || { echo "Error: scarb is not installed."; exit 1; }

# Check for account file
if [ -z "$STARKNET_ACCOUNT" ]; then
    echo "Error: STARKNET_ACCOUNT environment variable not set"
    exit 1
fi

if [ -z "$STARKNET_KEYSTORE" ]; then
    echo "Error: STARKNET_KEYSTORE environment variable not set"
    exit 1
fi

echo ""
echo "Network: $NETWORK"
echo "RPC URL: $RPC_URL"
echo "wBTC Address: $WBTC_ADDRESS"
echo ""

# Build contracts
echo "Building contracts..."
cd "$(dirname "$0")/.."
scarb build

COMPILED_DIR="target/dev"

echo ""
echo "========================================="
echo "Step 1: Declaring bridge contracts..."
echo "========================================="

# Declare MockBtcRelay
echo "Declaring MockBtcRelay..."
BTC_RELAY_CLASS_HASH=$(starkli declare \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $COMPILED_DIR/btcusd_protocol_mocks_mock_btc_relay_MockBtcRelay.contract_class.json \
    --watch 2>&1 | grep -oE '0x[a-f0-9]+' | head -1) || {
    echo "MockBtcRelay may already be declared, trying to get class hash..."
    BTC_RELAY_CLASS_HASH=$(starkli class-hash-at $COMPILED_DIR/btcusd_protocol_mocks_mock_btc_relay_MockBtcRelay.contract_class.json 2>/dev/null || echo "")
}
echo "MockBtcRelay class hash: $BTC_RELAY_CLASS_HASH"

# Declare AtomiqAdapter
echo "Declaring AtomiqAdapter..."
ATOMIQ_CLASS_HASH=$(starkli declare \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $COMPILED_DIR/btcusd_protocol_integrations_atomiq_adapter_AtomiqAdapter.contract_class.json \
    --watch 2>&1 | grep -oE '0x[a-f0-9]+' | head -1) || {
    echo "AtomiqAdapter may already be declared..."
}
echo "AtomiqAdapter class hash: $ATOMIQ_CLASS_HASH"

echo ""
echo "========================================="
echo "Step 2: Deploying bridge contracts..."
echo "========================================="

# Get deployer address
DEPLOYER=$(starkli account address --account $STARKNET_ACCOUNT)
echo "Deployer address: $DEPLOYER"

# Deploy MockBtcRelay
echo ""
echo "Deploying MockBtcRelay..."
BTC_RELAY_ADDRESS=$(starkli deploy \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $BTC_RELAY_CLASS_HASH \
    --watch 2>&1 | grep -oE '0x[a-f0-9]+' | head -1)
echo "MockBtcRelay deployed at: $BTC_RELAY_ADDRESS"

# Deploy AtomiqAdapter
# Constructor: owner, escrow_manager, btc_relay, wbtc
# For testing, we use deployer as escrow_manager (it won't be used with mock relay)
echo ""
echo "Deploying AtomiqAdapter..."
ATOMIQ_ADDRESS=$(starkli deploy \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $ATOMIQ_CLASS_HASH \
    $DEPLOYER \
    $DEPLOYER \
    $BTC_RELAY_ADDRESS \
    $WBTC_ADDRESS \
    --watch 2>&1 | grep -oE '0x[a-f0-9]+' | head -1)
echo "AtomiqAdapter deployed at: $ATOMIQ_ADDRESS"

echo ""
echo "========================================="
echo "Step 3: Funding AtomiqAdapter with wBTC..."
echo "========================================="

# Mint some wBTC to the AtomiqAdapter for testing bridge claims
# 10 wBTC = 10 * 10^8 = 1000000000
echo "Minting 10 wBTC to AtomiqAdapter for liquidity..."
starkli invoke \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $WBTC_ADDRESS \
    mint \
    $ATOMIQ_ADDRESS \
    u256:1000000000 \
    --watch || echo "Mint may have failed - ensure you have permission"

echo ""
echo "========================================="
echo "Bridge Deployment Complete!"
echo "========================================="
echo ""
echo "Contract Addresses:"
echo "-------------------------------------------"
echo "MockBtcRelay:     $BTC_RELAY_ADDRESS"
echo "AtomiqAdapter:    $ATOMIQ_ADDRESS"
echo "-------------------------------------------"
echo ""

# Save addresses to file
BRIDGE_ADDRESSES_FILE="bridge_addresses_$NETWORK.json"
cat > $BRIDGE_ADDRESSES_FILE << EOF
{
  "network": "$NETWORK",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "contracts": {
    "mockBtcRelay": "$BTC_RELAY_ADDRESS",
    "atomiqAdapter": "$ATOMIQ_ADDRESS"
  },
  "classHashes": {
    "mockBtcRelay": "$BTC_RELAY_CLASS_HASH",
    "atomiqAdapter": "$ATOMIQ_CLASS_HASH"
  },
  "dependencies": {
    "wbtc": "$WBTC_ADDRESS"
  }
}
EOF
echo "Addresses saved to: $BRIDGE_ADDRESSES_FILE"
echo ""
echo "Next steps:"
echo "1. Add ATOMIQ_ADAPTER_ADDRESS=$ATOMIQ_ADDRESS to backend/.env"
echo "2. Update app/src/constants/index.ts with the bridge address"
echo "3. Start the bridge server: cd backend && npm run bridge"
echo ""
