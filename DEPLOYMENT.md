# BTCUSD Protocol - Deployment Guide

This guide covers deploying the BTCUSD stablecoin protocol with the Bitcoin bridge on Starknet Sepolia testnet.

## Prerequisites

1. **Starknet Wallet**
   - Install `starkli` CLI: https://github.com/xJonathanLEI/starkli
   - Create/import a deployer account with testnet ETH

2. **Development Tools**
   - Node.js v18+
   - Scarb (Cairo build tool)
   - npx/npm

3. **Environment**
   - Starknet Sepolia RPC endpoint (e.g., from Alchemy, Infura)
   - Testnet ETH for deployment fees

## Quick Start

### 1. Build Contracts

```bash
cd contracts
scarb build
```

### 2. Deploy Core Protocol

First, export your Starknet credentials:

```bash
export STARKNET_RPC="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/YOUR_API_KEY"
export STARKNET_ACCOUNT=~/.starkli-wallets/deployer/account.json
export STARKNET_KEYSTORE=~/.starkli-wallets/deployer/keystore.json
```

Deploy the contracts:

```bash
cd contracts

# Deploy wBTC mock (or use existing wBTC on mainnet)
starkli declare target/dev/btcusd_protocol_MockWBTC.contract_class.json
starkli deploy <CLASS_HASH> <OWNER_ADDRESS> --salt 1

# Deploy BTCUSD Token
starkli declare target/dev/btcusd_protocol_BTCUSDToken.contract_class.json
starkli deploy <CLASS_HASH> <OWNER_ADDRESS> --salt 1

# Deploy Price Oracle
starkli declare target/dev/btcusd_protocol_PriceOracle.contract_class.json
starkli deploy <CLASS_HASH> --salt 1

# Deploy Vault
starkli declare target/dev/btcusd_protocol_BTCUSDVault.contract_class.json
starkli deploy <CLASS_HASH> <WBTC_ADDRESS> <BTCUSD_ADDRESS> <ORACLE_ADDRESS> --salt 1

# Deploy Liquidator
starkli declare target/dev/btcusd_protocol_Liquidator.contract_class.json
starkli deploy <CLASS_HASH> <VAULT_ADDRESS> --salt 1
```

### 3. Deploy Bridge Contracts

```bash
# Deploy Mock BTC Relay (for testnet)
starkli declare target/dev/btcusd_protocol_MockBtcRelay.contract_class.json
MOCK_BTC_RELAY=$(starkli deploy <CLASS_HASH> --salt 1)

# Deploy Atomiq Adapter
starkli declare target/dev/btcusd_protocol_AtomiqAdapter.contract_class.json
starkli deploy <CLASS_HASH> <WBTC_ADDRESS> <BTC_RELAY_ADDRESS> <OWNER_ADDRESS> --salt 1
```

Or use the deployment script:

```bash
./contracts/scripts/deploy-bridge.sh
```

### 4. Configure Backend

Create `backend/.env`:

```env
# Starknet Configuration
STARKNET_RPC_URL=https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/YOUR_KEY
STARKNET_PRIVATE_KEY=your_keeper_private_key
STARKNET_ACCOUNT_ADDRESS=your_keeper_address

# Contract Addresses (from deployment)
WBTC_ADDRESS=0x...
BTCUSD_TOKEN_ADDRESS=0x...
BTCUSD_VAULT_ADDRESS=0x...
PRICE_ORACLE_ADDRESS=0x...
LIQUIDATOR_ADDRESS=0x...
ATOMIQ_ADAPTER_ADDRESS=0x...

# Bridge Configuration
BRIDGE_ENABLED=true
BITCOIN_NETWORK=testnet
MEMPOOL_API_URL=https://mempool.space/testnet/api
BRIDGE_CONFIRMATIONS=3
BRIDGE_POLL_INTERVAL=30000
DEPOSIT_EXPIRY_SECONDS=86400
MIN_DEPOSIT_SATS=10000
MAX_DEPOSIT_SATS=100000000

# API Server
BRIDGE_API_PORT=3001
BRIDGE_API_HOST=0.0.0.0
CORS_ORIGINS=http://localhost:8081,http://localhost:19006

# Optional: Atomiq API (for production)
# ATOMIQ_API_URL=https://api.atomiq.exchange
# ATOMIQ_API_KEY=your_api_key
```

