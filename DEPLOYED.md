# 🚀 BTCUSD Testnet Deployment

## Deployed Contract

**Network:** Starknet Sepolia Testnet

**Contract Address:**
```
0x069818be022a2633500ba32c398280c2f49f19b881f9c3952d3d164df93bfd4e
```

**Class Hash:**
```
0x05bef0ff997efd2e3610317567fbe1fbe51af93ccc94ae156056828243b5e30a
```

**Deployer Account:**
```
0x01f7bb20a9a9f073da23ab3319ec81e81289982b9afd1115269003a6c5f20acf
```

**Deployment Transaction:**
```
0x0032073d50997545979732261fb461de51e2c4b87aff9b37c55c277108b52a71
```

## View on Explorer

- **Contract:** https://sepolia.starkscan.co/contract/0x069818be022a2633500ba32c398280c2f49f19b881f9c3952d3d164df93bfd4e
- **Deployment TX:** https://sepolia.starkscan.co/tx/0x0032073d50997545979732261fb461de51e2c4b87aff9b37c55c277108b52a71

## Contract Functions

The deployed contract includes:
- `name()` - Returns "BTCUSD Demo"
- `symbol()` - Returns "BTCUSD"
- `deposit_and_mint(collateral_amount)` - Deposit collateral and mint BTCUSD
- `balance_of(account)` - Check BTCUSD balance
- `get_user_stats(user)` - Get user's collateral, debt, and balance
- `total_supply()` - Get total BTCUSD supply

## Next Steps

1. ✅ Contract deployed on testnet
2. 📱 Update mobile app with contract address
3. 🔗 Connect Braavos wallet
4. 🧪 Test deposit_and_mint function
5. 🎯 Prepare demo for Xverse mentorship call

## Testing the Contract

You can interact with it using starkli:

```bash
# Check contract name
starkli call 0x069818be022a2633500ba32c398280c2f49f19b881f9c3952d3d164df93bfd4e name

# Check total supply
starkli call 0x069818be022a2633500ba32c398280c2f49f19b881f9c3952d3d164df93bfd4e total_supply

# Deposit and mint (requires transaction)
starkli invoke 0x069818be022a2633500ba32c398280c2f49f19b881f9c3952d3d164df93bfd4e deposit_and_mint 1000000 \
    --account ~/.starkli-wallets/deployer/account.json \
    --keystore ~/.starkli-wallets/deployer/keystore.json
```

## Status: LIVE ON TESTNET ✅
