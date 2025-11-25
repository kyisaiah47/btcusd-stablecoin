# BTCUSD Backend Services

Backend services and keeper bots for the BTCUSD protocol.

## Architecture

```
backend/
├── src/
│   ├── keepers/           # Keeper bot implementations
│   │   ├── liquidation-bot.ts    # Monitors & executes liquidations
│   │   ├── yield-harvester.ts    # Harvests yield for users
│   │   └── price-monitor.ts      # Monitors price, sends alerts
│   ├── services/          # Shared services
│   │   └── starknet.ts    # Starknet provider & contract calls
│   ├── config/            # Configuration
│   │   └── index.ts       # Environment config
│   └── types/             # TypeScript types
│       └── index.ts
└── package.json
```

## Keepers

### Liquidation Bot

Monitors all positions and executes liquidations when:
- Position health factor < 120% (LIQUIDATION_THRESHOLD)
- Estimated profit > minimum threshold
- Gas price is acceptable

**Features:**
- Parallel position scanning
- Profit calculation including gas costs
- Batch liquidation support
- Webhook alerts on execution

### Yield Harvester

Periodically harvests yield for all depositors:
- Runs on cron schedule (default: every 6 hours)
- Can harvest all users in one tx (batch) or individually
- Tracks harvest history
- Webhook alerts on harvest

### Price Monitor

Monitors BTC price and alerts on:
- Significant price drops (> 5% in 5 min)
- Significant price spikes (> 5% in 5 min)
- Stale oracle price (> 1 hour old)

**Features:**
- Price history tracking
- Alert cooldown to prevent spam
- Webhook integration (Slack/Discord)

## Configuration

Create a `.env` file:

```bash
# Network
NETWORK=sepolia
RPC_URL=https://starknet-sepolia.public.blastapi.io
CHAIN_ID=SN_SEPOLIA

# Contract Addresses
VAULT_ADDRESS=0x...
TOKEN_ADDRESS=0x...
WBTC_ADDRESS=0x...
ORACLE_ADDRESS=0x...
YIELD_MANAGER_ADDRESS=0x...
LIQUIDATOR_ADDRESS=0x...

# Keeper Account (for signing transactions)
KEEPER_ADDRESS=0x...
KEEPER_PRIVATE_KEY=0x...

# Liquidation Keeper
LIQUIDATION_KEEPER_ENABLED=true
LIQUIDATION_POLL_INTERVAL=30000
LIQUIDATION_MIN_PROFIT=10
LIQUIDATION_MAX_GAS=1000000000
LIQUIDATION_THRESHOLD=12000
LIQUIDATION_BATCH_SIZE=5

# Yield Keeper
YIELD_KEEPER_ENABLED=true
YIELD_POLL_INTERVAL=300000
YIELD_MIN_HARVEST=10000
YIELD_HARVEST_CRON="0 */6 * * *"

# Price Keeper
PRICE_KEEPER_ENABLED=true
PRICE_POLL_INTERVAL=60000
PRICE_DROP_ALERT=5
STALE_PRICE_ALERT=3600

# Alerts
ALERT_WEBHOOK=https://hooks.slack.com/...

# Logging
LOG_LEVEL=info
```

## Running

```bash
# Install dependencies
npm install

# Run liquidation bot
npm run keeper:liquidation

# Run yield harvester
npm run keeper:yield

# Run price monitor
npm run keeper:price

# Development mode (with hot reload)
npm run dev
```

## Production Deployment

For production, use a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start all keepers
pm2 start npm --name "liquidation-bot" -- run keeper:liquidation
pm2 start npm --name "yield-harvester" -- run keeper:yield
pm2 start npm --name "price-monitor" -- run keeper:price

# Save process list
pm2 save

# Enable startup on reboot
pm2 startup
```

## Security Considerations

1. **Private Key Security**: Never commit private keys. Use environment variables or a secrets manager.

2. **Rate Limiting**: RPC providers may have rate limits. Consider using multiple providers or a dedicated node.

3. **Transaction Failure**: Handle failed transactions gracefully. Implement retry logic with exponential backoff.

4. **Monitoring**: Set up monitoring for keeper health (uptime, success rate, etc.).

5. **Gas Management**: Track gas prices and set appropriate limits to prevent overpaying.

## Future Improvements

- [ ] Event indexing for tracking all positions
- [ ] Database for storing state across restarts
- [ ] Prometheus metrics endpoint
- [ ] Grafana dashboard
- [ ] Multiple RPC provider failover
- [ ] Transaction simulation before execution
- [ ] MEV protection
