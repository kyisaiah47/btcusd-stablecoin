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
- [ ] Deploy script for testnet
- [ ] Basic mobile app connects to testnet
- [x] Can deposit → mint → burn → withdraw

### Stage 2: Liquidations
**Goal:** Add liquidation mechanism with health factor monitoring

| Component | Description |
|-----------|-------------|
| PragmaOracle adapter | Real price feeds from Pragma Network |
| Liquidator contract | Handles partial and full liquidations |
| Health factor calculations | Already in vault (needs integration) |
| Keeper bot | Monitors positions, triggers liquidations |

**New Contracts:**
```cairo
// contracts/src/oracles/pragma_oracle.cairo
#[starknet::interface]
pub trait IPragmaOracle<TContractState> {
    fn get_btc_price(self: @TContractState) -> (u256, u64);
    fn is_price_stale(self: @TContractState) -> bool;
    fn get_max_price_age(self: @TContractState) -> u64;
}

// contracts/src/liquidation/liquidator.cairo
#[starknet::interface]
pub trait ILiquidator<TContractState> {
    // Liquidate an unhealthy position
    // Returns: (collateral_seized, debt_repaid)
    fn liquidate(
        ref self: TContractState,
        user: ContractAddress,
        btcusd_amount: u256
    ) -> (u256, u256);

    // Check if position can be liquidated
    fn is_liquidatable(self: @TContractState, user: ContractAddress) -> bool;

    // Calculate liquidation amounts
    fn calculate_liquidation(
        self: @TContractState,
        user: ContractAddress,
        btcusd_amount: u256
    ) -> (u256, u256, u256); // (collateral, debt, bonus)

    // Get liquidation parameters
    fn get_liquidation_penalty(self: @TContractState) -> u256;  // e.g., 1000 = 10%
    fn get_liquidator_reward(self: @TContractState) -> u256;    // e.g., 500 = 5%
}
```

**Vault Updates for Stage 2:**
- Add `liquidate()` function callable by Liquidator contract only
- Add `set_liquidator()` admin function
- Emit `PositionLiquidated` event

**Backend: Liquidation Keeper**
```typescript
// backend/src/keepers/liquidation-bot.ts
interface LiquidationBot {
    // Monitor all positions every N blocks
    pollInterval: number;  // e.g., 30 seconds

    // Positions with health < threshold get added to queue
    healthThreshold: number;  // 12000 = 120%

    // Execute liquidations profitably
    minProfitUSD: number;  // Minimum profit to execute

    // Functions
    scanPositions(): Promise<Position[]>;
    findLiquidatablePositions(): Promise<Position[]>;
    calculateProfit(position: Position): Promise<number>;
    executeLiquidation(position: Position): Promise<TxHash>;
}
```

---

### Stage 3: Real Yield (Vesu Integration)
**Goal:** Collateral earns yield in Vesu lending pools

| Component | Description |
|-----------|-------------|
| VesuYieldManager | Replaces MockYieldManager with real Vesu |
| IVesuPool adapter | Interface to Vesu lending pool |
| Auto-compound logic | Reinvest yield (optional) |
| Fee distribution | Split yield between users and protocol |

**New Contracts:**
```cairo
// contracts/src/integrations/vesu_adapter.cairo
#[starknet::interface]
pub trait IVesuPool<TContractState> {
    // Deposit wBTC to earn yield
    fn deposit(ref self: TContractState, amount: u256) -> u256; // Returns shares

    // Withdraw wBTC plus earned yield
    fn withdraw(ref self: TContractState, shares: u256) -> u256; // Returns wBTC

    // Check current exchange rate
    fn get_exchange_rate(self: @TContractState) -> u256;

    // Get user's share balance
    fn balance_of(self: @TContractState, user: ContractAddress) -> u256;
}

// contracts/src/core/vesu_yield_manager.cairo
#[starknet::contract]
pub mod VesuYieldManager {
    // Implements IYieldManager interface
    // Routes deposits to Vesu pool
    // Tracks shares per user (not raw amounts)
    // Calculates yield as: (current_value - deposited_value)
}
```

