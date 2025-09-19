# BTCUSD Stablecoin

**Bitcoin-Backed Stablecoin on Starknet with Automated Yield Generation**

*Submitted to Starknet Re{Solve} Hackathon - Bitcoin Track*

## 🎥 Demo Video
**[Watch Demo on YouTube](YOUR_YOUTUBE_LINK_HERE)** - 3-minute walkthrough of the complete BTCUSD experience

## 🔗 Links
- **GitHub Repository**: https://github.com/kyisaiah47/btcusd-stablecoin
- **Live Demo**: [iOS Simulator Demo]
- **Devpost Submission**: [Pending Upload]

## 🚀 Overview

BTCUSD is a revolutionary Bitcoin-backed stablecoin that combines the security of Bitcoin with the scalability of Starknet. Users deposit Bitcoin via the Atomiq bridge, mint BTCUSD at a 66.67% LTV ratio, and automatically earn yield through Vesu protocol integration.

## ✨ Key Features

- **🔒 Bitcoin-Secured**: Real Bitcoin collateral via Atomiq's trustless bridge
- **💰 Auto-Yield**: Automatic yield farming on Vesu protocol (70% to users, 30% to protocol)
- **⚡ Lightning Fast**: Sub-second transactions on Starknet
- **📱 Mobile-Native**: Optimized mobile interface with Braavos wallet integration
- **🛡️ Overcollateralized**: 150% collateral ratio with liquidation at 120%
- **🔄 Self-Liquidating**: Flash loan-powered liquidations for capital efficiency

## 🏆 Prize Targeting

This project targets multiple sponsor prizes:

- **Bitcoin Track**: Starkware ($4K) + Starknet Foundation ($3K) + Xverse + Atomiq + Troves
- **Vesu Prizes**: Best UX Flow + Best Mobile DeFi + Best Yield Wizard ($3K total)
- **Mobile Track**: Starkware Mobile-First dApps ($3K)

**Total Prize Pool Potential: $15,000+**

## 🏗️ Architecture

### Smart Contracts (Cairo)

```
├── btcusd_token.cairo      # ERC-20 stablecoin with vault controls
├── btcusd_vault.cairo      # Core collateralization & liquidation logic
├── yield_manager.cairo     # Vesu integration & yield distribution
├── atomiq_adapter.cairo    # Bitcoin bridge integration
└── vesu_hook.cairo         # Custom lending hooks for auto-compounding
```

### Mobile App (React Native + Expo)

```
├── App.js                  # Main mobile interface
├── utils/starknet.js       # Starknet integration utilities
└── package.json            # Dependencies & configuration
```

## 🔄 User Flow

1. **Connect Wallet**: Link Braavos wallet with Bitcoin support
2. **Deposit Bitcoin**: Send BTC via Atomiq bridge → receive wBTC on Starknet
3. **Mint BTCUSD**: Lock wBTC as collateral → mint BTCUSD at 66.67% LTV
4. **Earn Yield**: Collateral automatically deposited in Vesu for yield generation
5. **Harvest Rewards**: Claim accumulated yield (users get 70% share)
6. **Manage Position**: Monitor collateral ratio, add/remove collateral

## 🛠️ Technical Implementation

### Collateralization Mechanics
- **Minimum Collateral Ratio**: 150%
- **Liquidation Threshold**: 120%
- **Loan-to-Value**: 66.67%
- **Liquidation Penalty**: 10%

### Yield Strategy
- Collateral automatically deposited into Vesu lending pools
- Yield harvested and distributed: 70% users, 30% protocol
- Auto-compounding via custom Vesu hooks
- Flash loan liquidations for capital efficiency

### Security Features
- Bitcoin PoW security via Atomiq bridge verification
- Oracle-based price feeds for BTC/USD
- Emergency pause mechanisms
- Multi-signature admin controls

## 📱 Mobile Experience

The mobile app provides a seamless DeFi experience:

- **One-tap wallet connection** with Braavos
- **Real-time position monitoring** with health indicators
- **Instant yield claiming** with visual feedback
- **Bitcoin price integration** for accurate calculations
- **Mobile-optimized UI** with dark theme

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Scarb (Cairo package manager)
- Expo CLI for mobile development

### Smart Contracts
```bash
# Install Scarb
curl -L https://docs.swmansion.com/scarb/install.sh | bash

# Build contracts
cd btcusd-stablecoin
scarb build
```

### Mobile App
```bash
# Install dependencies
cd mobile-app
npm install

# Start development server
npm run web
# or for mobile
npm run ios
npm run android
```

## 🎯 Sponsor Integration

### Atomiq Integration
- Direct Bitcoin-to-wBTC bridging
- Zero-slippage atomic swaps
- Bitcoin PoW security validation

### Vesu Integration
- Custom lending hooks for auto-yield
- ERC-4626 vToken integration
- Flash loan capabilities

### Xverse Integration
- Bitcoin wallet connectivity
- Lightning Network support
- Mobile-first Bitcoin UX

## 🔮 Future Roadmap

- **Phase 1**: Mainnet deployment with basic features
- **Phase 2**: Advanced yield strategies (multiple Vesu pools)
- **Phase 3**: Cross-chain expansion (Bitcoin L2s)
- **Phase 4**: Governance token and DAO structure

## 📊 Market Opportunity

- **$1T+ Bitcoin market cap** seeking yield opportunities
- **Growing Starknet ecosystem** with 100+ dApps
- **Mobile DeFi trend** with 3B+ smartphone users
- **Institutional adoption** of Bitcoin collateral products

## 🏅 Why BTCUSD Will Win

1. **Multi-Prize Strategy**: Targets 6+ sponsor prizes across tracks
2. **Real Utility**: Solves actual problem (Bitcoin yield generation)
3. **Technical Excellence**: Advanced Cairo contracts with proper security
4. **Mobile-First**: Optimized for the largest user segment
5. **Ecosystem Integration**: Deep integration with Atomiq, Vesu, Xverse
6. **Scalable Architecture**: Built for millions of users

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Team

Built for Starknet Re{Solve} Hackathon by [Your Name]

**Generated with Claude Code** 🤖