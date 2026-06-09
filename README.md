# BTCUSD Protocol Architecture

## Monorepo Structure

```
btcusd-stablecoin/
├── contracts/                    # Cairo smart contracts
│   ├── Scarb.toml               # Scarb package config
│   ├── src/
│   │   ├── lib.cairo            # Main library entry point
│   │   │
│   │   ├── interfaces/          # All contract interfaces (imported first)
│   │   │   ├── lib.cairo
│   │   │   ├── i_btcusd_token.cairo
│   │   │   ├── i_btcusd_vault.cairo
│   │   │   ├── i_yield_manager.cairo
│   │   │   ├── i_price_oracle.cairo
│   │   │   ├── i_wbtc.cairo
│   │   │   └── i_liquidator.cairo
│   │   │
│   │   ├── core/                # Core protocol contracts
│   │   │   ├── lib.cairo
│   │   │   ├── btcusd_token.cairo
│   │   │   ├── btcusd_vault.cairo
│   │   │   └── yield_manager.cairo
│   │   │
│   │   ├── oracles/             # Oracle adapters (Stage 2+)
│   │   │   ├── lib.cairo
│   │   │   ├── mock_oracle.cairo
│   │   │   └── pragma_oracle.cairo
│   │   │
│   │   ├── liquidation/         # Liquidation module (Stage 2)
│   │   │   ├── lib.cairo
│   │   │   └── liquidator.cairo
│   │   │
│   │   ├── integrations/        # External integrations (Stage 3-4)
│   │   │   ├── lib.cairo
│   │   │   ├── vesu_adapter.cairo
│   │   │   └── atomiq_adapter.cairo
│   │   │
│   │   └── mocks/               # Mock contracts for testing
│   │       ├── lib.cairo
│   │       ├── mock_wbtc.cairo
│   │       └── mock_vesu_pool.cairo
│   │
│   └── tests/                   # Contract tests
│       ├── test_btcusd_token.cairo
│       ├── test_btcusd_vault.cairo
│       ├── test_yield_manager.cairo
│       └── test_integration.cairo
│
├── app/                         # React Native mobile app
│   ├── package.json
│   ├── tsconfig.json
│   ├── app.json
│   ├── App.tsx
│   ├── src/
│   │   ├── screens/
│   │   │   ├── ConnectWallet.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Deposit.tsx
│   │   │   └── Withdraw.tsx
│   │   ├── components/
│   │   │   ├── PositionCard.tsx
│   │   │   ├── YieldCard.tsx
│   │   │   └── TransactionButton.tsx
│   │   ├── services/
│   │   │   ├── starknet.ts      # Starknet provider setup
│   │   │   ├── contracts.ts     # Contract ABIs and addresses
│   │   │   └── wallet.ts        # Wallet connection
│   │   ├── hooks/
│   │   │   ├── usePosition.ts
│   │   │   ├── useYield.ts
│   │   │   └── useWallet.ts
│   │   ├── store/
│   │   │   └── index.ts         # Zustand store
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── constants/
│   │       ├── addresses.ts
│   │       └── abis.ts
│   └── assets/
│
├── backend/                     # Keeper services & monitoring
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── keepers/
│   │   │   ├── liquidation-bot.ts
│   │   │   ├── yield-harvester.ts
│   │   │   └── price-monitor.ts
│   │   ├── services/
│   │   │   ├── starknet.ts
│   │   │   └── alerts.ts
│   │   └── config/
│   │       └── index.ts
│   └── scripts/
│       ├── deploy.ts
│       └── verify.ts
│
├── packages/                    # Shared packages
│   └── common/
│       ├── package.json
│       └── src/
│           ├── types.ts         # Shared TypeScript types
│           ├── constants.ts     # Protocol constants
│           └── utils.ts         # Shared utilities
│
├── docs/                        # Documentation
│   ├── ROADMAP.md
│   ├── DEPLOYMENT.md
│   ├── SECURITY.md
│   └── API.md
│
├── scripts/                     # Root-level scripts
│   ├── setup.sh
│   └── deploy-testnet.sh
│
├── .github/
│   └── workflows/
│       ├── test.yml
│       └── deploy.yml
│
├── package.json                 # Root workspace config
└── README.md                    # This file
```