**Key Differences from MockYieldManager:**
1. **Shares vs Amounts:** Track Vesu pool shares, not raw wBTC
2. **Real Yield:** Yield comes from Vesu lending rates, not simulated
3. **Compounding:** Yield auto-compounds in Vesu unless harvested
4. **Risk:** Real smart contract risk from Vesu integration

**Migration Path:**
```cairo
// Add to BTCUSDVault
fn migrate_yield_manager(ref self: ContractState, new_manager: ContractAddress) {
    self.ownable.assert_only_owner();

    // 1. Withdraw all from old yield manager
    let old_manager = IYieldManagerDispatcher { contract_address: self.yield_manager.read() };
    old_manager.emergency_withdraw();

    // 2. Set new manager
    self.yield_manager.write(new_manager);

    // 3. Deposit all to new manager
    // (done per-user on next operation, or batch migration)
}
```

---

### Stage 4: Bridge Integration (Atomiq + Xverse)
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

**Backend: Bridge Relayer**
```typescript
// backend/src/services/bridge-relayer.ts
class BridgeRelayer {
    // Watch for incoming BTC deposits
    async monitorDeposits() {
        // Poll Atomiq API or use webhooks
        // On confirmed deposit:
        // 1. Verify amount matches
        // 2. Call Atomiq contract to mint wBTC
        // 3. Optionally auto-deposit to vault
    }

    // Handle withdrawals (wBTC → BTC)
    async processWithdrawal(request: WithdrawalRequest) {
        // 1. User burns wBTC on Starknet
        // 2. Relayer initiates BTC payout via Atomiq
        // 3. User receives BTC to their address
    }
}
```

---

### Stage 5: Public Testnet Launch
**Goal:** Full system running on Starknet Sepolia

| Component | Description | Priority |
|-----------|-------------|----------|
| Deployment scripts | Automated testnet deployment | High |
| Contract verification | Verify on Starkscan/Voyager | High |
| Monitoring dashboard | Protocol health metrics | Medium |
| User documentation | How-to guides | Medium |
| Bug bounty setup | Immunefi or similar | Medium |

**Deployment Checklist:**
- [ ] Deploy all contracts to Sepolia
- [ ] Verify contract source code
- [ ] Set up proper access controls (multisig owner)
- [ ] Configure oracle with Pragma testnet
- [ ] Test full flow: deposit BTC → mint → yield → burn → withdraw
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Deploy mobile app to TestFlight/Play Console
- [ ] Write user documentation
- [ ] Set up bug bounty program

**Monitoring Dashboard:**
```typescript
// backend/src/services/monitoring.ts
interface ProtocolMetrics {
    // TVL
    totalCollateral: bigint;
    totalCollateralUSD: number;

    // Debt
    totalDebt: bigint;
    totalDebtUSD: number;

    // Health
    globalCollateralRatio: number;
    lowestHealthFactor: number;
    positionsAtRisk: number;

    // Yield
    totalYieldGenerated: bigint;
    currentAPY: number;

    // Activity
    dailyVolume: number;
    activePositions: number;
    dailyTransactions: number;
}
```

---

### Stage 6: Audit & Mainnet Prep
**Goal:** Production-ready protocol

| Component | Description | Timeline |
|-----------|-------------|----------|
| Internal review | Code freeze, final testing | Week 1-2 |
| External audit | Professional security audit | Week 3-6 |
| Fixes & re-audit | Address findings | Week 7-8 |
| Formal verification | Invariant proofs (optional) | Week 7-8 |
| Mainnet deployment | Production launch | Week 9 |

**Audit Scope:**
1. **Core Contracts:** BTCUSDToken, BTCUSDVault, YieldManager
2. **Liquidation:** Liquidator contract, keeper logic
3. **Integrations:** VesuAdapter, Oracle adapters
4. **Access Control:** Owner functions, pause mechanisms
5. **Economic Model:** Collateral ratios, liquidation math

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