### 5. Start Bridge Server

```bash
cd backend
npm install
npm run bridge
```

The server will start on `http://localhost:3001` with the following endpoints:

- `POST /api/bridge/deposit` - Request deposit address
- `GET /api/bridge/deposit/:id` - Get deposit status
- `GET /api/bridge/user/:address` - Get user deposits
- `GET /api/bridge/stats` - Bridge statistics
- `GET /api/bridge/health` - Health check

### 6. Configure Mobile App

Update `app/src/constants/index.ts`:

```typescript
export const BRIDGE = {
  API_URL: 'http://localhost:3001',  // Your backend URL
  REQUIRED_CONFIRMATIONS: 3,
  // ...
};
```

### 7. Start Mobile App

```bash
cd app
npm install
npm start
```

## Production Deployment

### Backend Deployment

1. **Use a production database** - Replace JSON file storage with PostgreSQL or Redis:
   ```bash
   npm install pg  # or redis
   ```

2. **Enable HTTPS** - Use a reverse proxy (nginx, Caddy) with SSL

3. **Set up monitoring** - Add application monitoring (Datadog, New Relic)

4. **Configure rate limiting** - Protect API endpoints

### Contract Deployment (Mainnet)

1. Use real wBTC contract address on Starknet mainnet
2. Deploy with Atomiq's production BTC relay
3. Complete security audit before mainnet deployment
4. Set conservative limits initially

### Mobile App Distribution

1. Build for iOS/Android:
   ```bash
   npx expo build:ios
   npx expo build:android
   ```

2. Submit to App Store / Play Store

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BTCUSD Protocol                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ Mobile App  │───▶│ Bridge API   │───▶│ Bitcoin Monitor │   │
│  │ (Expo/RN)   │    │ (Node.js)    │    │ (Mempool.space) │   │
│  └─────────────┘    └──────────────┘    └─────────────────┘   │
│        │                   │                     │             │
│        ▼                   ▼                     ▼             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ Starknet    │◀──▶│ Atomiq       │◀──▶│ BTC Relay       │   │
│  │ Contracts   │    │ Adapter      │    │ (SPV Proofs)    │   │
│  └─────────────┘    └──────────────┘    └─────────────────┘   │
│                                                                 │
│  Contracts:                                                     │
│  • BTCUSDVault - CDP management, collateral handling            │
│  • BTCUSDToken - BTCUSD stablecoin (ERC20)                     │
│  • PriceOracle - BTC/USD price feed                            │
│  • Liquidator - Underwater position liquidation                 │
│  • AtomiqAdapter - BTC↔wBTC bridge integration                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## API Reference

### Request Deposit Address

```bash
curl -X POST http://localhost:3001/api/bridge/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "starknetAddress": "0x123...",
    "amountSats": 100000
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "depositId": "dep_1234567890_abc123",
    "btcAddress": "tb1q...",
    "amountSats": 100000,
    "expiresAt": 1732123456,
    "requiredConfirmations": 3
  }
}
```

### Get Deposit Status

```bash
curl http://localhost:3001/api/bridge/deposit/dep_1234567890_abc123
```

Response:
```json
{
  "success": true,
  "data": {
    "depositId": "dep_1234567890_abc123",
    "status": "confirming",
    "confirmations": 2,
    "requiredConfirmations": 3,
    "btcTxHash": "abc123...",
    "explorerUrl": "https://mempool.space/testnet/tx/abc123..."
  }
}
```

## Troubleshooting

### Bridge server won't start

1. Check environment variables are set correctly
2. Verify RPC endpoint is accessible
3. Check logs: `npm run bridge 2>&1 | npx pino-pretty`

### Deposits not being detected

1. Verify Bitcoin address format (testnet vs mainnet)
2. Check Mempool.space API is accessible
3. Ensure deposit amount meets minimum requirement

### Contract deployment fails

1. Verify you have sufficient testnet ETH
2. Check contract class hash is correct
3. Ensure account has correct permissions

## Security Considerations

1. **Private Keys** - Never commit private keys to git
2. **Rate Limiting** - Implement API rate limits
3. **Input Validation** - Validate all user inputs
4. **Monitoring** - Set up alerts for unusual activity
5. **Audits** - Complete security audit before mainnet
