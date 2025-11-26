#!/bin/bash
#
# BTCUSD Protocol - Testnet Deployment Script
#
# Deploys all contracts to Starknet Sepolia testnet
#
# Prerequisites:
# - Scarb 2.9.2
# - Starkli with configured account
# - Environment variables set in .env
#
# Usage:
#   ./scripts/deploy-testnet.sh
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment
source .env 2>/dev/null || true

# Configuration
NETWORK="${NETWORK:-sepolia}"
RPC_URL="${RPC_URL:-https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo}"
ACCOUNT_FILE="${STARKNET_ACCOUNT:-~/.starkli-wallets/deployer/account.json}"
KEYSTORE_FILE="${STARKNET_KEYSTORE:-~/.starkli-wallets/deployer/keystore.json}"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  BTCUSD Protocol Deployment${NC}"
echo -e "${BLUE}  Network: ${NETWORK}${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v scarb &> /dev/null; then
    echo -e "${RED}Error: scarb not found. Install from https://docs.swmansion.com/scarb${NC}"
    exit 1
fi

if ! command -v starkli &> /dev/null; then
    echo -e "${RED}Error: starkli not found. Install from https://github.com/xJonathanLEI/starkli${NC}"
    exit 1
fi

echo -e "${GREEN}Prerequisites OK${NC}"
echo ""

# Build contracts
echo -e "${YELLOW}Building contracts...${NC}"
cd contracts
scarb build
echo -e "${GREEN}Build complete${NC}"
echo ""

# Get class hashes from compiled artifacts
CONTRACTS_DIR="target/dev"

# Function to declare and deploy a contract
deploy_contract() {
    local name=$1
    local constructor_args=$2

    echo -e "${YELLOW}Deploying ${name}...${NC}"

    # Get the sierra file
    local sierra_file="${CONTRACTS_DIR}/btcusd_protocol_${name}.contract_class.json"

    if [ ! -f "$sierra_file" ]; then
        echo -e "${RED}Error: Sierra file not found: ${sierra_file}${NC}"
        return 1
    fi

    # Declare the contract class
    echo "  Declaring class..."
    local declare_output
    declare_output=$(starkli declare "$sierra_file" \
        --account "$ACCOUNT_FILE" \
        --keystore "$KEYSTORE_FILE" \
        --rpc "$RPC_URL" \
        2>&1) || {
        # Check if already declared
        if echo "$declare_output" | grep -q "already declared"; then
            local class_hash=$(echo "$declare_output" | grep -oP '0x[a-fA-F0-9]+' | head -1)
            echo "  Class already declared: $class_hash"
        else
            echo -e "${RED}Error declaring ${name}: ${declare_output}${NC}"
            return 1
        fi
    }

    local class_hash=$(echo "$declare_output" | grep -oP 'class hash: 0x[a-fA-F0-9]+' | grep -oP '0x[a-fA-F0-9]+' || echo "")

    if [ -z "$class_hash" ]; then
        class_hash=$(echo "$declare_output" | grep -oP '0x[a-fA-F0-9]+' | head -1)
    fi

    echo "  Class hash: $class_hash"

    # Deploy the contract
    echo "  Deploying instance..."
    local deploy_output
    deploy_output=$(starkli deploy "$class_hash" $constructor_args \
        --account "$ACCOUNT_FILE" \
        --keystore "$KEYSTORE_FILE" \
        --rpc "$RPC_URL" \
        2>&1) || {
        echo -e "${RED}Error deploying ${name}: ${deploy_output}${NC}"
        return 1
    }

    local contract_address=$(echo "$deploy_output" | grep -oP 'Contract deployed at 0x[a-fA-F0-9]+' | grep -oP '0x[a-fA-F0-9]+' || echo "")

    if [ -z "$contract_address" ]; then
        contract_address=$(echo "$deploy_output" | grep -oP '0x[a-fA-F0-9]+' | tail -1)
    fi

    echo -e "  ${GREEN}Deployed at: ${contract_address}${NC}"
    echo ""

    echo "$contract_address"
}

# Store deployed addresses
declare -A DEPLOYED

# Deploy order matters due to dependencies

# 1. Deploy MockWBTC (or use existing wBTC)
echo -e "${BLUE}Step 1/6: Deploying MockWBTC...${NC}"
OWNER_ADDRESS=$(starkli account address "$ACCOUNT_FILE" 2>/dev/null || echo "0x0")
DEPLOYED[wbtc]=$(deploy_contract "MockWBTC" "$OWNER_ADDRESS")

# 2. Deploy MockOracle
echo -e "${BLUE}Step 2/6: Deploying MockOracle...${NC}"
INITIAL_PRICE="9700000000000" # $97,000 with 8 decimals
DEPLOYED[oracle]=$(deploy_contract "MockOracle" "$INITIAL_PRICE $OWNER_ADDRESS")

