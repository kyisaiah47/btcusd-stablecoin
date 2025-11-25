#!/bin/bash

# BTCUSD Protocol Deployment Script
# Deploy contracts to Starknet Sepolia testnet

set -e

echo "========================================="
echo "BTCUSD Protocol Deployment - Sepolia"
echo "========================================="

# Configuration
NETWORK=${NETWORK:-sepolia}
RPC_URL=${RPC_URL:-"https://starknet-sepolia.public.blastapi.io"}

# Check for required tools
command -v starkli >/dev/null 2>&1 || { echo "Error: starkli is not installed. Please install it first."; exit 1; }
command -v scarb >/dev/null 2>&1 || { echo "Error: scarb is not installed. Please install it first."; exit 1; }

# Check for account file
if [ -z "$STARKNET_ACCOUNT" ]; then
    echo "Error: STARKNET_ACCOUNT environment variable not set"
    echo "Please set it to your account JSON file path"
    exit 1
fi

if [ -z "$STARKNET_KEYSTORE" ]; then
    echo "Error: STARKNET_KEYSTORE environment variable not set"
    echo "Please set it to your keystore file path"
    exit 1
fi

echo ""
echo "Network: $NETWORK"
echo "RPC URL: $RPC_URL"
echo "Account: $STARKNET_ACCOUNT"
echo ""

# Build contracts
echo "Building contracts..."
cd "$(dirname "$0")/.."
scarb build

# Get compiled contract paths
COMPILED_DIR="target/dev"