## Development Roadmap

### Stage 1: Core MVP (Testnet) ✅ COMPLETE
**Goal:** Working vault with deposit/mint/burn/withdraw, mock yield tracking

| Component | Description | Status |
|-----------|-------------|--------|
| BTCUSDToken | ERC20 stablecoin with vault-only minting | ✅ Done |
| BTCUSDVault | Core collateralization logic | ✅ Done |
| MockYieldManager | Virtual yield tracking (no real Vesu) | ✅ Done |
| MockOracle | Configurable BTC price for testing | ✅ Done |
| MockWBTC | Test ERC20 for wBTC | ✅ Done |

**Deliverables:**
- [x] Contracts compile with Cairo 2.9 / OZ v0.20.0
- [x] Comprehensive test suite (5 test files, 80+ tests)
- [x] Deploy script for testnet
- [x] Basic mobile app connects to testnet
- [x] Can deposit → mint → burn → withdraw

### Stage 2: Liquidations ✅ COMPLETE
**Goal:** Add liquidation mechanism with health factor monitoring

| Component | Description | Status |
|-----------|-------------|--------|
| PragmaOracle adapter | Real price feeds from Pragma Network | ✅ Done |
| Liquidator contract | Handles partial and full liquidations | ✅ Done |
| Health factor calculations | Already in vault (needs integration) | ✅ Done |
| Keeper bot | Monitors positions, triggers liquidations | ✅ Done |

**Deployed Contracts (Sepolia):**
- Liquidator: `0x047920e18d296dd5f5da36613a83e3b9badc019cb4e0d59f5fae8af2bae9141c`


