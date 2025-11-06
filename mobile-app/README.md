# BTCUSD Mobile App - Testnet Version

## Real Starknet Integration

This mobile app now connects to **REAL** Starknet testnet contracts. No more mocked data.

### Contract Details

- **Network:** Starknet Sepolia Testnet
- **Contract Address:** `0x069818be022a2633500ba32c398280c2f49f19b881f9c3952d3d164df93bfd4e`
- **Explorer:** https://sepolia.starkscan.co/contract/0x069818be022a2633500ba32c398280c2f49f19b881f9c3952d3d164df93bfd4e

### Features

✅ Real contract calls using starknet.js
✅ Connect with your testnet private key
✅ View real on-chain data
✅ Execute real transactions on testnet
✅ Check contract info (name, symbol, total supply)

### Setup & Run

```bash
# Install dependencies
npm install

# Start web version
npm run web

# Or mobile
npm run ios
npm run android
```

### How to Connect

1. **Get Your Testnet Private Key**
   - If you have the deployer account: Check `~/.starkli-wallets/deployer/keystore.json` (decrypt it)
   - Or create a new testnet account with Braavos/Argent

2. **Get Testnet Funds**
   - Go to https://starknet-faucet.vercel.app/
   - Request STRK tokens for your account address

3. **Connect in App**
   - Click "Connect Wallet"
   - Enter your private key (testnet only!)
   - App will connect and load your real position

### Real Functions

**Read Functions (no transaction needed):**
- `get_user_stats(address)` - Get your collateral, debt, balance
- `balance_of(address)` - Check BTCUSD balance
- `name()` - Contract name
- `symbol()` - Contract symbol
- `total_supply()` - Total BTCUSD in circulation

**Write Functions (requires transaction + gas):**
- `deposit_and_mint(amount)` - Deposit collateral and mint BTCUSD

### Security Notes

⚠️ **IMPORTANT**
- Only use TESTNET private keys
- Never enter mainnet keys
- This is for testing/demo purposes only
- Keep your private keys secure

### Testing the Contract

Once connected, you can:

1. **View Contract Info** - Click to see name, symbol, total supply from chain
2. **Check Your Position** - See real on-chain data for your account
3. **Deposit & Mint** - Execute real transaction (costs testnet gas)

### Troubleshooting

**"Transaction failed"**
- Make sure you have testnet STRK for gas
- Check your account is deployed on testnet
- Verify the RPC endpoint is working

**"Failed to load user data"**
- Normal if you haven't deposited yet
- Position will be all zeros initially

**Connection issues**
- Try refreshing the app
- Check internet connection
- Verify private key is correct

### Development

The app uses:
- **starknet.js v7.6.4** - Starknet SDK
- **React Native + Expo** - Mobile framework
- **contract-abi.json** - Extracted from compiled Cairo contracts

To update the ABI after contract changes:
```bash
# In repo root
scarb build
cat target/dev/btcusd_stablecoin_DemoBTCUSD.contract_class.json | jq '.abi' > mobile-app/contract-abi.json
```

### Next Steps

- [ ] Add wallet connect integration (ArgentX, Braavos browser extension)
- [ ] Add transaction history
- [ ] Implement yield harvesting UI
- [ ] Add error handling for failed transactions
- [ ] Better UX for transaction confirmations