# 3. Deploy BTCUSDToken
echo -e "${BLUE}Step 3/6: Deploying BTCUSDToken...${NC}"
DEPLOYED[token]=$(deploy_contract "BTCUSDToken" "$OWNER_ADDRESS")

# 4. Deploy MockYieldManager
echo -e "${BLUE}Step 4/6: Deploying MockYieldManager...${NC}"
DEPLOYED[yieldManager]=$(deploy_contract "MockYieldManager" "${DEPLOYED[wbtc]} $OWNER_ADDRESS")

# 5. Deploy BTCUSDVault
echo -e "${BLUE}Step 5/6: Deploying BTCUSDVault...${NC}"
DEPLOYED[vault]=$(deploy_contract "BTCUSDVault" "${DEPLOYED[wbtc]} ${DEPLOYED[token]} ${DEPLOYED[oracle]} ${DEPLOYED[yieldManager]} $OWNER_ADDRESS")

# 6. Deploy Liquidator
echo -e "${BLUE}Step 6/6: Deploying Liquidator...${NC}"
DEPLOYED[liquidator]=$(deploy_contract "Liquidator" "${DEPLOYED[vault]} ${DEPLOYED[token]} ${DEPLOYED[wbtc]} ${DEPLOYED[oracle]} $OWNER_ADDRESS")

# Configure contracts
echo -e "${YELLOW}Configuring contracts...${NC}"

# Set vault on token
echo "  Setting vault on BTCUSDToken..."
starkli invoke "${DEPLOYED[token]}" set_vault "${DEPLOYED[vault]}" \
    --account "$ACCOUNT_FILE" \
    --keystore "$KEYSTORE_FILE" \
    --rpc "$RPC_URL" \
    2>&1 || echo "  (May have already been set)"

# Set vault on yield manager
echo "  Setting vault on YieldManager..."
starkli invoke "${DEPLOYED[yieldManager]}" set_vault "${DEPLOYED[vault]}" \
    --account "$ACCOUNT_FILE" \
    --keystore "$KEYSTORE_FILE" \
    --rpc "$RPC_URL" \
    2>&1 || echo "  (May have already been set)"

# Set liquidator on vault
echo "  Setting liquidator on Vault..."
starkli invoke "${DEPLOYED[vault]}" set_liquidator "${DEPLOYED[liquidator]}" \
    --account "$ACCOUNT_FILE" \
    --keystore "$KEYSTORE_FILE" \
    --rpc "$RPC_URL" \
    2>&1 || echo "  (May have already been set)"

echo -e "${GREEN}Configuration complete${NC}"
echo ""

# Print summary
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Deployment Summary${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo "Network: $NETWORK"
echo ""
echo "Deployed Contracts:"
echo "  MockWBTC:        ${DEPLOYED[wbtc]}"
echo "  MockOracle:      ${DEPLOYED[oracle]}"
echo "  BTCUSDToken:     ${DEPLOYED[token]}"
echo "  MockYieldManager: ${DEPLOYED[yieldManager]}"
echo "  BTCUSDVault:     ${DEPLOYED[vault]}"
echo "  Liquidator:      ${DEPLOYED[liquidator]}"
echo ""

# Save to .env format
ENV_FILE="../.env.deployed"
echo "# BTCUSD Protocol - Deployed Contract Addresses" > "$ENV_FILE"
echo "# Network: $NETWORK" >> "$ENV_FILE"
echo "# Deployed: $(date)" >> "$ENV_FILE"
echo "" >> "$ENV_FILE"
echo "WBTC_ADDRESS=${DEPLOYED[wbtc]}" >> "$ENV_FILE"
echo "ORACLE_ADDRESS=${DEPLOYED[oracle]}" >> "$ENV_FILE"
echo "TOKEN_ADDRESS=${DEPLOYED[token]}" >> "$ENV_FILE"
echo "YIELD_MANAGER_ADDRESS=${DEPLOYED[yieldManager]}" >> "$ENV_FILE"
echo "VAULT_ADDRESS=${DEPLOYED[vault]}" >> "$ENV_FILE"
echo "LIQUIDATOR_ADDRESS=${DEPLOYED[liquidator]}" >> "$ENV_FILE"

echo -e "${GREEN}Addresses saved to .env.deployed${NC}"
echo ""

# Verification links
echo "Verify on Starkscan:"
for name in wbtc oracle token yieldManager vault liquidator; do
    echo "  $name: https://sepolia.starkscan.co/contract/${DEPLOYED[$name]}"
done
echo ""

echo -e "${GREEN}Deployment complete!${NC}"
