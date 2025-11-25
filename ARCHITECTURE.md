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
├── README.md
└── ARCHITECTURE.md              # This file
```

## Development Roadmap

### Stage 1: Core MVP (Testnet)
**Goal:** Working vault with deposit/mint/burn/withdraw, mock yield tracking

| Component | Description | Status |
|-----------|-------------|--------|
| BTCUSDToken | ERC20 stablecoin with vault-only minting | 🔨 Building |
| BTCUSDVault | Core collateralization logic | 🔨 Building |
| MockYieldManager | Virtual yield tracking (no real Vesu) | 🔨 Building |
| MockOracle | Fixed BTC price for testing | 🔨 Building |
| MockWBTC | Test ERC20 for wBTC | 🔨 Building |

**Deliverables:**
- [ ] Contracts compile and pass tests
- [ ] Deploy script for testnet
- [ ] Basic mobile app connects to testnet
- [ ] Can deposit → mint → burn → withdraw

### Stage 2: Liquidations
**Goal:** Add liquidation mechanism with health factor monitoring

| Component | Description |
|-----------|-------------|
| PragmaOracle adapter | Real price feeds |
| Liquidator contract | Handles liquidations |
| Health factor calculations | Proper collateral ratio checks |
| Keeper bot | Monitors and triggers liquidations |

### Stage 3: Real Yield (Vesu Integration)
**Goal:** Collateral earns yield in Vesu lending pools

| Component | Description |
|-----------|-------------|
| VesuAdapter | Deposit/withdraw to Vesu pools |
| YieldManager (real) | Track actual yield, handle distribution |
| Auto-compound hooks | Reinvest yield automatically |

### Stage 4: Bridge Integration (Atomiq)
**Goal:** Real BTC → wBTC bridge flow

| Component | Description |
|-----------|-------------|
| AtomiqAdapter | Monitor Bitcoin deposits |
| Relayer service | Watch BTC chain, update Starknet |
| Mobile BTC wallet flow | Xverse integration |

### Stage 5: Public Testnet Launch
**Goal:** Full system running on Sepolia

| Component | Description |
|-----------|-------------|
| Deployment scripts | Automated testnet deployment |
| Monitoring dashboard | Protocol health metrics |
| Documentation | User guides, API docs |
| Bug bounty prep | Security review |

### Stage 6: Audit & Mainnet Prep
**Goal:** Production-ready protocol

| Component | Description |
|-----------|-------------|
| Security audit | External audit firm |
| Formal verification | Critical invariants |
| Mainnet deployment | Production contracts |
| Launch plan | Marketing, partnerships |

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

## Testing Strategy

### Unit Tests
- Each contract function tested in isolation
- Edge cases: zero amounts, max amounts, dust
- Access control: unauthorized calls should revert
- State changes: verify storage updates correctly

### Integration Tests
- Full deposit → mint → yield → burn → withdraw flow
- Multi-user scenarios
- Liquidation scenarios (Stage 2)

### Fuzz Tests
- Random amounts within valid ranges
- Random sequences of operations
- Property-based testing for invariants

### Testnet Testing
- Manual testing on Sepolia
- Simulated price movements
- Stress testing with many positions

---

## Gas Optimization Notes

1. **Storage:** Pack related values into single slots where possible
2. **Loops:** Avoid unbounded loops; use pagination
3. **Events:** Emit minimal events; index key fields
4. **Calculations:** Pre-compute constants; avoid repeated divisions

---

## Upgrade Path

Contracts are designed to be upgradeable via proxy pattern:
- OpenZeppelin `Upgradeable` component for core contracts
- Separate data storage from logic
- Clear upgrade procedures with timelock

For Stage 1 MVP, we use non-upgradeable contracts for simplicity.
Upgradeability added in Stage 5 before mainnet.
