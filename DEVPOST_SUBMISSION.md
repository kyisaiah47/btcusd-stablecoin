# BTCUSD - Bitcoin-Backed Stablecoin on Starknet
*Devpost Submission for Starknet Re{Solve} Hackathon*

## Inspiration

Bitcoin holders face a fundamental dilemma: keep their Bitcoin and earn zero yield, or sell it for yield-bearing assets and lose Bitcoin exposure. With over $1 trillion in Bitcoin sitting idle, we saw an opportunity to solve this with Starknet's ultra-low fees and Bitcoin's emerging DeFi ecosystem.

BTCUSD enables Bitcoin holders to maintain their exposure while earning yield through automated farming on Vesu protocol - turning idle Bitcoin into productive capital.

## What it does

BTCUSD is a Bitcoin-collateralized stablecoin that automatically generates yield:

1. **Deposit Bitcoin** → Atomiq bridge converts to wBTC on Starknet
2. **Mint BTCUSD** → 66.67% LTV (150% collateral ratio) for safety
3. **Earn Yield** → Collateral auto-deposited in Vesu for 8% APY
4. **Harvest Rewards** → 70% to users, 30% to protocol sustainability

**Key Features:**
- 🔒 Real Bitcoin collateral via Atomiq's trustless bridge
- 💰 Automatic yield farming on Vesu protocol
- ⚡ Lightning-fast transactions on Starknet
- 📱 Mobile-first interface with Braavos integration
- 🛡️ Overcollateralized design with flash loan liquidations

## How we built it

### Smart Contracts (Cairo)
**5 interconnected contracts power the system:**

- **BTCUSDToken** - ERC-20 stablecoin with vault-only minting controls
- **BTCUSDVault** - Core collateralization logic with 150% minimum ratio
- **YieldManager** - Vesu integration with custom lending hooks
- **AtomiqAdapter** - Bitcoin bridge monitoring and wBTC management
- **VesuHook** - Auto-compounding yield strategies and flash loans

### Mobile App (React Native + Expo)
**Mobile-optimized interface featuring:**

- Beautiful gradient design with Bitcoin orange branding
- Braavos wallet integration for Bitcoin support
- Real-time position monitoring with health indicators
- One-tap yield harvesting with visual feedback
- Starknet.js integration for seamless blockchain interaction

### Technical Architecture
```
Bitcoin → Atomiq Bridge → wBTC → BTCUSD Vault → Vesu Yield
   ↓           ↓           ↓          ↓           ↓
User BTC → Trustless → Collateral → Stablecoin → 8% APY
```

## Challenges we ran into

1. **Cairo Version Compatibility** - OpenZeppelin contracts had breaking changes between versions. Solved by creating simplified, custom implementations.

2. **Mobile Bridge Integration** - Connecting Bitcoin wallets to React Native required careful Starknet.js configuration and wallet adapter patterns.

3. **Yield Hook Complexity** - Integrating with Vesu's lending hooks while maintaining gas efficiency required custom Cairo implementations.

4. **Liquidation Safety** - Designing flash loan liquidations that protect both users and protocol required careful economic modeling.

## Accomplishments that we're proud of

✅ **Complete End-to-End System** - From Bitcoin deposit to yield harvesting, fully functional
✅ **Advanced Cairo Contracts** - 5 interconnected smart contracts with proper security
✅ **Mobile-First UX** - Beautiful, responsive interface optimized for mobile DeFi
✅ **Multi-Protocol Integration** - Deep integration with Atomiq, Vesu, and Braavos
✅ **Prize Strategy** - Designed to win $15,000+ across 6 sponsor tracks
✅ **Real Utility** - Solves genuine problem for $1T Bitcoin ecosystem

## What we learned

- **Starknet Scaling** - Experienced firsthand how ultra-low fees enable complex DeFi operations
- **Bitcoin DeFi** - Understood the technical challenges of cross-chain Bitcoin integration
- **Mobile DeFi UX** - Learned what it takes to make DeFi accessible to mainstream users
- **Cairo Development** - Gained expertise in Cairo smart contract patterns and optimization
- **Protocol Integration** - Mastered integrating with multiple DeFi protocols simultaneously

## What's next for BTCUSD

### Phase 1 (Next 3 months)
- **Mainnet Deployment** with security audits
- **Starknet Foundation Grant** application
- **Partnership discussions** with Atomiq, Vesu, Braavos

### Phase 2 (6 months)
- **Multi-asset collateral** (ETH, STRK support)
- **Advanced yield strategies** (multiple Vesu pools)
- **Mobile app** on iOS/Android app stores

### Phase 3 (12 months)
- **Cross-chain expansion** to Bitcoin L2s
- **Institutional partnerships** for large-scale adoption
- **$100M+ TVL target** with governance token launch

## Built With
- **Cairo** - Smart contract development
- **Starknet** - Layer 2 scaling and ultra-low fees
- **React Native** - Mobile-first interface
- **Atomiq** - Bitcoin bridge integration
- **Vesu** - Yield farming protocol
- **Braavos** - Bitcoin wallet connectivity
- **Expo** - Mobile development platform

## Try it out
- **Live Demo**: http://localhost:8082
- **GitHub**: [Repository Link]
- **Video Demo**: [3-minute demo video]

## Prize Tracks

**Bitcoin Track ($10,000+)**:
- Starkware Bitcoin Track - $4,000
- Starknet Foundation Bitcoin - $3,000
- Atomiq Integration Prize
- Vesu Integration Prizes (3x $1,000)
- Xverse Mobile Bitcoin UX

**Mobile Track ($3,000)**:
- Starkware Mobile-First dApps

**Total Target: $15,000+**

---

*Built with [Claude Code](https://claude.ai/code)*

*Turning Bitcoin into productive capital, one mobile transaction at a time.*