echo ""
echo "Compiled contracts found:"
ls -la $COMPILED_DIR/*.contract_class.json 2>/dev/null || echo "No contracts found!"

# Declare contracts
echo ""
echo "========================================="
echo "Step 1: Declaring contracts..."
echo "========================================="

# Declare BTCUSDToken
echo "Declaring BTCUSDToken..."
BTCUSD_CLASS_HASH=$(starkli declare \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $COMPILED_DIR/btcusd_btcusd_token_BTCUSDToken.contract_class.json \
    --watch 2>&1 | grep -oP '0x[a-f0-9]+' | head -1)
echo "BTCUSDToken class hash: $BTCUSD_CLASS_HASH"

# Declare BTCUSDVault
echo "Declaring BTCUSDVault..."
VAULT_CLASS_HASH=$(starkli declare \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $COMPILED_DIR/btcusd_btcusd_vault_BTCUSDVault.contract_class.json \
    --watch 2>&1 | grep -oP '0x[a-f0-9]+' | head -1)
echo "BTCUSDVault class hash: $VAULT_CLASS_HASH"

# Declare MockOracle
echo "Declaring MockOracle..."
ORACLE_CLASS_HASH=$(starkli declare \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $COMPILED_DIR/btcusd_mock_oracle_MockOracle.contract_class.json \
    --watch 2>&1 | grep -oP '0x[a-f0-9]+' | head -1)
echo "MockOracle class hash: $ORACLE_CLASS_HASH"

# Declare MockYieldManager
echo "Declaring MockYieldManager..."
YIELD_CLASS_HASH=$(starkli declare \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $COMPILED_DIR/btcusd_mock_yield_manager_MockYieldManager.contract_class.json \
    --watch 2>&1 | grep -oP '0x[a-f0-9]+' | head -1)
echo "MockYieldManager class hash: $YIELD_CLASS_HASH"

# Declare MockWBTC
echo "Declaring MockWBTC..."
WBTC_CLASS_HASH=$(starkli declare \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $COMPILED_DIR/btcusd_mock_wbtc_MockWBTC.contract_class.json \
    --watch 2>&1 | grep -oP '0x[a-f0-9]+' | head -1)
echo "MockWBTC class hash: $WBTC_CLASS_HASH"

echo ""
echo "========================================="
echo "Step 2: Deploying contracts..."
echo "========================================="

# Get deployer address
DEPLOYER=$(starkli account address --account $STARKNET_ACCOUNT)
echo "Deployer address: $DEPLOYER"

# Deploy MockWBTC first
echo ""
echo "Deploying MockWBTC..."
WBTC_ADDRESS=$(starkli deploy \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $WBTC_CLASS_HASH \
    $DEPLOYER \
    --watch 2>&1 | grep -oP '0x[a-f0-9]+' | head -1)
echo "MockWBTC deployed at: $WBTC_ADDRESS"

# Deploy MockOracle
echo ""
echo "Deploying MockOracle..."
# Initial price: $95,000 (95000 * 10^8 = 9500000000000)
INITIAL_PRICE="9500000000000"
ORACLE_ADDRESS=$(starkli deploy \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $ORACLE_CLASS_HASH \
    $DEPLOYER \
    $INITIAL_PRICE \
    --watch 2>&1 | grep -oP '0x[a-f0-9]+' | head -1)
echo "MockOracle deployed at: $ORACLE_ADDRESS"

# Deploy BTCUSDToken
echo ""
echo "Deploying BTCUSDToken..."
BTCUSD_ADDRESS=$(starkli deploy \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $BTCUSD_CLASS_HASH \
    $DEPLOYER \
    --watch 2>&1 | grep -oP '0x[a-f0-9]+' | head -1)
echo "BTCUSDToken deployed at: $BTCUSD_ADDRESS"

# Deploy MockYieldManager
echo ""
echo "Deploying MockYieldManager..."
# Default yield rate: 5% (500 basis points)
YIELD_RATE="500"
YIELD_ADDRESS=$(starkli deploy \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $YIELD_CLASS_HASH \
    $WBTC_ADDRESS \
    $DEPLOYER \
    $YIELD_RATE \
    --watch 2>&1 | grep -oP '0x[a-f0-9]+' | head -1)
echo "MockYieldManager deployed at: $YIELD_ADDRESS"

# Deploy BTCUSDVault
echo ""
echo "Deploying BTCUSDVault..."
VAULT_ADDRESS=$(starkli deploy \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $VAULT_CLASS_HASH \
    $DEPLOYER \
    $WBTC_ADDRESS \
    $BTCUSD_ADDRESS \
    $ORACLE_ADDRESS \
    $YIELD_ADDRESS \
    --watch 2>&1 | grep -oP '0x[a-f0-9]+' | head -1)
echo "BTCUSDVault deployed at: $VAULT_ADDRESS"

echo ""
echo "========================================="
echo "Step 3: Configuring contracts..."
echo "========================================="

# Set vault as minter on BTCUSDToken
echo "Setting vault as minter on BTCUSDToken..."
starkli invoke \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $BTCUSD_ADDRESS \
    set_minter \
    $VAULT_ADDRESS \
    --watch

# Set vault on YieldManager
echo "Setting vault on MockYieldManager..."
starkli invoke \
    --rpc $RPC_URL \
    --account $STARKNET_ACCOUNT \
    --keystore $STARKNET_KEYSTORE \
    $YIELD_ADDRESS \
    set_vault \
    $VAULT_ADDRESS \
    --watch

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Contract Addresses:"
echo "-------------------------------------------"
echo "MockWBTC:          $WBTC_ADDRESS"
echo "MockOracle:        $ORACLE_ADDRESS"
echo "BTCUSDToken:       $BTCUSD_ADDRESS"
echo "MockYieldManager:  $YIELD_ADDRESS"
echo "BTCUSDVault:       $VAULT_ADDRESS"
echo "-------------------------------------------"
echo ""

# Save addresses to file
ADDRESSES_FILE="deployed_addresses_$NETWORK.json"
cat > $ADDRESSES_FILE << EOF
{
  "network": "$NETWORK",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "contracts": {
    "wbtc": "$WBTC_ADDRESS",
    "oracle": "$ORACLE_ADDRESS",
    "btcusd": "$BTCUSD_ADDRESS",
    "yieldManager": "$YIELD_ADDRESS",
    "vault": "$VAULT_ADDRESS"
  },
  "classHashes": {
    "wbtc": "$WBTC_CLASS_HASH",
    "oracle": "$ORACLE_CLASS_HASH",
    "btcusd": "$BTCUSD_CLASS_HASH",
    "yieldManager": "$YIELD_CLASS_HASH",
    "vault": "$VAULT_CLASS_HASH"
  }
}
EOF
echo "Addresses saved to: $ADDRESSES_FILE"
echo ""
echo "Next steps:"
echo "1. Update app/src/constants/index.ts with these addresses"
echo "2. Update backend/.env with these addresses"
echo "3. Test the deployment by depositing some wBTC"
echo ""
echo "To mint test wBTC for testing:"
echo "starkli invoke $WBTC_ADDRESS mint <YOUR_ADDRESS> <AMOUNT>"
echo ""