[![Watch Demo](https://img.shields.io/badge/YouTube-Watch%20Demo-FF0000?style=flat&logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=5ijxs1PgWgM)

---

### Stage 3: Real Yield (Vesu Integration) ✅ COMPLETE
**Goal:** Collateral earns yield in Vesu lending pools

| Component | Description | Status |
|-----------|-------------|--------|
| VesuYieldManager | Replaces MockYieldManager with real Vesu | ✅ Done |
| IVesuSingleton adapter | Interface to Vesu Singleton contract | ✅ Done |
| Deposit/withdraw to Vesu | Real wBTC yield generation | ✅ Done |
| Fee distribution | Split yield between users and protocol | ✅ Done |

**Deployed Contracts (Sepolia):**
- VesuYieldManager: `0x050079ad8253da45dc0ab0c724c85cd07198b230e0cd7d123b8bd6520ce879f0`
- Vesu Singleton: `0x2110b3cde727cd34407e257e1070857a06010cf02a14b1ee181612fb1b61c30`
- Vesu Pool ID: `566154675190438152544449762131613456939576463701265245209877893089848934391`

---

### Stage 4: Bridge Integration (Atomiq + Xverse) 🔄 IN PROGRESS
**Goal:** Real BTC → wBTC bridge flow with Xverse wallet integration

| Component | Description |
|-----------|-------------|
| AtomiqAdapter | Interface to Atomiq bridge contracts |
| Bridge relayer | Backend service for BTC confirmation |
| Xverse/Sats Connect | Mobile wallet connection |
| Deep linking | Open Xverse from BTCUSD app |

**Atomiq Integration:**
```typescript
// backend/src/services/atomiq-bridge.ts
interface AtomiqBridge {
    // Generate deposit address for user
    generateDepositAddress(starknetAddress: string): Promise<{
        btcAddress: string;
        expiresAt: number;
    }>;

    // Monitor for BTC confirmations
    watchDeposit(btcAddress: string): Promise<{
        txHash: string;
        amount: bigint;
        confirmations: number;
    }>;

    // Mint wBTC on Starknet once confirmed
    completeBridge(
        starknetAddress: string,
        btcTxHash: string,
        amount: bigint
    ): Promise<string>; // Returns Starknet tx hash
}
```

**Xverse/Sats Connect Integration:**
```typescript
// app/src/services/xverse.ts
import { request, RpcMethod } from 'sats-connect';

interface XverseWallet {
    // Check if Xverse is installed (mobile: always false, use deep link)
    isInstalled(): boolean;

    // Connect and get BTC address
    connect(): Promise<{
        btcAddress: string;
        starknetAddress?: string;
    }>;

    // Send BTC to bridge address
    sendBTC(params: {
        recipient: string;
        amount: number;  // in satoshis
    }): Promise<string>; // Returns BTC tx hash

    // Deep link to Xverse browser with our app
    openInXverse(url: string): void;
}

// Deep link format for mobile:
// https://connect.xverse.app/browser?url=YOUR_APP_URL
```

**Mobile App Flow (Stage 4):**
1. User taps "Deposit BTC"
2. App requests deposit address from Atomiq
3. Shows QR code OR opens Xverse via deep link
4. User sends BTC from Xverse
5. Backend monitors BTC tx, triggers wBTC mint
6. App shows wBTC balance, user can deposit to vault

---

### Stage 5: Public Testnet Launch 🔄 IN PROGRESS
**Goal:** Full system running on Starknet Sepolia

| Component | Description | Status |
|-----------|-------------|--------|
| Deployment scripts | Automated testnet deployment | ✅ Done |
| Contract verification | Verify on Starkscan/Voyager | ✅ Done |
| Monitoring dashboard | Protocol health metrics | ✅ Done |
| User documentation | How-to guides | Pending |
| Bug bounty setup | Immunefi or similar | Pending |

**Deployment:**
```bash
./scripts/deploy-testnet.sh
```

**Monitoring:**
The backend includes a monitoring service that exports Prometheus-compatible metrics:
- TVL and debt tracking
- Collateral ratio monitoring
- Price feed health
- Yield statistics
- Alert generation

---

### Stage 6: Audit & Mainnet Prep
**Goal:** Production-ready protocol

| Component | Description |
|-----------|-------------|
| Internal review | Code freeze, final testing |
| External audit | Professional security audit |
| Fixes & re-audit | Address findings |
| Formal verification | Invariant proofs (optional) |
| Mainnet deployment | Production launch |

**Security Audit Scope:**

1. **Core Contracts:**
   - `BTCUSDToken` - ERC20 with vault-only minting
   - `BTCUSDVault` - Collateralization, position management
   - `MockYieldManager` / `VesuYieldManager` - Yield generation

2. **Liquidation Module:**
   - `Liquidator` - Health checks, liquidation execution
   - Keeper bot logic

3. **External Integrations:**
   - `VesuYieldManager` - Vesu Singleton integration
   - `AtomiqAdapter` - Bitcoin bridge interface

4. **Access Control:**
   - Owner functions and pause mechanisms
   - Vault-only token minting
   - Liquidator authorization

**Security Checklist:**
- [ ] No reentrancy vulnerabilities
- [ ] Integer overflow/underflow protection (Cairo handles this)
- [ ] Access control properly implemented
- [ ] Oracle manipulation resistance
- [ ] Flash loan attack resistance
- [ ] Front-running resistance
- [ ] Emergency pause functionality
- [ ] Upgrade timelock (if upgradeable)

**Mainnet Launch Plan:**
1. **Soft Launch:** Limited TVL cap ($100k), invite-only
2. **Public Launch:** Remove cap, public access
3. **Growth:** Marketing, partnerships, integrations

---

## Key Design Decisions

### 1. Decimal Handling
- **wBTC:** 8 decimals (standard Bitcoin)
- **BTCUSD:** 18 decimals (standard ERC20)
- **Prices:** 8 decimals (Pragma/Chainlink standard)
- **Ratios:** Basis points (10000 = 100%)

### 2. Collateralization Model
```
MIN_COLLATERAL_RATIO = 15000 (150%)
LIQUIDATION_THRESHOLD = 12000 (120%)
MAX_LTV = 6667 (66.67%)

health_factor = (collateral_value * PRECISION) / debt_value
liquidatable if health_factor < LIQUIDATION_THRESHOLD
```

### 3. Yield Distribution
```
USER_SHARE = 7000 (70%)
PROTOCOL_SHARE = 3000 (30%)

user_yield = total_yield * USER_SHARE / 10000
protocol_yield = total_yield * PROTOCOL_SHARE / 10000
```

### 4. Access Control
- **Owner:** Can pause, upgrade, set parameters
- **Vault:** Only address that can mint/burn BTCUSD
- **YieldManager:** Only vault can deposit/withdraw collateral
- **Liquidator:** Anyone can liquidate unhealthy positions

---

## Protocol Constants (contracts/src/lib.cairo)

```cairo
// Precision for percentage calculations (basis points)
const PRECISION: u256 = 10000;

// Collateralization parameters
const MIN_COLLATERAL_RATIO: u256 = 15000;    // 150%
const LIQUIDATION_THRESHOLD: u256 = 12000;   // 120%
const MAX_LTV: u256 = 6667;                  // 66.67%

// Liquidation parameters
const LIQUIDATION_PENALTY: u256 = 1000;      // 10%
const LIQUIDATION_REWARD: u256 = 500;        // 5% to liquidator

// Yield parameters
const USER_YIELD_SHARE: u256 = 7000;         // 70%
const PROTOCOL_YIELD_SHARE: u256 = 3000;     // 30%

// Decimals
const WBTC_DECIMALS: u8 = 8;
const BTCUSD_DECIMALS: u8 = 18;
const PRICE_DECIMALS: u8 = 8;
```

---

## Security Invariants

### Critical Invariants (must NEVER be violated)

1. **Solvency:** `total_collateral_value >= total_debt_value * MIN_COLLATERAL_RATIO / PRECISION`
2. **Supply:** `btcusd_total_supply == sum(all_user_debts)`
3. **Collateral:** `vault_wbtc_balance + yield_manager_wbtc_balance >= sum(all_user_collateral)`
4. **Minting:** Only vault can mint/burn BTCUSD
5. **No free lunch:** User cannot mint BTCUSD without depositing collateral

### Per-Position Invariants

1. **Health:** After any operation, position must have `collateral_ratio >= MIN_COLLATERAL_RATIO` OR `debt == 0`
2. **Withdrawal:** Cannot withdraw collateral if it would make position unhealthy
3. **Minting:** Cannot mint if it would make position unhealthy

---

## Deployed Contracts (Sepolia Testnet)

| Contract | Address |
|----------|---------|
| BTCUSDVault | `0x05d8736f22d6eb6b347ec1ee9b8f7cf093057610ed394dd54593c7c93757a6c1` |
| BTCUSDToken | `0x01cacb0278219b58914ea2a02695a7288f3b4f4a4fdf7911f56f21a1c3095345` |
| MockWBTC | `0x034127ccbb52ed9ab742db89fdb6d261833e118dd5aa1c69f54258553388f6fb` |
| MockOracle | `0x0198de7b85d16fa058a9d9736d2243a6e50478105008f5482ad8e8c4fa0aa13e` |
| MockYieldManager | `0x07fe41efd9c731c25610f7d9d28d0de8ec4e46695155354845da1c9b7fef94b8` |
| VesuYieldManager | `0x050079ad8253da45dc0ab0c724c85cd07198b230e0cd7d123b8bd6520ce879f0` |
| Liquidator | `0x047920e18d296dd5f5da36613a83e3b9badc019cb4e0d59f5fae8af2bae9141c` |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Scarb (Cairo package manager)
- Expo CLI for mobile development

### Smart Contracts
```bash
cd contracts
scarb build
snforge test
```

### Mobile App
```bash
cd app
npm install
npm run ios  # or npm run android
```

### Backend Keepers
```bash
cd backend
npm install
npm run dev
```
